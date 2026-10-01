import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CombinedAiLimitError, combinedAiLimitError, safeCombinedRetryAfter,
  COMBINED_AI_LIMIT_SQLSTATE, COMBINED_AI_LIMIT_MESSAGE,
} from "../src/lib/combined-ai-limit.ts";
import { parsePortfolioAllowance, portfolioAccessView } from "../src/lib/portfolio-access.ts";

for (const value of [1, 60, 3600, 86400]) {
  test(`retry hint accepts bounded integer ${value}`, () => {
    assert.equal(safeCombinedRetryAfter(value), value);
  });
}
for (const value of [0, -1, 1.5, 86401, Infinity, NaN, null, undefined, "60", {}, true]) {
  test(`retry hint rejects ${String(value)}`, () => {
    assert.equal(safeCombinedRetryAfter(value), 60);
  });
}

test("only the exact combined-limit SQLSTATE is mapped", () => {
  for (const value of [null, [], {}, {code:"42501"}, {code:"40001"}, {code:"GW503"}, {code:429}]) {
    assert.equal(combinedAiLimitError(value), null);
  }
  const result = combinedAiLimitError({code:COMBINED_AI_LIMIT_SQLSTATE, details:'{"retryAfterSeconds":123}'});
  assert.ok(result instanceof CombinedAiLimitError);
  assert.equal(result.retryAfterSeconds, 123);
});

test("untrusted database messages and invalid details never enter user-facing errors", () => {
  for (const details of ['{"retryAfterSeconds":"1\\r\\nInjected:true"}', "bad json", "x".repeat(513), '{}']) {
    const error = combinedAiLimitError({code:"GW429",message:"secret database URL",details});
    assert.ok(error);
    assert.equal(error.retryAfterSeconds,60);
    assert.equal(error.message,"global_combined_limit");
    assert.doesNotMatch(error.message,/secret/);
  }
});

for (const status of ["anonymous", "authenticated"] as const) {
  test(`${status} shared-cap exhaustion does not blame the visitor's personal quota`, () => {
    const allowance = parsePortfolioAllowance({remaining:3,todayRemaining:3,available:false,globalLimited:true,retryAfterSeconds:123});
    assert.ok(allowance);
    const result = portfolioAccessView({status,allowance},true,true);
    assert.equal(result.canGenerate,false);
    assert.equal(result.message,COMBINED_AI_LIMIT_MESSAGE);
    assert.doesNotMatch(result.message,/you.*used your 3/i);
  });
  test(`${status} normal three-request allowance still works without new fields`, () => {
    const allowance = parsePortfolioAllowance({remaining:3,todayRemaining:3,available:true});
    assert.ok(allowance);
    assert.equal(portfolioAccessView({status,allowance},true,true).canGenerate,true);
  });
}

test("contradictory or malformed capacity data cannot enable generation", () => {
  for (const extra of [
    {globalLimited:true,available:true}, {globalLimited:"false"},
    {retryAfterSeconds:0}, {retryAfterSeconds:86401}, {retryAfterSeconds:"60"},
  ]) {
    assert.equal(parsePortfolioAllowance({remaining:3,available:false,...extra}),null);
  }
});

test("old clients' available flag remains fail-closed", () => {
  for (const status of ["anonymous","authenticated"] as const) {
    assert.equal(portfolioAccessView({status,allowance:{remaining:3,available:false}},true,true).canGenerate,false);
  }
});

// Structural regressions below complement, but do not replace, the disposable
// PostgreSQL tests in scripts/release/test-combined-ai-cap.mjs.
const read = (path:string) => readFileSync(new URL(`../${path}`,import.meta.url),"utf8");
const migration = read("supabase/migrations/202609160001_ghostwriter_combined_global_cap.sql");
test("SQL installs one low-level insertion and dispatch guard", () => {
  assert.match(migration,/before insert or update on public\.ghostwriter_ai_operations/i);
  assert.match(migration,/combined_ai_limit_24h between 1 and 60/);
  assert.match(migration,/ghostwriter-ai-global-reservation-v1/);
  assert.match(migration,/combined_ai_revision = combined_ai_revision \+ 1/);
  assert.match(migration,/v_exclude := old.id/);
});
test("shared SQL count has no principal or profile partition", () => {
  const body=migration.slice(migration.indexOf("select count(*), count(global_dispatch_authorized_at)"),migration.indexOf("if v_used >= v_limit then"));
  assert.match(body,/interval '24 hours'/);
  assert.match(body,/state in \('reserved', 'dispatched', 'uncertain'\)/);
  assert.doesNotMatch(body,/principal_kind|profile\s*=|account_id\s*=/);
});
test("migration backfills usage and does not reset existing controls", () => {
  assert.match(migration,/when dispatched_at is not null then dispatched_at/);
  assert.match(migration,/AI dispatch accounting is immutable/);
  assert.doesNotMatch(migration,/\btruncate\b|\bdelete from\b|set paused\s*=\s*false|AI_ENABLED.*true/i);
  assert.match(migration,/revoke all on public\.ghostwriter_ai_operations, public\.ghostwriter_ai_control/);
});
test("dispatch rejection is caught before provider call and has a bounded retry", () => {
  const gateway=read("src/server/ai-gateway.ts");
  assert.ok(gateway.indexOf("error instanceof CombinedAiLimitError") < gateway.indexOf("dependencies.dispatch({"));
  assert.match(gateway,/failBeforeDispatch\(operationId, accountId, "combined_global_limit"\)/);
  assert.match(gateway,/retryAfterSeconds: safeCombinedRetryAfter/);
  assert.match(read("src/server/ai-ledger.ts"),/const combinedLimit = combinedAiLimitError\(error\)/);
});
