import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const REWRITES_BASELINE_MIGRATION = readFileSync(
  "supabase/migrations/202604230000_ghostwriter_rewrites_baseline.sql",
  "utf8",
).toLowerCase();
const REWRITES_HARDENING_MIGRATION = readFileSync(
  "supabase/migrations/202604230001_ghostwriter_hardening.sql",
  "utf8",
).toLowerCase();
const PUBLIC_ARTIFACTS_MIGRATION = readFileSync(
  "supabase/migrations/202604230002_ghostwriter_public_artifacts.sql",
  "utf8",
).toLowerCase();
const PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION = readFileSync(
  "supabase/migrations/202604230006_ghostwriter_public_artifacts_privacy_correction.sql",
  "utf8",
).toLowerCase();
const ABUSE_STORE_MIGRATION = readFileSync(
  "supabase/migrations/202604230003_ghostwriter_abuse_store.sql",
  "utf8",
).toLowerCase();
const ARTIFACT_PROVENANCE_MIGRATION = readFileSync(
  "supabase/migrations/202604230004_ghostwriter_artifact_provenance.sql",
  "utf8",
).toLowerCase();
const FEEDBACK_MIGRATION = readFileSync(
  "supabase/migrations/202604230005_ghostwriter_feedback.sql",
  "utf8",
).toLowerCase();
const OUTCOME_REWRITES_MIGRATION = readFileSync(
  "supabase/migrations/202605020001_ghostwriter_outcome_rewrites.sql",
  "utf8",
).toLowerCase();
const PUBLIC_LOOKUP_RPC_MIGRATION = readFileSync(
  "supabase/migrations/202605020002_ghostwriter_public_rewrite_lookup_rpc.sql",
  "utf8",
).toLowerCase();
const AI_FINANCIAL_BOUNDARY_MIGRATION = readFileSync(
  "supabase/migrations/202609070001_ghostwriter_ai_financial_boundary.sql",
  "utf8",
).toLowerCase();

const ABUSE_RPC_SIGNATURES = [
  "public.ghostwriter_penalty_window_seconds(integer)",
  "public.ghostwriter_abuse_consume(jsonb, text[], timestamptz)",
  "public.ghostwriter_abuse_apply_penalty(text[], integer, timestamptz)",
  "public.ghostwriter_abuse_consume_challenge(text, timestamptz, timestamptz)",
  "public.ghostwriter_abuse_cleanup(timestamptz)",
];
const PUBLIC_ARTIFACT_MIGRATIONS = [
  PUBLIC_ARTIFACTS_MIGRATION,
  PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION,
  OUTCOME_REWRITES_MIGRATION,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("rewrite artifact migrations have a reproducible baseline table", () => {
  assert.match(
    REWRITES_BASELINE_MIGRATION,
    /create table if not exists public\.ghostwriter_rewrites \(/,
  );
  assert.match(REWRITES_BASELINE_MIGRATION, /id uuid primary key default gen_random_uuid\(\)/);
  assert.match(REWRITES_BASELINE_MIGRATION, /short_id text not null/);
  assert.match(REWRITES_BASELINE_MIGRATION, /author text not null/);
  assert.match(REWRITES_BASELINE_MIGRATION, /mood integer not null/);
  assert.match(REWRITES_BASELINE_MIGRATION, /input_text text not null default ''/);
  assert.match(REWRITES_BASELINE_MIGRATION, /output_text text not null/);
  assert.match(REWRITES_BASELINE_MIGRATION, /created_at timestamptz not null default now\(\)/);

  assert.doesNotMatch(REWRITES_BASELINE_MIGRATION, /grant .*ghostwriter_rewrites.* to (anon|authenticated)/);
});

test("rewrite artifact hardening runs after the baseline table exists", () => {
  assert.match(REWRITES_HARDENING_MIGRATION, /alter table if exists public\.ghostwriter_rewrites/);
  assert.match(REWRITES_HARDENING_MIGRATION, /alter table public\.ghostwriter_rewrites/);
  assert.match(REWRITES_HARDENING_MIGRATION, /enable row level security/);
  assert.match(REWRITES_HARDENING_MIGRATION, /revoke all on table public\.ghostwriter_rewrites from anon;/);
  assert.match(
    REWRITES_HARDENING_MIGRATION,
    /revoke all on table public\.ghostwriter_rewrites from authenticated;/,
  );
});

test("public artifact view remains the only anonymous rewrite read surface", () => {
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /is_public boolean not null default false/);
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /source_visible boolean not null default false/);
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /alter column is_public set default false/);
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /alter column source_visible set default false/);
  assert.doesNotMatch(PUBLIC_ARTIFACTS_MIGRATION, /is_public boolean not null default true/);
  assert.doesNotMatch(PUBLIC_ARTIFACTS_MIGRATION, /set\s+is_public\s*=\s*true/);
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /create view public\.ghostwriter_public_rewrites/);
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /with \(security_barrier = true\)/);
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /case when source_visible then input_text else '' end as input_text/);
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /where is_public = true/);
  assert.match(PUBLIC_ARTIFACTS_MIGRATION, /grant select on table public\.ghostwriter_public_rewrites to anon;/);
  assert.doesNotMatch(PUBLIC_ARTIFACTS_MIGRATION, /grant select on table public\.ghostwriter_rewrites to anon/);
});

