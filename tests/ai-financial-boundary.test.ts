import test, {mock} from "node:test";
// Reproduce the historical paid-policy review date. Runtime pricing still
// expires normally; Free-profile expiry separation is tested independently.
mock.timers.enable({apis:["Date"],now:Date.UTC(2026,8,7,12)});
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import {
  executeGovernedRewrite,
  type GovernedGhostwriterResult,
} from "../src/server/ai-gateway.ts";
import {
  AI_MODEL_ID,
  AI_PRICING_VERSION,
  resolveAiPolicyConfig,
  type AiPolicyConfig,
  type AiPolicyResolution,
} from "../src/server/ai-policy.ts";
import type { AiAuthenticationResult } from "../src/server/ai-auth.ts";
import type { GhostwriterInput } from "../src/server/ghostwriter.ts";
import { MockAiProvider, TestAiLedger } from "./helpers/ai-harness.ts";

const ACCOUNT_A = "00000000-0000-4000-8000-000000000001";
const ACCOUNT_B = "00000000-0000-4000-8000-000000000002";
const TEST_SIGNING_VALUE = "ghostwriter-fixture-".repeat(2);
const INPUT: GhostwriterInput = {
  author: "tolkien",
  mode: "author",
  mood: 50,
  outcome: "clarity",
  text: "The road continues beyond the hill.",
};

function typescriptSources(root: URL): Array<{ path: string; source: string }> {
  const sources: Array<{ path: string; source: string }> = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const entryUrl = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, root);

    if (entry.isDirectory()) {
      sources.push(...typescriptSources(entryUrl));
    } else if (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) {
      sources.push({ path: entryUrl.pathname, source: readFileSync(entryUrl, "utf8") });
    }
  }

  return sources;
}

function policy(overrides: Partial<AiPolicyConfig> = {}): AiPolicyConfig {
  const resolution = resolveAiPolicyConfig({
    AI_ENABLED: "true",
    GHOSTWRITER_ABUSE_STORE_MODE: "supabase",
    GHOSTWRITER_AI_PRICING_VERSION: AI_PRICING_VERSION,
    GHOSTWRITER_PROVIDER: "groq",
    GHOSTWRITER_SECURITY_SECRET: TEST_SIGNING_VALUE,
    GHOSTWRITER_FINGERPRINT_SECRET: TEST_SIGNING_VALUE + "-fingerprint",
    GROQ_API_KEY: "unit-test-provider-credential",
    GROQ_MODEL: AI_MODEL_ID,
    SUPABASE_PUBLISHABLE_KEY: "unit-test-publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "unit-test-service-role-key",
    SUPABASE_URL: "https://unit-test.supabase.invalid",
  });

  assert.equal(resolution.enabled, true);
  if (!resolution.enabled) {
    throw new Error("expected valid test policy");
  }

  return { ...resolution.config, ...overrides };
}

function request(idempotencyKey: string, extraHeaders: HeadersInit = {}): Request {
  return new Request("https://ghostwriter.test/api/ghostwriter", {
    headers: {
      authorization: "Bearer test-session",
      "idempotency-key": idempotencyKey,
      ...extraHeaders,
    },
    method: "POST",
  });
}

function authenticated(accountId = ACCOUNT_A): AiAuthenticationResult {
  return { identity: { accountId, emailVerified: true }, ok: true };
}

test("AI policy requires the exact audited transport body cap", () => {
  for (const requestBodyBytes of ["9999", "10001"]) {
    const resolution = resolveAiPolicyConfig({
      AI_ENABLED: "true",
      GHOSTWRITER_ABUSE_STORE_MODE: "supabase",
      GHOSTWRITER_AI_PRICING_VERSION: AI_PRICING_VERSION,
      GHOSTWRITER_AI_REQUEST_BODY_BYTES: requestBodyBytes,
      GHOSTWRITER_PROVIDER: "groq",
      GHOSTWRITER_SECURITY_SECRET: TEST_SIGNING_VALUE,
    GHOSTWRITER_FINGERPRINT_SECRET: TEST_SIGNING_VALUE + "-fingerprint",
      GROQ_API_KEY: "unit-test-provider-credential",
      GROQ_MODEL: AI_MODEL_ID,
      SUPABASE_PUBLISHABLE_KEY: "unit-test-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "unit-test-service-role-key",
      SUPABASE_URL: "https://unit-test.supabase.invalid",
    });

    assert.equal(resolution.enabled, false);
  }
});

