import test from "node:test";
import assert from "node:assert/strict";
import { readLimitedJsonResponse } from "../src/server/ai-provider-http.ts";
import type { AiPolicyConfig } from "../src/server/ai-policy.ts";

test("provider json reader accepts bounded json responses", async () => {
  const parsed = await readLimitedJsonResponse(
    new Response(JSON.stringify({ ok: true })),
    1024,
  );

  assert.deepEqual(parsed, { ok: true });
});

test("provider json reader rejects oversized responses", async () => {
  await assert.rejects(
    () => readLimitedJsonResponse(new Response(JSON.stringify({ text: "x".repeat(128) })), 32),
    /byte limit/i,
  );
});

test("provider json reader aborts while waiting for the response body", async () => {
  const abortController = new AbortController();
  const response = new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("{\"ok\":"));
      },
    }),
  );

  const read = readLimitedJsonResponse(response, 1024, {
    signal: abortController.signal,
  });

  abortController.abort();

  await assert.rejects(read, /body read aborted/i);
});


const providerPolicy: AiPolicyConfig = {
  accountConcurrency: 1, anonymousGlobalDailyLimit: 60, accountGenerationsPer24Hours: 3, accountGenerationsPerMinute: 3,
  betaLifetimeBudgetMicroUsd: 1_000_000, fingerprintSecret: "f".repeat(64), globalConcurrency: 2, globalGenerationsPerMinute: 10,
  hourlyBudgetMicroUsd: 100_000, lifetimeGenerationsPerAccount: 10, maxApprovedAccounts: 25, maxInputTokens: 2_000,
  maxOperationMicroUsd: 10_000, maxOutputTokens: 2_000, maximumReservationMicroUsd: 750, model: "openai/gpt-oss-20b",
  pricingVersion: "groq-openai-gpt-oss-20b-2026-09-07", provider: "groq", providerApiKey: "fixture-key",
  providerUrl: "https://api.groq.com/openai/v1/chat/completions", requestBodyBytes: 10_000, requestTimeoutMs: 1_000,
  rolling24HourBudgetMicroUsd: 1_000_000,
};

test("provider transport classifies 429 and preserves Retry-After", async () => {
  const { dispatchRewriteToProvider, AiProviderDispatchError } = await import("../src/server/ai-provider.ts");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("busy", { status: 429, headers: { "retry-after": "7" } });
  try {
    await assert.rejects(
      () => dispatchRewriteToProvider({
        policy: providerPolicy,
        system: "Rewrite safely.", user: "Hello",
      }),
      (error: unknown) => error instanceof AiProviderDispatchError && error.code === "provider_rate_limited" && error.status === 429 && error.retryAfterSeconds === 7,
    );
  } finally { globalThis.fetch = originalFetch; }
});

test("provider transport classifies 5xx as temporarily unavailable", async () => {
  const { dispatchRewriteToProvider, AiProviderDispatchError } = await import("../src/server/ai-provider.ts");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("down", { status: 503 });
  try {
    const policy = providerPolicy;
    await assert.rejects(
      () => dispatchRewriteToProvider({ policy, system: "Rewrite safely.", user: "Hello" }),
      (error: unknown) => error instanceof AiProviderDispatchError && error.code === "provider_unavailable" && error.status === 503,
    );
  } finally { globalThis.fetch = originalFetch; }
});
