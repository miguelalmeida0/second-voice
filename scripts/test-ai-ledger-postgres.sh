#!/usr/bin/env bash
set -euo pipefail

ledger_container_name="ghostwriter-security-pg-$$"
postgres_image="postgres:16@sha256:f1c3376c26f2609ab9f29f71f824103fe2fcd8ee0346485cb6122a4f93df6f94"

cleanup() {
  docker stop "$ledger_container_name" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

docker run --rm -d \
  --name "$ledger_container_name" \
  -e POSTGRES_PASSWORD=local-migration-check-only \
  -v "$PWD/supabase/migrations:/migrations:ro" \
  -v "$PWD/tests/fixtures:/integration:ro" \
  "$postgres_image" >/dev/null

database_ready=false
for _attempt in $(seq 1 30); do
  # The official image briefly runs an initialization-only Unix-socket server.
  # TCP readiness proves the final database process is accepting connections.
  if docker exec "$ledger_container_name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then
    database_ready=true
    break
  fi
  sleep 1
done

if [[ "$database_ready" != "true" ]]; then
  echo "ai-ledger-postgres: PostgreSQL did not become ready" >&2
  exit 1
fi

docker exec "$ledger_container_name" psql -U postgres -v ON_ERROR_STOP=1 -q \
  -c "create role anon nologin; create role authenticated nologin; create role service_role nologin;"

docker exec "$ledger_container_name" bash -lc \
  'set -e; for migration_file in /migrations/*.sql; do psql -U postgres -v ON_ERROR_STOP=1 -q -f "$migration_file"; done'

docker exec "$ledger_container_name" psql -U postgres -v ON_ERROR_STOP=1 -q \
  -c "insert into public.ghostwriter_beta_entitlements (account_id, approved_slot) select ('00000000-0000-0000-0000-' || lpad(slot::text, 12, '0'))::uuid, slot from generate_series(1, 25) as slot;"

run_storm() {
  local label="$1"
  local attempts="$2"
  local reservation_micro_usd="$3"
  local account_concurrency="$4"
  local global_concurrency="$5"
  local hour_budget_micro_usd="$6"
  local expected="$7"
  local expected_reserved="$8"
  local account_pool_size="$9"
  local request_number
  local account_id
  local idempotency_key
  local -a job_pids=()

  docker exec "$ledger_container_name" psql -U postgres -v ON_ERROR_STOP=1 -q \
    -c "truncate table public.ghostwriter_ai_operations;"

  for request_number in $(seq 1 "$attempts"); do
    account_id=$(printf "00000000-0000-0000-0000-%012d" "$(( (request_number - 1) % account_pool_size + 1 ))")
    idempotency_key=$(printf "%s-%04d" "$label" "$request_number")
    docker exec "$ledger_container_name" psql -U postgres -v ON_ERROR_STOP=1 -q \
      -v account_id="$account_id" \
      -v idempotency_key="$idempotency_key" \
      -v reservation_micro_usd="$reservation_micro_usd" \
      -v account_concurrency="$account_concurrency" \
      -v global_concurrency="$global_concurrency" \
      -v hour_budget_micro_usd="$hour_budget_micro_usd" \
      -v day_budget_micro_usd="$hour_budget_micro_usd" \
      -v lifetime_budget_micro_usd="$hour_budget_micro_usd" \
      -f /integration/ai-ledger-reserve.sql >/dev/null &
    job_pids+=("$!")
  done

  for job_pid in "${job_pids[@]}"; do
    wait "$job_pid"
  done

  actual=$(docker exec "$ledger_container_name" psql -U postgres -Atq -v ON_ERROR_STOP=1 \
    -c "select count(*) || '|' || coalesce(sum(reserved_micro_usd), 0) from public.ghostwriter_ai_operations;")

  if [[ "$actual" != "$expected|$expected_reserved" ]]; then
    echo "ai-ledger-postgres: $label expected $expected|$expected_reserved, got $actual" >&2
    exit 1
  fi

  echo "ai-ledger-postgres: $label PASS ($attempts attempted, $expected admitted, $expected_reserved micro-USD reserved)"
}

# Exact requested race: $0.02 remaining, $0.01 maximum reservation, 100 clients.
run_storm "financial-race" 100 10000 1 2 20000 2 20000 25

# Audited production reservation and global active-generation ceiling.
run_storm "global-concurrency" 100 750 1 2 500000 2 1500 25

# Audited per-account active-generation ceiling.
run_storm "account-concurrency" 50 750 1 2 500000 1 750 1

raised_limit_reason=$(docker exec "$ledger_container_name" psql -U postgres -Atq -v ON_ERROR_STOP=1 \
  -c "select public.ghostwriter_ai_reserve('00000000-0000-0000-0000-000000000002'::uuid, 'raised-limit-check-0001', repeat('b', 64), 'groq-openai-gpt-oss-20b-2026-09-07', 750, 25, 10, 5, 3, 1, 10, 3, 500000, 2000000, 10000000)->>'reason';")

if [[ "$raised_limit_reason" != "invalid_request" ]]; then
  echo "ai-ledger-postgres: raised SQL safety limit was not rejected" >&2
  exit 1
fi

echo "ai-ledger-postgres: raised SQL safety limits fail closed PASS"

capacity_limit_reason=$(docker exec "$ledger_container_name" psql -U postgres -Atq -v ON_ERROR_STOP=1 \
  -c "select public.ghostwriter_ai_reserve('00000000-0000-0000-0000-000000000002'::uuid, 'capacity-limit-check-01', repeat('c', 64), 'groq-openai-gpt-oss-20b-2026-09-07', 750, 1, 10, 5, 3, 1, 10, 2, 500000, 2000000, 10000000)->>'reason';")

if [[ "$capacity_limit_reason" != "entitlement_capacity_limit" ]]; then
  echo "ai-ledger-postgres: reduced approved-account ceiling was not enforced" >&2
  exit 1
fi

echo "ai-ledger-postgres: configurable approved-account ceiling PASS"

privileges=$(docker exec "$ledger_container_name" psql -U postgres -Atq -v ON_ERROR_STOP=1 -c \
  "select has_function_privilege('anon', 'public.ghostwriter_ai_reserve(uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint)', 'execute') || '|' || has_function_privilege('service_role', 'public.ghostwriter_ai_reserve(uuid,text,text,text,bigint,integer,integer,integer,integer,integer,integer,integer,bigint,bigint,bigint)', 'execute');")

if [[ "$privileges" != "false|true" && "$privileges" != "f|t" ]]; then
  echo "ai-ledger-postgres: unexpected RPC privileges $privileges" >&2
  exit 1
fi

echo "ai-ledger-postgres: migrations and service-role-only RPC grants PASS"