test("AI policy rejects every server limit above its audited maximum", () => {
  const raisedLimits = {
    GHOSTWRITER_AI_24H_BUDGET_MICRO_USD: "2000001",
    GHOSTWRITER_AI_ACCOUNT_CONCURRENCY: "2",
    GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_24H: "6",
    GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_MINUTE: "4",
    GHOSTWRITER_AI_BETA_LIFETIME_BUDGET_MICRO_USD: "10000001",
    GHOSTWRITER_AI_GLOBAL_CONCURRENCY: "3",
    GHOSTWRITER_AI_GLOBAL_GENERATIONS_PER_MINUTE: "11",
    GHOSTWRITER_AI_HOURLY_BUDGET_MICRO_USD: "500001",
    GHOSTWRITER_AI_LIFETIME_GENERATIONS_PER_ACCOUNT: "11",
    GHOSTWRITER_AI_MAX_INPUT_TOKENS: "2001",
    GHOSTWRITER_AI_MAX_OPERATION_MICRO_USD: "10001",
    GHOSTWRITER_AI_MAX_OUTPUT_TOKENS: "2001",
    GHOSTWRITER_AI_REQUEST_TIMEOUT_MS: "30001",
    GHOSTWRITER_BETA_MAX_APPROVED_ACCOUNTS: "26",
  } as const;

  for (const [name, value] of Object.entries(raisedLimits)) {
    const resolution = resolveAiPolicyConfig({
      AI_ENABLED: "true",
      GHOSTWRITER_ABUSE_STORE_MODE: "supabase",
      GHOSTWRITER_AI_PRICING_VERSION: AI_PRICING_VERSION,
      GHOSTWRITER_PROVIDER: "groq",
      GHOSTWRITER_SECURITY_SECRET: TEST_SIGNING_VALUE,
    GHOSTWRITER_FINGERPRINT_SECRET: TEST_SIGNING_VALUE + "-fingerprint",
      GROQ_API_KEY: "unit-test-provider-credential",
      GROQ_MODEL: AI_MODEL_ID,
      SUPABASE_PUBLISHABLE_KEY: "unit-test-publishable-key",
      SUPABASE_SERVICE_ROLE_KEY: "unit-test-service-role-key",
      SUPABASE_URL: "https://unit-test.supabase.invalid",
      [name]: value,
    });

    assert.equal(resolution.enabled, false, name);
  }
});

function rejectedAuth(status: 401 | 403 | 503 = 401): AiAuthenticationResult {
  return { error: "rejected", ok: false, status };
}

function dependencies(options: {
  accountId?: string;
  auth?: AiAuthenticationResult;
  config?: AiPolicyConfig;
  killSwitchEnabled?: () => boolean;
  ledger: TestAiLedger;
  provider: MockAiProvider | { dispatch: MockAiProvider["dispatch"] };
}) {
  const config = options.config ?? policy();

  return {
    authenticate: async () => options.auth ?? authenticated(options.accountId),
    dispatch: options.provider.dispatch.bind(options.provider),
    finalize: async (_input: GhostwriterInput, rewrite: string) => ({
      artifactToken: "test-artifact-token-that-is-never-a-provider-secret",
      error: null,
      moodLabel: "starlit",
      rewrite,
      shortId: null,
      status: 200,
    }),
    killSwitchEnabled: options.killSwitchEnabled ?? (() => true),
    ledger: options.ledger,
    resolvePolicy: (): AiPolicyResolution => ({ config, enabled: true, reason: null }),
  };
}

test("anonymous, expired, unverified, and forged identities make zero provider calls", async () => {
  const rejectedIdentities = [
    ["anonymous", rejectedAuth(401)],
    ["expired", rejectedAuth(401)],
    ["unverified", rejectedAuth(403)],
    ["forged", rejectedAuth(401)],
  ] as const;

  for (const [identityClass, auth] of rejectedIdentities) {
    const ledger = new TestAiLedger();
    const provider = new MockAiProvider();
    ledger.approve(ACCOUNT_A);

    const result = await executeGovernedRewrite(
      request(`auth-rejection-${identityClass}`),
      INPUT,
      {},
      dependencies({ auth, ledger, provider }),
    );

    assert.notEqual(result.status, 200);
    assert.equal(provider.calls, 0);
    assert.equal(ledger.operations.length, 0);
  }
});

