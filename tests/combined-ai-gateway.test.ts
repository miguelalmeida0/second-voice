/** Actual gateway tests; only Auth/ledger/provider boundaries are substituted. */
import test from "node:test";
import assert from "node:assert/strict";
import { executeGovernedRewrite } from "../src/server/ai-gateway.ts";
import { resolvePortfolioFreePolicy, AI_MODEL_ID, AI_PRICING_VERSION } from "../src/server/ai-policy.ts";
import type { AiLedger, AiReservationResult } from "../src/server/ai-ledger.ts";
import type { AiAuthenticationResult } from "../src/server/ai-auth.ts";
import type { GhostwriterInput } from "../src/server/ghostwriter.ts";
import { CombinedAiLimitError, COMBINED_AI_LIMIT_MESSAGE } from "../src/lib/combined-ai-limit.ts";
import { AiProviderDispatchError } from "../src/server/ai-provider.ts";

const input: GhostwriterInput = {
  author: "tolkien", mode: "author", mood: 50, outcome: "clarity",
  text: "The courier delivered the parcel before noon.",
};
const operationId = "00000000-0000-4000-8000-000000000099";
const accountId = "00000000-0000-4000-8000-000000000001";
const stored = { artifactToken: null, error: null, moodLabel: "fixture", rewrite: "A parcel arrived before noon.", shortId: null, status: 200 };

function fixture(principalType: "anonymous" | "authenticated", options: {
  reservation?: AiReservationResult;
  reserveError?: Error;
  claimError?: Error;
  providerError?: Error;
} = {}) {
  const calls = { reserve: 0, claim: 0, dispatch: 0, finalize: 0, release: 0, uncertain: 0, knownFailure: 0, settle: 0 };
  const resolution = resolvePortfolioFreePolicy({
    AI_ENABLED: "true", GHOSTWRITER_PROVIDER: "groq", GHOSTWRITER_ABUSE_STORE_MODE: "supabase",
    GHOSTWRITER_RELEASE_PROFILE: "portfolio-free", GHOSTWRITER_AI_PRICING_VERSION: AI_PRICING_VERSION,
    GHOSTWRITER_SECURITY_SECRET: "combined-gateway-fixture-".repeat(3),
    GHOSTWRITER_FINGERPRINT_SECRET: "combined-fingerprint-fixture-".repeat(3),
    GROQ_API_KEY: "not-a-real-provider-key", GROQ_MODEL: AI_MODEL_ID,
    GROQ_FREE_ORGANIZATION_ID: "Test Org", GROQ_FREE_PROJECT_ID: "Test Project",
    SUPABASE_URL: "https://isolated.supabase.invalid", SUPABASE_PUBLISHABLE_KEY: "fixture-publishable",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-role",
  });
  assert.equal(resolution.enabled, true, resolution.reason ?? "fixture policy");
  const ledger: AiLedger = {
    reserve: async request => {
      calls.reserve++;
      assert.equal(request.principalType, principalType);
      if (options.reserveError) throw options.reserveError;
      return options.reservation ?? {kind: "admitted", operationId};
    },
    markDispatched: async () => {calls.claim++; if (options.claimError) throw options.claimError; return true;},
    failBeforeDispatch: async () => {calls.release++; return true;},
    markUncertain: async () => {calls.uncertain++; return true;},
    settleKnownFailure: async () => {calls.knownFailure++; return true;},
    settleSuccess: async () => {calls.settle++; return true;},
  };
  const dependencies = {
    authenticate: async (): Promise<AiAuthenticationResult> => ({ok: true, identity: {
      accountId, emailVerified: true, principalType,
      ...(principalType === "authenticated" ? {sessionId: accountId} : {}),
    }}),
    resolvePolicy: () => resolution,
    killSwitchEnabled: () => true,
    ledger,
    dispatch: async () => {
      calls.dispatch++;
      if (options.providerError) throw options.providerError;
      return {rewrite: stored.rewrite, promptTokens: 100, completionTokens: 30, providerRequestId: "fixture"};
    },
    finalize: async () => {calls.finalize++; return stored;},
  };
  const run = () => executeGovernedRewrite(new Request("https://secondvoice.test/api/ghostwriter", {
    method: "POST", headers: {"idempotency-key": "combined-gateway-test-0001"},
  }), input, {}, dependencies);
  return {calls, run};
}