test("public artifact lookup revokes anonymous view scans and exposes only exact short-id rpc", () => {
  assert.match(
    PUBLIC_LOOKUP_RPC_MIGRATION,
    /create or replace function public\.ghostwriter_public_rewrite_lookup\(p_short_id text\)/,
  );
  assert.match(PUBLIC_LOOKUP_RPC_MIGRATION, /security definer/);
  assert.match(PUBLIC_LOOKUP_RPC_MIGRATION, /p_short_id ~ '\^\[abcdefghijkmnopqrstuvwxyz23456789\]\{8\}\$'/);
  assert.match(PUBLIC_LOOKUP_RPC_MIGRATION, /and rewrites\.short_id = p_short_id/);
  assert.match(PUBLIC_LOOKUP_RPC_MIGRATION, /and rewrites\.is_public = true/);
  assert.match(PUBLIC_LOOKUP_RPC_MIGRATION, /grant execute on function public\.ghostwriter_public_rewrite_lookup\(text\) to anon;/);
  assert.match(PUBLIC_LOOKUP_RPC_MIGRATION, /revoke select on table public\.ghostwriter_public_rewrites from anon;/);
  assert.match(PUBLIC_LOOKUP_RPC_MIGRATION, /revoke select on table public\.ghostwriter_public_rewrites from authenticated;/);
});

test("public artifact migrations preserve base-table source text", () => {
  for (const migration of PUBLIC_ARTIFACT_MIGRATIONS) {
    assert.doesNotMatch(migration, /set\s+input_text\s*=\s*''/);
    assert.doesNotMatch(migration, /set\s+input_text\s*=\s*null/);
    assert.doesNotMatch(migration, /update\s+public\.ghostwriter_rewrites[\s\S]{0,600}input_text\s*=/);
  }
});

test("public artifact migrations keep legacy rows private by default", () => {
  assert.doesNotMatch(PUBLIC_ARTIFACTS_MIGRATION, /default true/);
  assert.doesNotMatch(PUBLIC_ARTIFACTS_MIGRATION, /set[\s\S]{0,160}is_public\s*=\s*true/);

  assert.match(
    PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION,
    /create table if not exists public\.ghostwriter_public_rewrite_allowlist/,
  );
  assert.match(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /alter column is_public set default false/);
  assert.match(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /alter column source_visible set default false/);
  assert.match(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /allowlist\.short_id is not null as should_be_public/);
  assert.match(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /is_public = allowlisted\.should_be_public/);
  assert.match(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /source_visible = false/);
  assert.match(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /case when source_visible then input_text else '' end as input_text/);
  assert.match(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /where is_public = true/);
  assert.match(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /enable row level security/);
  assert.match(
    PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION,
    /revoke all on table public\.ghostwriter_public_rewrite_allowlist from anon;/,
  );
  assert.match(
    PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION,
    /revoke all on table public\.ghostwriter_public_rewrite_allowlist from authenticated;/,
  );
  assert.match(
    PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION,
    /grant all on table public\.ghostwriter_public_rewrite_allowlist to service_role;/,
  );
  assert.doesNotMatch(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /set\s+is_public\s*=\s*true/);
  assert.doesNotMatch(PUBLIC_ARTIFACTS_PRIVACY_CORRECTION_MIGRATION, /grant select on table public\.ghostwriter_rewrites to anon/);
});