test("minute quota returns a recoverable cooldown without dispatching", async () => {
  for (const reason of ["account_minute_limit", "global_minute_limit"]) {
    const ledger = new TestAiLedger();
    const provider = new MockAiProvider();
    ledger.reserve = async () => ({kind: "denied", reason});
    const result = await executeGovernedRewrite(request("cooldown-denied-0001"), INPUT, {}, dependencies({ledger, provider}));
    assert.equal(result.status, 429);
    assert.equal(result.retryAfterSeconds, 60);
    assert.match(result.error ?? "", /wait 60 seconds/);
    assert.equal(provider.calls, 0);
  }
});

test("unapproved and recreated account IDs receive no owner-funded inference", async () => {
  const ledger = new TestAiLedger();
  const provider = new MockAiProvider();
  ledger.approve(ACCOUNT_A);

  const unapproved = await executeGovernedRewrite(
    request("new-account-denied-01"),
    INPUT,
    {},
    dependencies({ accountId: ACCOUNT_B, ledger, provider }),
  );

  assert.equal(unapproved.status, 403);
  assert.equal(provider.calls, 0);
  assert.equal(ledger.operations.length, 0);
});

test("100 simultaneous $0.01 reservations against $0.02 admit at most two", async () => {
  const ledger = new TestAiLedger();
  let releaseProvider!: () => void;
  const providerBarrier = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  const provider = {
    calls: 0,
    async dispatch() {
      this.calls += 1;
      await providerBarrier;
      return {
        completionTokens: 100,
        promptTokens: 500,
        providerRequestId: `financial-race-${this.calls}`,
        rewrite: "A bounded rewrite.",
      };
    },
  };
  const racePolicy = policy({
    accountConcurrency: 100,
    accountGenerationsPer24Hours: 100,
    accountGenerationsPerMinute: 100,
    betaLifetimeBudgetMicroUsd: 20_000,
    globalConcurrency: 100,
    globalGenerationsPerMinute: 100,
    hourlyBudgetMicroUsd: 20_000,
    lifetimeGenerationsPerAccount: 100,
    maxOperationMicroUsd: 10_000,
    maximumReservationMicroUsd: 10_000,
    rolling24HourBudgetMicroUsd: 20_000,
  });
  const tasks = Array.from({ length: 100 }, (_, index) => {
    const accountId = `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    ledger.approve(accountId);
    return executeGovernedRewrite(
      request(`financial-race-${String(index).padStart(4, "0")}`),
      INPUT,
      {},
      dependencies({ accountId, config: racePolicy, ledger, provider }),
    );
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(provider.calls, 2);
  assert.equal(ledger.snapshot().reservedMicroUsd, 20_000);
  releaseProvider();
  const results = await Promise.all(tasks);
  const admitted = results.filter((result) => result.status === 200).length;

  assert.equal(admitted, 2);
  assert.equal(provider.calls, 2);
  assert.equal(ledger.snapshot().reservedMicroUsd, 0);
  assert.equal(ledger.snapshot().settledMicroUsd, 136);
});

test("per-account concurrency one admits only one of fifty simultaneous requests", async () => {
  const ledger = new TestAiLedger();
  ledger.approve(ACCOUNT_A);
  let releaseProvider!: () => void;
  const barrier = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  const provider = {
    calls: 0,
    async dispatch() {
      this.calls += 1;
      await barrier;
      return {
        completionTokens: 100,
        promptTokens: 500,
        providerRequestId: "account-concurrency",
        rewrite: "A bounded rewrite.",
      };
    },
  };
  const concurrencyPolicy = policy({
    accountGenerationsPer24Hours: 100,
    accountGenerationsPerMinute: 100,
    betaLifetimeBudgetMicroUsd: 1_000_000,
    globalConcurrency: 50,
    globalGenerationsPerMinute: 100,
    hourlyBudgetMicroUsd: 1_000_000,
    lifetimeGenerationsPerAccount: 100,
    rolling24HourBudgetMicroUsd: 1_000_000,
  });
  const tasks = Array.from({ length: 50 }, (_, index) =>
    executeGovernedRewrite(
      request(`account-concurrency-${String(index).padStart(3, "0")}`),
      INPUT,
      {},
      dependencies({ config: concurrencyPolicy, ledger, provider }),
    ),
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(provider.calls, 1);
  releaseProvider();
  await Promise.all(tasks);
  assert.equal(provider.calls, 1);
  assert.deepEqual(ledger.snapshot(), { reservedMicroUsd: 0, settledMicroUsd: 68 });
});

test("global concurrency two admits only two accounts during a storm", async () => {
  const ledger = new TestAiLedger();
  let releaseProvider!: () => void;
  const barrier = new Promise<void>((resolve) => {
    releaseProvider = resolve;
  });
  const provider = {
    calls: 0,
    async dispatch() {
      this.calls += 1;
      await barrier;
      return {
        completionTokens: 100,
        promptTokens: 500,
        providerRequestId: "global-concurrency",
        rewrite: "A bounded rewrite.",
      };
    },
  };
  const concurrencyPolicy = policy({
    accountGenerationsPer24Hours: 100,
    accountGenerationsPerMinute: 100,
    betaLifetimeBudgetMicroUsd: 1_000_000,
    globalGenerationsPerMinute: 100,
    hourlyBudgetMicroUsd: 1_000_000,
    lifetimeGenerationsPerAccount: 100,
    rolling24HourBudgetMicroUsd: 1_000_000,
  });
  const tasks = Array.from({ length: 50 }, (_, index) => {
    const accountId = `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;
    ledger.approve(accountId);
    return executeGovernedRewrite(
      request(`global-concurrency-${String(index).padStart(3, "0")}`),
      INPUT,
      {},
      dependencies({ accountId, config: concurrencyPolicy, ledger, provider }),
    );
  });

  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(provider.calls, 2);
  releaseProvider();
  await Promise.all(tasks);
  assert.equal(provider.calls, 2);
  assert.deepEqual(ledger.snapshot(), { reservedMicroUsd: 0, settledMicroUsd: 136 });
});

