-- Closed-beta entitlement and owner-funded AI accounting boundary.
-- Monetary values are integer micro-USD; 1 USD = 1,000,000 micro-USD.

revoke create on schema public from public;
revoke create on schema public from anon;
revoke create on schema public from authenticated;

create table if not exists public.ghostwriter_beta_entitlements (
  account_id uuid primary key,
  approved_slot smallint not null unique,
  approved_at timestamptz not null default now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  note text,
  constraint ghostwriter_beta_entitlements_slot_check
    check (approved_slot between 1 and 25),
  constraint ghostwriter_beta_entitlements_note_check
    check (note is null or length(note) <= 240),
  constraint ghostwriter_beta_entitlements_expiry_check
    check (expires_at is null or expires_at > approved_at)
);

comment on table public.ghostwriter_beta_entitlements is
  'Manual, server-side closed-beta approvals. No foreign key is intentional: deleting and recreating an auth user never auto-mints entitlement.';

create table if not exists public.ghostwriter_ai_operations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  state text not null default 'reserved',
  outcome text,
  pricing_version text not null,
  reserved_micro_usd bigint not null,
  actual_micro_usd bigint,
  provider_request_id text,
  result_json jsonb,
  failure_code text,
  created_at timestamptz not null default now(),
  dispatched_at timestamptz,
  settled_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint ghostwriter_ai_operations_idempotency_key_check
    check (idempotency_key ~ '^[A-Za-z0-9._:-]{16,80}$'),
  constraint ghostwriter_ai_operations_fingerprint_check
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint ghostwriter_ai_operations_state_check
    check (state in ('reserved', 'dispatched', 'settled', 'failed', 'uncertain')),
  constraint ghostwriter_ai_operations_outcome_check
    check (outcome is null or outcome in ('succeeded', 'failed')),
  constraint ghostwriter_ai_operations_pricing_version_check
    check (length(pricing_version) between 1 and 120),
  constraint ghostwriter_ai_operations_reserved_cost_check
    check (reserved_micro_usd between 1 and 10000),
  constraint ghostwriter_ai_operations_actual_cost_check
    check (actual_micro_usd is null or actual_micro_usd between 0 and reserved_micro_usd),
  constraint ghostwriter_ai_operations_provider_request_id_check
    check (provider_request_id is null or length(provider_request_id) <= 256),
  constraint ghostwriter_ai_operations_result_size_check
    check (result_json is null or octet_length(result_json::text) <= 16384),
  constraint ghostwriter_ai_operations_failure_code_check
    check (failure_code is null or length(failure_code) <= 120),
  constraint ghostwriter_ai_operations_idempotency_unique
    unique (account_id, idempotency_key)
);

comment on table public.ghostwriter_ai_operations is
  'Durable owner-funded AI state machine. Reserved/dispatched/uncertain rows count at their maximum reservation until settlement or manual reconciliation.';

create index if not exists ghostwriter_ai_operations_created_at_idx
  on public.ghostwriter_ai_operations (created_at);

create index if not exists ghostwriter_ai_operations_account_created_at_idx
  on public.ghostwriter_ai_operations (account_id, created_at);

create index if not exists ghostwriter_ai_operations_active_idx
  on public.ghostwriter_ai_operations (state, created_at)
  where state in ('reserved', 'dispatched', 'uncertain');

alter table public.ghostwriter_beta_entitlements enable row level security;
alter table public.ghostwriter_ai_operations enable row level security;

revoke all on table public.ghostwriter_beta_entitlements from public;
revoke all on table public.ghostwriter_beta_entitlements from anon;
revoke all on table public.ghostwriter_beta_entitlements from authenticated;
revoke all on table public.ghostwriter_ai_operations from public;
revoke all on table public.ghostwriter_ai_operations from anon;
revoke all on table public.ghostwriter_ai_operations from authenticated;

grant select, insert, update on table public.ghostwriter_beta_entitlements to service_role;
grant select, insert, update on table public.ghostwriter_ai_operations to service_role;