for (const principal of ["anonymous", "authenticated"] as const) {
  test(`${principal}: combined reservation denial makes zero provider calls`, async () => {
    const f = fixture(principal, {reservation: {kind: "denied", reason: "global_combined_limit", retryAfterSeconds: 320}});
    const r = await f.run();
    assert.equal(r.status, 429); assert.equal(r.error, COMBINED_AI_LIMIT_MESSAGE); assert.equal(r.retryAfterSeconds, 320);
    assert.equal(f.calls.dispatch, 0); assert.equal(f.calls.claim, 0); assert.equal(f.calls.release, 0);
  });
  test(`${principal}: dispatch-time cap denial cannot be bypassed by an earlier reservation`, async () => {
    const f = fixture(principal, {claimError: new CombinedAiLimitError(180)});
    const r = await f.run();
    assert.equal(r.status, 429); assert.equal(r.retryAfterSeconds, 180); assert.equal(r.operationId, operationId);
    assert.equal(f.calls.dispatch, 0); assert.equal(f.calls.release, 1); assert.equal(f.calls.settle, 0);
  });
  test(`${principal}: database outage fails closed before provider dispatch`, async () => {
    for (const options of [{reserveError: new Error("database offline")}, {claimError: new Error("database offline")}]) {
      const f = fixture(principal, options); const r = await f.run();
      assert.equal(r.status, 503); assert.equal(f.calls.dispatch, 0); assert.equal(f.calls.settle, 0);
    }
  });
  test(`${principal}: settled replay remains readable without another permit or provider call`, async () => {
    const f = fixture(principal, {reservation: {kind: "replay", operationId, state: "settled", outcome: "succeeded", result: stored}});
    const r = await f.run();
    assert.equal(r.status, 200); assert.equal(r.rewrite, stored.rewrite);
    assert.equal(f.calls.dispatch, 0); assert.equal(f.calls.claim, 0); assert.equal(f.calls.finalize, 0);
  });

  test(`${principal}: provider 429 releases user allowance but preserves dispatch accounting`, async () => {
    const f = fixture(principal, {providerError: new AiProviderDispatchError("provider_rate_limited", {status: 429, retryAfterSeconds: 7})});
    const r = await f.run();
    assert.equal(r.status, 503); assert.equal(r.reasonCode, "PROVIDER_BUSY"); assert.equal(r.retryAfterSeconds, 7);
    assert.equal(f.calls.dispatch, 1); assert.equal(f.calls.knownFailure, 1); assert.equal(f.calls.uncertain, 0); assert.equal(f.calls.settle, 0);
  });
  test(`${principal}: provider 5xx releases user allowance without marking operation uncertain`, async () => {
    const f = fixture(principal, {providerError: new AiProviderDispatchError("provider_unavailable", {status: 503})});
    const r = await f.run();
    assert.equal(r.status, 503); assert.equal(r.reasonCode, "PROVIDER_BUSY");
    assert.equal(f.calls.dispatch, 1); assert.equal(f.calls.knownFailure, 1); assert.equal(f.calls.uncertain, 0);
  });
  test(`${principal}: interrupted provider request is counted once and never retried`, async () => {
    const f = fixture(principal, {providerError: new Error("provider response lost")});
    const r = await f.run();
    assert.equal(r.status, 502); assert.equal(f.calls.dispatch, 1); assert.equal(f.calls.uncertain, 1);
    assert.equal(f.calls.release, 0); assert.equal(f.calls.settle, 0);
  });
  test(`${principal}: normal permitted rewrite still succeeds with exactly one provider call`, async () => {
    const f = fixture(principal); const r = await f.run();
    assert.equal(r.status, 200); assert.equal(r.rewrite, stored.rewrite);
    assert.equal(f.calls.dispatch, 1); assert.equal(f.calls.claim, 1); assert.equal(f.calls.settle, 1); assert.equal(f.calls.release, 0);
  });
}