test("lifetime allowance survives new sessions and repeated clients", async () => {
  const ledger = new TestAiLedger();
  const provider = new MockAiProvider();
  ledger.approve(ACCOUNT_A);
  const lifetimePolicy = policy({
    accountGenerationsPer24Hours: 100,
    accountGenerationsPerMinute: 100,
    globalGenerationsPerMinute: 100,
  });
  const results: GovernedGhostwriterResult[] = [];

  for (let index = 0; index < 11; index += 1) {
    results.push(
      await executeGovernedRewrite(
        request(`lifetime-generation-${String(index).padStart(3, "0")}`),
        INPUT,
        {},
        dependencies({ config: lifetimePolicy, ledger, provider }),
      ),
    );
  }

  assert.equal(results.filter((result) => result.status === 200).length, 10);
  assert.equal(provider.calls, 10);
  assert.equal(results.at(-1)?.status, 429);
  assert.deepEqual(ledger.snapshot(), { reservedMicroUsd: 0, settledMicroUsd: 680 });
});

test("same idempotency key replays once and different payload conflicts", async () => {
  const ledger = new TestAiLedger();
  const provider = new MockAiProvider();
  ledger.approve(ACCOUNT_A);
  const replayId = ["idempotency", "same", "0001"].join("-");
  const first = await executeGovernedRewrite(
    request(replayId),
    INPUT,
    {},
    dependencies({ ledger, provider }),
  );
  const replay = await executeGovernedRewrite(
    request(replayId),
    INPUT,
    {},
    dependencies({ ledger, provider }),
  );
  const conflict = await executeGovernedRewrite(
    request(replayId),
    { ...INPUT, text: "A different payload." },
    {},
    dependencies({ ledger, provider }),
  );

  assert.equal(first.status, 200);
  assert.equal(replay.status, 200);
  assert.equal(replay.operationId, first.operationId);
  assert.equal(conflict.status, 409);
  assert.equal(provider.calls, 1);
  assert.deepEqual(ledger.snapshot(), { reservedMicroUsd: 0, settledMicroUsd: 68 });
});

test("provider uncertainty and settlement failure retain full reservation and never retry", async () => {
  for (const mode of ["timeout", "disconnect", "provider-429", "provider-500", "malformed"] as const) {
    const ledger = new TestAiLedger();
    const provider = new MockAiProvider();
    ledger.approve(ACCOUNT_A);
    provider.mode = mode;
    const key = `uncertain-${mode}-0001`;

    const first = await executeGovernedRewrite(
      request(key),
      INPUT,
      {},
      dependencies({ ledger, provider }),
    );
    const replay = await executeGovernedRewrite(
      request(key),
      INPUT,
      {},
      dependencies({ ledger, provider }),
    );

    assert.equal(first.status, 502);
    assert.equal(replay.status, 409);
    assert.equal(provider.calls, 1);
    assert.equal(ledger.snapshot().reservedMicroUsd, policy().maximumReservationMicroUsd);
    assert.equal(ledger.snapshot().settledMicroUsd, 0);
  }

  const ledger = new TestAiLedger();
  const provider = new MockAiProvider();
  ledger.approve(ACCOUNT_A);
  ledger.failSettlement = true;
  const result = await executeGovernedRewrite(
    request("settlement-failure-0001"),
    INPUT,
    {},
    dependencies({ ledger, provider }),
  );

  assert.equal(result.status, 502);
  assert.equal(provider.calls, 1);
  assert.equal(ledger.snapshot().reservedMicroUsd, policy().maximumReservationMicroUsd);
});