create or replace function public.ghostwriter_ai_reserve(
  p_account_id uuid,
  p_idempotency_key text,
  p_request_fingerprint text,
  p_pricing_version text,
  p_reservation_micro_usd bigint,
  p_max_approved_accounts integer,
  p_account_lifetime_limit integer,
  p_account_day_limit integer,
  p_account_minute_limit integer,
  p_account_concurrency_limit integer,
  p_global_minute_limit integer,
  p_global_concurrency_limit integer,
  p_hour_budget_micro_usd bigint,
  p_day_budget_micro_usd bigint,
  p_beta_lifetime_budget_micro_usd bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_existing public.ghostwriter_ai_operations%rowtype;
  v_entitlement public.ghostwriter_beta_entitlements%rowtype;
  v_operation_id uuid;
  v_count bigint;
  v_spend bigint;
begin
  -- The initial beta is deliberately serialized globally. With a 10 RPM service
  -- ceiling this is a small, bounded critical section and closes every race.
  perform pg_advisory_xact_lock(hashtextextended('ghostwriter-ai-global-reservation-v1', 0));

  select *
    into v_existing
  from public.ghostwriter_ai_operations
  where account_id = p_account_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint then
      return jsonb_build_object(
        'kind', 'conflict',
        'operation_id', v_existing.id
      );
    end if;

    return jsonb_build_object(
      'kind', 'replay',
      'operation_id', v_existing.id,
      'state', v_existing.state,
      'outcome', v_existing.outcome,
      'result', v_existing.result_json
    );
  end if;

  if
    p_account_id is null
    or p_idempotency_key !~ '^[A-Za-z0-9._:-]{16,80}$'
    or p_request_fingerprint !~ '^[a-f0-9]{64}$'
    or p_pricing_version is null
    or length(p_pricing_version) not between 1 and 120
    or p_reservation_micro_usd not between 1 and 10000
    or p_max_approved_accounts not between 1 and 25
    or p_account_lifetime_limit not between 1 and 10
    or p_account_day_limit not between 1 and 5
    or p_account_minute_limit not between 1 and 3
    or p_account_concurrency_limit <> 1
    or p_global_minute_limit not between 1 and 10
    or p_global_concurrency_limit not between 1 and 2
    or p_hour_budget_micro_usd < p_reservation_micro_usd
    or p_hour_budget_micro_usd > 500000
    or p_day_budget_micro_usd < p_hour_budget_micro_usd
    or p_day_budget_micro_usd > 2000000
    or p_beta_lifetime_budget_micro_usd < p_day_budget_micro_usd
    or p_beta_lifetime_budget_micro_usd > 10000000
  then
    return jsonb_build_object('kind', 'denied', 'reason', 'invalid_request');
  end if;

  select *
    into v_entitlement
  from public.ghostwriter_beta_entitlements
  where account_id = p_account_id;

  if not found or v_entitlement.revoked_at is not null then
    return jsonb_build_object('kind', 'denied', 'reason', 'not_entitled');
  end if;

  if v_entitlement.expires_at is not null and v_entitlement.expires_at <= v_now then
    return jsonb_build_object('kind', 'denied', 'reason', 'entitlement_expired');
  end if;

  if v_entitlement.approved_slot > p_max_approved_accounts then
    return jsonb_build_object('kind', 'denied', 'reason', 'entitlement_capacity_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where account_id = p_account_id;
  if v_count >= p_account_lifetime_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'account_lifetime_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where account_id = p_account_id
    and created_at >= v_now - interval '24 hours';
  if v_count >= p_account_day_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'account_day_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where account_id = p_account_id
    and created_at >= v_now - interval '1 minute';
  if v_count >= p_account_minute_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'account_minute_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where account_id = p_account_id
    and state in ('reserved', 'dispatched');
  if v_count >= p_account_concurrency_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'account_concurrency_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where created_at >= v_now - interval '1 minute';
  if v_count >= p_global_minute_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'global_minute_limit');
  end if;

  select count(*)
    into v_count
  from public.ghostwriter_ai_operations
  where state in ('reserved', 'dispatched');
  if v_count >= p_global_concurrency_limit then
    return jsonb_build_object('kind', 'denied', 'reason', 'global_concurrency_limit');
  end if;

  select coalesce(sum(
    case
      when state in ('reserved', 'dispatched', 'uncertain') then reserved_micro_usd
      else coalesce(actual_micro_usd, 0)
    end
  ), 0)
    into v_spend
  from public.ghostwriter_ai_operations
  where created_at >= v_now - interval '1 hour';
  if v_spend + p_reservation_micro_usd > p_hour_budget_micro_usd then
    return jsonb_build_object('kind', 'denied', 'reason', 'hour_budget');
  end if;

  select coalesce(sum(
    case
      when state in ('reserved', 'dispatched', 'uncertain') then reserved_micro_usd
      else coalesce(actual_micro_usd, 0)
    end
  ), 0)
    into v_spend
  from public.ghostwriter_ai_operations
  where created_at >= v_now - interval '24 hours';
  if v_spend + p_reservation_micro_usd > p_day_budget_micro_usd then
    return jsonb_build_object('kind', 'denied', 'reason', 'day_budget');
  end if;

  select coalesce(sum(
    case
      when state in ('reserved', 'dispatched', 'uncertain') then reserved_micro_usd
      else coalesce(actual_micro_usd, 0)
    end
  ), 0)
    into v_spend
  from public.ghostwriter_ai_operations;
  if v_spend + p_reservation_micro_usd > p_beta_lifetime_budget_micro_usd then
    return jsonb_build_object('kind', 'denied', 'reason', 'beta_lifetime_budget');
  end if;

  insert into public.ghostwriter_ai_operations (
    account_id,
    idempotency_key,
    pricing_version,
    request_fingerprint,
    reserved_micro_usd,
    state,
    created_at,
    updated_at
  )
  values (
    p_account_id,
    p_idempotency_key,
    p_pricing_version,
    p_request_fingerprint,
    p_reservation_micro_usd,
    'reserved',
    v_now,
    v_now
  )
  returning id into v_operation_id;

  return jsonb_build_object('kind', 'admitted', 'operation_id', v_operation_id);
end;
$$;

create or replace function public.ghostwriter_ai_mark_dispatched(
  p_operation_id uuid,
  p_account_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
begin
  update public.ghostwriter_ai_operations
  set
    state = 'dispatched',
    dispatched_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where id = p_operation_id
    and account_id = p_account_id
    and state = 'reserved';

  return found;
end;
$$;

create or replace function public.ghostwriter_ai_fail_before_dispatch(
  p_operation_id uuid,
  p_account_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
begin
  update public.ghostwriter_ai_operations
  set
    actual_micro_usd = 0,
    failure_code = left(coalesce(p_reason, 'pre_dispatch_failure'), 120),
    outcome = 'failed',
    state = 'failed',
    settled_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where id = p_operation_id
    and account_id = p_account_id
    and state in ('reserved', 'dispatched')
    and provider_request_id is null;

  return found;
end;
$$;

create or replace function public.ghostwriter_ai_mark_uncertain(
  p_operation_id uuid,
  p_account_id uuid,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
begin
  update public.ghostwriter_ai_operations
  set
    failure_code = left(coalesce(p_reason, 'provider_status_uncertain'), 120),
    state = 'uncertain',
    updated_at = clock_timestamp()
  where id = p_operation_id
    and account_id = p_account_id
    and state in ('reserved', 'dispatched');

  return found;
end;
$$;

create or replace function public.ghostwriter_ai_settle_success(
  p_operation_id uuid,
  p_account_id uuid,
  p_actual_micro_usd bigint,
  p_provider_request_id text,
  p_result jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
begin
  if
    p_actual_micro_usd < 0
    or p_provider_request_id is not null and length(p_provider_request_id) > 256
    or p_result is null
    or octet_length(p_result::text) > 16384
  then
    return false;
  end if;

  update public.ghostwriter_ai_operations
  set
    actual_micro_usd = p_actual_micro_usd,
    failure_code = null,
    outcome = 'succeeded',
    provider_request_id = p_provider_request_id,
    result_json = p_result,
    state = 'settled',
    settled_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where id = p_operation_id
    and account_id = p_account_id
    and state = 'dispatched'
    and p_actual_micro_usd <= reserved_micro_usd;

  return found;
end;
$$;

create or replace function public.ghostwriter_ai_reconcile_uncertain(
  p_operation_id uuid,
  p_actual_micro_usd bigint,
  p_provider_request_id text,
  p_note text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
begin
  update public.ghostwriter_ai_operations
  set
    actual_micro_usd = p_actual_micro_usd,
    failure_code = left(coalesce(p_note, 'manually_reconciled'), 120),
    outcome = 'failed',
    provider_request_id = left(p_provider_request_id, 256),
    state = 'settled',
    settled_at = clock_timestamp(),
    updated_at = clock_timestamp()
  where id = p_operation_id
    and state = 'uncertain'
    and p_actual_micro_usd between 0 and reserved_micro_usd;

  return found;
end;
$$;

create or replace function public.ghostwriter_ai_expire_result_payloads(
  p_before timestamptz default now() - interval '7 days'
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
set statement_timeout = '3s'
as $$
declare
  v_deleted integer := 0;
begin
  update public.ghostwriter_ai_operations
  set result_json = null,
      updated_at = clock_timestamp()
  where result_json is not null
    and settled_at < p_before;

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.ghostwriter_ai_reserve(
  uuid, text, text, text, bigint, integer, integer, integer, integer, integer, integer, integer, bigint, bigint, bigint
) from public, anon, authenticated;
grant execute on function public.ghostwriter_ai_reserve(
  uuid, text, text, text, bigint, integer, integer, integer, integer, integer, integer, integer, bigint, bigint, bigint
) to service_role;

revoke all on function public.ghostwriter_ai_mark_dispatched(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.ghostwriter_ai_mark_dispatched(uuid, uuid)
  to service_role;

revoke all on function public.ghostwriter_ai_fail_before_dispatch(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ghostwriter_ai_fail_before_dispatch(uuid, uuid, text)
  to service_role;

revoke all on function public.ghostwriter_ai_mark_uncertain(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.ghostwriter_ai_mark_uncertain(uuid, uuid, text)
  to service_role;

revoke all on function public.ghostwriter_ai_settle_success(uuid, uuid, bigint, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.ghostwriter_ai_settle_success(uuid, uuid, bigint, text, jsonb)
  to service_role;

revoke all on function public.ghostwriter_ai_reconcile_uncertain(uuid, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.ghostwriter_ai_reconcile_uncertain(uuid, bigint, text, text)
  to service_role;

revoke all on function public.ghostwriter_ai_expire_result_payloads(timestamptz)
  from public, anon, authenticated;
grant execute on function public.ghostwriter_ai_expire_result_payloads(timestamptz)
  to service_role;

-- Harden pre-existing security-definer functions against search-path substitution.
alter function public.ghostwriter_abuse_consume(jsonb, text[], timestamptz)
  set search_path = pg_catalog, public;
alter function public.ghostwriter_abuse_apply_penalty(text[], integer, timestamptz)
  set search_path = pg_catalog, public;
alter function public.ghostwriter_abuse_consume_challenge(text, timestamptz, timestamptz)
  set search_path = pg_catalog, public;
alter function public.ghostwriter_abuse_cleanup(timestamptz)
  set search_path = pg_catalog, public;
alter function public.ghostwriter_public_rewrite_lookup(text)
  set search_path = pg_catalog, public;