test("rewrite artifact provenance is constrained and public-safe", () => {
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /alter table if exists public\.ghostwriter_rewrites/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /generation_source text not null default 'single_rewrite'/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /lab_winner_label text/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /lab_winner_score integer/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /lab_selection_reason text/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /generation_source in \('single_rewrite', 'rewrite_lab'\)/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /lab_winner_score is null or lab_winner_score between 0 and 100/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /char_length\(lab_winner_label\) between 1 and 80/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /char_length\(lab_selection_reason\) between 1 and 280/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /ghostwriter_rewrites_lab_metadata_consistency_check/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /drop view if exists public\.ghostwriter_public_rewrites/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /with \(security_barrier = true\)/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /case when source_visible then input_text else '' end as input_text/);
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /generation_source/);
  assert.match(
    ARTIFACT_PROVENANCE_MIGRATION,
    /case when generation_source = 'rewrite_lab' then lab_winner_label else null end as lab_winner_label/,
  );
  assert.match(
    ARTIFACT_PROVENANCE_MIGRATION,
    /case when generation_source = 'rewrite_lab' then lab_winner_score else null end as lab_winner_score/,
  );
  assert.match(
    ARTIFACT_PROVENANCE_MIGRATION,
    /case when generation_source = 'rewrite_lab' then lab_selection_reason else null end as lab_selection_reason/,
  );
  assert.match(ARTIFACT_PROVENANCE_MIGRATION, /grant select on table public\.ghostwriter_public_rewrites to anon;/);
  assert.doesNotMatch(ARTIFACT_PROVENANCE_MIGRATION, /grant select on table public\.ghostwriter_rewrites to anon/);
});

test("abuse store rpc functions are service-role only", () => {
  for (const signature of ABUSE_RPC_SIGNATURES) {
    const escapedSignature = escapeRegExp(signature);

    assert.match(
      ABUSE_STORE_MIGRATION,
      new RegExp(`revoke all on function ${escapedSignature} from public;`),
      `${signature} must revoke public execution`,
    );
    assert.match(
      ABUSE_STORE_MIGRATION,
      new RegExp(`revoke all on function ${escapedSignature} from anon;`),
      `${signature} must revoke anon execution`,
    );
    assert.match(
      ABUSE_STORE_MIGRATION,
      new RegExp(`revoke all on function ${escapedSignature} from authenticated;`),
      `${signature} must revoke authenticated execution`,
    );
    assert.match(
      ABUSE_STORE_MIGRATION,
      new RegExp(`grant execute on function ${escapedSignature} to service_role;`),
      `${signature} must grant service role execution`,
    );
  }
});