test("budget outage, stale pricing, oversized input, and kill switch fail before provider", async () => {
  const cases: Array<{
    input?: GhostwriterInput;
    killSwitchEnabled?: () => boolean;
    ledger: TestAiLedger;
    resolution?: AiPolicyResolution;
  }> = [];
  const outageLedger = new TestAiLedger();
  outageLedger.approve(ACCOUNT_A);
  outageLedger.failReservations = true;
  cases.push({ ledger: outageLedger });

  const pricingLedger = new TestAiLedger();
  pricingLedger.approve(ACCOUNT_A);
  cases.push({
    ledger: pricingLedger,
    resolution: { config: null, enabled: false, reason: "pricing missing" },
  });

  const oversizedLedger = new TestAiLedger();
  oversizedLedger.approve(ACCOUNT_A);
  cases.push({ ledger: oversizedLedger, input: { ...INPUT, text: "x".repeat(2_100) } });

  const killedLedger = new TestAiLedger();
  killedLedger.approve(ACCOUNT_A);
  cases.push({ killSwitchEnabled: () => false, ledger: killedLedger });

  for (const [index, scenario] of cases.entries()) {
    const provider = new MockAiProvider();
    const deps = dependencies({
      killSwitchEnabled: scenario.killSwitchEnabled,
      ledger: scenario.ledger,
      provider,
    });

    if (scenario.resolution) {
      deps.resolvePolicy = () => scenario.resolution!;
    }

    const result = await executeGovernedRewrite(
      request(`fail-closed-case-${String(index).padStart(4, "0")}`),
      scenario.input ?? INPUT,
      {},
      deps,
    );

    assert.notEqual(result.status, 200);
    assert.equal(provider.calls, 0);
  }
});

test("the paid provider request is fixed server-side and all former lab calls are removed", () => {
  const providerSource = readFileSync(new URL("../src/server/ai-provider.ts", import.meta.url), "utf8");
  const routeSource = readFileSync(
    new URL("../src/app/api/ghostwriter/route.ts", import.meta.url),
    "utf8",
  );
  const labSource = readFileSync(
    new URL("../src/server/ghostwriter-lab.ts", import.meta.url),
    "utf8",
  );
  const serverSources = [
    ...typescriptSources(new URL("../src/server/", import.meta.url)),
    ...typescriptSources(new URL("../src/app/api/", import.meta.url)),
  ];
  const serverFetchFiles = serverSources
    .filter(({ source }) => /\bfetch\s*\(/.test(source))
    .map(({ path }) => path);

  assert.match(routeSource, /\.strict\(\)/);
  assert.match(providerSource, /model: options\.policy\.model/);
  assert.match(providerSource, /max_completion_tokens: options\.policy\.maxOutputTokens/);
  assert.doesNotMatch(providerSource, /options\.user\.model|options\.user\.max_tokens/);
  assert.deepEqual(serverFetchFiles.map(path => path.split("/").pop()).sort(), ["ai-provider.ts", "auth-session.ts"]);
  const authTransport = readFileSync(new URL("../src/server/auth-session.ts", import.meta.url), "utf8");
  assert.match(authTransport, /target.origin!==allowedOrigin/);
  assert.match(authTransport, /target.pathname.startsWith\("\/auth\/v1\/"\)/);
  assert.doesNotMatch(labSource, /fetch\(|Promise\.allSettled|evaluateCandidates/);
});

test("operation ownership and rendered output surfaces resist IDOR and script execution", async () => {
  const ledger = new TestAiLedger();
  ledger.approve(ACCOUNT_A, ACCOUNT_B);
  const reservation = await ledger.reserve({
    accountId: ACCOUNT_A,
    idempotencyKey: "idor-operation-00001",
    policy: policy(),
    requestFingerprint: "a".repeat(64),
  });

  assert.equal(reservation.kind, "admitted");
  if (reservation.kind !== "admitted") {
    throw new Error("expected reservation");
  }
  assert.equal(await ledger.markDispatched(reservation.operationId, ACCOUNT_B), false);

  const componentSource = readFileSync(
    new URL("../src/components/ghostwriter/RewritePlayback.tsx", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(componentSource, /dangerouslySetInnerHTML|\.innerHTML\s*=/);
});
