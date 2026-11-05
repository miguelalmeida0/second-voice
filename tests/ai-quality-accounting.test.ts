import test from "node:test";
import assert from "node:assert/strict";
import { executeGovernedRewrite } from "../src/server/ai-gateway.ts";
import { resolvePortfolioFreePolicy } from "../src/server/ai-policy.ts";
import { TestAiLedger } from "./helpers/ai-harness.ts";

const accountId = "00000000-0000-4000-8000-000000000001";
const input = { author: "tolkien", mode: "author", mood: 50, outcome: "clarity", text: "Yes, I can arrive before noon." } as const;
const policy = resolvePortfolioFreePolicy({
  AI_ENABLED: "true", GHOSTWRITER_RELEASE_PROFILE: "portfolio-free", GHOSTWRITER_PROVIDER: "groq",
  GROQ_MODEL: "openai/gpt-oss-20b", GHOSTWRITER_AI_PRICING_VERSION: "groq-openai-gpt-oss-20b-2026-09-07",
  GHOSTWRITER_FINGERPRINT_SECRET: "synthetic-fingerprint-only-for-offline-test", GROQ_API_KEY: "synthetic-provider-key",
  GHOSTWRITER_ABUSE_STORE_MODE: "supabase", SUPABASE_URL: "https://isolated.invalid",
  SUPABASE_SERVICE_ROLE_KEY: "synthetic-service", SUPABASE_PUBLISHABLE_KEY: "synthetic-public",
  GROQ_FREE_ORGANIZATION_ID: "test-organization", GROQ_FREE_PROJECT_ID: "test-project",
});
assert.equal(policy.enabled, true);

function fixture(options: { settlementFails?: boolean } = {}) {
  const ledger = new TestAiLedger();
  ledger.approve(accountId);
  const rejected: Array<{ actualMicroUsd: number; operationId: string; accountId: string; providerRequestId: string | null }> = [];
  let finalized = 0;
  const settleRejectedOutput = ledger.settleRejectedOutput.bind(ledger);
  const accounting = Object.assign(ledger, {
    async settleRejectedOutput(value: typeof rejected[number]) {
      rejected.push(value);
      if (options.settlementFails) return false;
      return settleRejectedOutput(value);
    },
  });
  const run = (key = "quality-accounting-test-001") => executeGovernedRewrite(new Request("https://isolated.invalid/api/ghostwriter", {
    method: "POST", headers: { "idempotency-key": key },
  }), input, {}, {
    authenticate: async () => ({ ok: true, identity: { accountId, emailVerified: true } }),
    resolvePolicy: () => policy, killSwitchEnabled: () => true, ledger: accounting,
    finalize: async () => {
      finalized++;
      return { artifactToken: null, error: null, moodLabel: "starlit", rewrite: "Before noon.", shortId: null, status: 200 };
    },
  });
  return { ledger, rejected, run, finalized: () => finalized };
}

function response(content: unknown, usage: unknown = { prompt_tokens: 500, completion_tokens: 100 }) {
  return Response.json({ id: "test-provider-request", choices: [{ message: { content } }], usage });
}

test("valid usage survives every content rejection and settles a charged failure without exposing output", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const content of ["Sure, I can arrive before noon.", "```fenced output```", "", "x".repeat(4001), null]) {
      const f = fixture(); let dispatches = 0;
      globalThis.fetch = async () => { dispatches++; return response(content); };
      const result = await f.run();
      assert.equal(result.status, 502);
      assert.equal(result.rewrite, "");
      assert.equal(result.artifactToken, null);
      assert.equal(f.finalized(), 0);
      assert.equal(f.rejected.length, 1);
      assert.equal(f.rejected[0].actualMicroUsd, 68);
      assert.equal(f.rejected[0].providerRequestId, "test-provider-request");
      assert.equal(f.ledger.operations[0].state, "settled");
      assert.equal(f.ledger.operations[0].outcome, "failed");
      assert.equal(f.ledger.operations[0].actualMicroUsd, 68);
      const replay = await f.run();
      assert.equal(replay.status, 409);
      assert.equal(dispatches, 1, "rejected output must not be regenerated for the same key");
      assert.equal(f.rejected.length, 1);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("unknown or out-of-bounds usage remains uncertain even if content is rejected", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const usage of [null, { prompt_tokens: -1, completion_tokens: 100 }, { prompt_tokens: 500, completion_tokens: 2001 }]) {
      const f = fixture();
      globalThis.fetch = async () => response("Sure, I can arrive before noon.", usage);
      const result = await f.run();
      assert.equal(result.status, 502);
      assert.equal(f.rejected.length, 0);
      assert.equal(f.ledger.operations[0].state, "uncertain");
      assert.equal(f.ledger.operations[0].actualMicroUsd, null);
    }
  } finally { globalThis.fetch = originalFetch; }
});

test("failed content-rejection settlement retains full uncertain liability", async () => {
  const originalFetch = globalThis.fetch;
  try {
    const f = fixture({ settlementFails: true });
    globalThis.fetch = async () => response("Sure, I can arrive before noon.");
    const result = await f.run();
    assert.equal(result.status, 502);
    assert.equal(f.rejected.length, 1);
    assert.equal(f.ledger.operations[0].state, "uncertain");
    assert.equal(f.ledger.operations[0].actualMicroUsd, null);
    assert.equal(f.ledger.snapshot().reservedMicroUsd, 750);
  } finally { globalThis.fetch = originalFetch; }
});