test("rewrite feedback migration stores quality signals without text exposure", () => {
  assert.match(FEEDBACK_MIGRATION, /create table if not exists public\.ghostwriter_feedback/);
  assert.match(FEEDBACK_MIGRATION, /rewrite_hash text not null/);
  assert.match(FEEDBACK_MIGRATION, /rewrite_hash ~ '\^\[a-f0-9\]\{64\}\$'/);
  assert.match(FEEDBACK_MIGRATION, /rating in \('positive', 'negative'\)/);
  assert.match(FEEDBACK_MIGRATION, /reason in \(/);
  assert.match(FEEDBACK_MIGRATION, /ghostwriter_feedback_reason_matches_rating_check/);
  assert.match(FEEDBACK_MIGRATION, /generation_source in \('single_rewrite', 'rewrite_lab'\)/);
  assert.match(FEEDBACK_MIGRATION, /ghostwriter_feedback_lab_metadata_consistency_check/);
  assert.match(FEEDBACK_MIGRATION, /enable row level security/);
  assert.match(FEEDBACK_MIGRATION, /revoke all on table public\.ghostwriter_feedback from anon;/);
  assert.match(FEEDBACK_MIGRATION, /revoke all on table public\.ghostwriter_feedback from authenticated;/);
  assert.match(FEEDBACK_MIGRATION, /grant all on table public\.ghostwriter_feedback to service_role;/);
  assert.doesNotMatch(FEEDBACK_MIGRATION, /input_text/);
  assert.doesNotMatch(FEEDBACK_MIGRATION, /output_text/);
});

test("outcome rewrite migration preserves privacy and public-safe mode metadata", () => {
  assert.match(OUTCOME_REWRITES_MIGRATION, /rewrite_mode text not null default 'author'/);
  assert.match(OUTCOME_REWRITES_MIGRATION, /outcome text/);
  assert.match(OUTCOME_REWRITES_MIGRATION, /rewrite_mode in \('author', 'outcome'\)/);
  assert.match(
    OUTCOME_REWRITES_MIGRATION,
    /outcome is null or outcome in \('clarity', 'reply', 'confident', 'concise', 'persuasive'\)/,
  );
  assert.match(OUTCOME_REWRITES_MIGRATION, /ghostwriter_rewrites_mode_outcome_consistency_check/);
  assert.match(OUTCOME_REWRITES_MIGRATION, /ghostwriter_feedback_mode_outcome_consistency_check/);
  assert.match(OUTCOME_REWRITES_MIGRATION, /drop view if exists public\.ghostwriter_public_rewrites/);
  assert.match(OUTCOME_REWRITES_MIGRATION, /with \(security_barrier = true\)/);
  assert.match(OUTCOME_REWRITES_MIGRATION, /case when source_visible then input_text else '' end as input_text/);
  assert.match(OUTCOME_REWRITES_MIGRATION, /where is_public = true/);
  assert.match(OUTCOME_REWRITES_MIGRATION, /rewrite_mode/);
  assert.match(
    OUTCOME_REWRITES_MIGRATION,
    /case when rewrite_mode = 'outcome' then outcome else null end as outcome/,
  );
  assert.doesNotMatch(OUTCOME_REWRITES_MIGRATION, /grant select on table public\.ghostwriter_rewrites to anon/);
  assert.doesNotMatch(OUTCOME_REWRITES_MIGRATION, /set\s+input_text\s*=/);
});

test("AI financial admission is durable, atomic, integer-only, and service-role only", () => {
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /create table if not exists public\.ghostwriter_beta_entitlements/,
  );
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /approved_slot between 1 and 25/);
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /p_max_approved_accounts not between 1 and 25/);
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /v_entitlement\.approved_slot > p_max_approved_accounts/,
  );
  assert.doesNotMatch(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /references\s+auth\.users[\s\S]*on delete cascade/,
  );
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /create table if not exists public\.ghostwriter_ai_operations/,
  );
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /unique \(account_id, idempotency_key\)/,
  );
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /reserved_micro_usd bigint not null/);
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /actual_micro_usd bigint/);
  assert.doesNotMatch(AI_FINANCIAL_BOUNDARY_MIGRATION, /\b(real|double precision|numeric|decimal)\b/);
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /pg_advisory_xact_lock\(hashtextextended\('ghostwriter-ai-global-reservation-v1'/,
  );
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /v_spend \+ p_reservation_micro_usd > p_hour_budget_micro_usd/,
  );
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /v_spend \+ p_reservation_micro_usd > p_day_budget_micro_usd/,
  );
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /v_spend \+ p_reservation_micro_usd > p_beta_lifetime_budget_micro_usd/,
  );
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /p_account_lifetime_limit not between 1 and 10/);
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /p_account_concurrency_limit <> 1/);
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /p_global_concurrency_limit not between 1 and 2/);
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /p_hour_budget_micro_usd > 500000/);
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /p_day_budget_micro_usd > 2000000/);
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /p_beta_lifetime_budget_micro_usd > 10000000/,
  );
  assert.match(
    AI_FINANCIAL_BOUNDARY_MIGRATION,
    /state in \('reserved', 'dispatched', 'uncertain'\) then reserved_micro_usd/,
  );
  assert.match(AI_FINANCIAL_BOUNDARY_MIGRATION, /set search_path = pg_catalog/);

  for (const table of ["ghostwriter_beta_entitlements", "ghostwriter_ai_operations"]) {
    assert.match(
      AI_FINANCIAL_BOUNDARY_MIGRATION,
      new RegExp(`alter table public\\.${table} enable row level security`),
    );
    assert.match(
      AI_FINANCIAL_BOUNDARY_MIGRATION,
      new RegExp(`revoke all on table public\\.${table} from anon`),
    );
    assert.match(
      AI_FINANCIAL_BOUNDARY_MIGRATION,
      new RegExp(`revoke all on table public\\.${table} from authenticated`),
    );
  }

  for (const functionName of [
    "ghostwriter_ai_reserve",
    "ghostwriter_ai_mark_dispatched",
    "ghostwriter_ai_fail_before_dispatch",
    "ghostwriter_ai_mark_uncertain",
    "ghostwriter_ai_settle_success",
    "ghostwriter_ai_reconcile_uncertain",
  ]) {
    assert.match(
      AI_FINANCIAL_BOUNDARY_MIGRATION,
      new RegExp(`revoke all on function public\\.${functionName}`),
    );
    assert.match(
      AI_FINANCIAL_BOUNDARY_MIGRATION,
      new RegExp(`grant execute on function public\\.${functionName}`),
    );
  }
});
