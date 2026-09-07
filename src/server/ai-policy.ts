import "../lib/server-only.ts";

export const AI_PROVIDER_ID = "groq" as const;
export const AI_MODEL_ID = "openai/gpt-oss-20b" as const;
export const AI_PRICING_VERSION = "groq-openai-gpt-oss-20b-2026-09-07" as const;
export const AI_INPUT_MICRO_USD_PER_MILLION_TOKENS = 75_000;
export const AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS = 300_000;
export const MICRO_USD_PER_USD = 1_000_000;

const DEFAULTS = {
  accountConcurrency: 1,
  accountGenerationsPer24Hours: 5,
  accountGenerationsPerMinute: 3,
  betaLifetimeBudgetMicroUsd: 10_000_000,
  globalConcurrency: 2,
  globalGenerationsPerMinute: 10,
  hourlyBudgetMicroUsd: 500_000,
  lifetimeGenerationsPerAccount: 10,
  maxApprovedAccounts: 25,
  maxInputTokens: 2_000,
  maxOperationMicroUsd: 10_000,
  maxOutputTokens: 2_000,
  requestBodyBytes: 10_000,
  requestTimeoutMs: 30_000,
  rolling24HourBudgetMicroUsd: 2_000_000,
} as const;

const LIMITS = DEFAULTS;

const CHAT_TEMPLATE_TOKEN_OVERHEAD = 256;
const PLACEHOLDER_VALUE = /change_me|placeholder|example|replace_me|todo|ci-placeholder/i;

export type AiPolicyConfig = {
  accountConcurrency: number;
  accountGenerationsPer24Hours: number;
  accountGenerationsPerMinute: number;
  betaLifetimeBudgetMicroUsd: number;
  fingerprintSecret: string;
  globalConcurrency: number;
  globalGenerationsPerMinute: number;
  hourlyBudgetMicroUsd: number;
  lifetimeGenerationsPerAccount: number;
  maxApprovedAccounts: number;
  maxInputTokens: number;
  maxOperationMicroUsd: number;
  maxOutputTokens: number;
  maximumReservationMicroUsd: number;
  model: typeof AI_MODEL_ID;
  pricingVersion: typeof AI_PRICING_VERSION;
  provider: typeof AI_PROVIDER_ID;
  providerApiKey: string;
  providerUrl: "https://api.groq.com/openai/v1/chat/completions";
  requestBodyBytes: number;
  requestTimeoutMs: number;
  rolling24HourBudgetMicroUsd: number;
};

export type AiPolicyResolution =
  | { config: AiPolicyConfig; enabled: true; reason: null }
  | { config: null; enabled: false; reason: string };

type AiPolicyEnvironment = Record<string, string | undefined>;

function enabled(raw: string | undefined): boolean {
  return raw?.trim().toLowerCase() === "true";
}

function positiveInteger(
  environment: AiPolicyEnvironment,
  key: string,
  fallback: number,
): number | null {
  const raw = environment[key]?.trim();

  if (!raw) {
    return fallback;
  }

  if (!/^\d+$/.test(raw)) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - BigInt(1)) / denominator;
}

export function calculateMaximumAiCostMicroUsd(options: {
  maxInputTokens: number;
  maxOutputTokens: number;
}): number {
  const input = ceilDiv(
    BigInt(options.maxInputTokens) * BigInt(AI_INPUT_MICRO_USD_PER_MILLION_TOKENS),
    BigInt(1_000_000),
  );
  const output = ceilDiv(
    BigInt(options.maxOutputTokens) * BigInt(AI_OUTPUT_MICRO_USD_PER_MILLION_TOKENS),
    BigInt(1_000_000),
  );
  const total = input + output;

  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error("AI cost exceeds safe integer range");
  }

  return Number(total);
}

export function calculateActualAiCostMicroUsd(options: {
  completionTokens: number;
  promptTokens: number;
}): number | null {
  if (
    !Number.isSafeInteger(options.promptTokens) ||
    !Number.isSafeInteger(options.completionTokens) ||
    options.promptTokens < 0 ||
    options.completionTokens < 0
  ) {
    return null;
  }

  return calculateMaximumAiCostMicroUsd({
    maxInputTokens: options.promptTokens,
    maxOutputTokens: options.completionTokens,
  });
}

export function conservativeInputTokenUpperBound(system: string, user: string): number {
  return Buffer.byteLength(system, "utf8") + Buffer.byteLength(user, "utf8") + CHAT_TEMPLATE_TOKEN_OVERHEAD;
}

export function resolveAiPolicyConfig(
  environment: AiPolicyEnvironment = process.env,
): AiPolicyResolution {
  if (!enabled(environment.AI_ENABLED)) {
    return {
      config: null,
      enabled: false,
      reason: "AI is disabled by the server kill switch.",
    };
  }

  const provider = environment.GHOSTWRITER_PROVIDER?.trim();
  const model = environment.GROQ_MODEL?.trim();
  const pricingVersion = environment.GHOSTWRITER_AI_PRICING_VERSION?.trim();
  const providerApiKey = environment.GROQ_API_KEY?.trim() ?? "";
  const fingerprintSecret = environment.GHOSTWRITER_SECURITY_SECRET?.trim() ?? "";

  if (provider !== AI_PROVIDER_ID) {
    return { config: null, enabled: false, reason: "The AI provider is not explicitly allowlisted." };
  }

  if (model !== AI_MODEL_ID) {
    return { config: null, enabled: false, reason: "The AI model is not explicitly allowlisted." };
  }

  if (pricingVersion !== AI_PRICING_VERSION) {
    return { config: null, enabled: false, reason: "AI pricing is missing, stale, or unrecognized." };
  }

  if (!providerApiKey || PLACEHOLDER_VALUE.test(providerApiKey)) {
    return { config: null, enabled: false, reason: "The AI provider credential is unavailable." };
  }

  if (fingerprintSecret.length < 32 || PLACEHOLDER_VALUE.test(fingerprintSecret)) {
    return { config: null, enabled: false, reason: "The request fingerprint secret is unavailable." };
  }

  if (
    environment.GHOSTWRITER_ABUSE_STORE_MODE?.trim() !== "supabase" ||
    !environment.SUPABASE_URL?.trim() ||
    !environment.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    !environment.SUPABASE_PUBLISHABLE_KEY?.trim()
  ) {
    return { config: null, enabled: false, reason: "The durable AI control datastore is unavailable." };
  }

  const values = {
    accountConcurrency: positiveInteger(
      environment,
      "GHOSTWRITER_AI_ACCOUNT_CONCURRENCY",
      DEFAULTS.accountConcurrency,
    ),
    accountGenerationsPer24Hours: positiveInteger(
      environment,
      "GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_24H",
      DEFAULTS.accountGenerationsPer24Hours,
    ),
    accountGenerationsPerMinute: positiveInteger(
      environment,
      "GHOSTWRITER_AI_ACCOUNT_GENERATIONS_PER_MINUTE",
      DEFAULTS.accountGenerationsPerMinute,
    ),
    betaLifetimeBudgetMicroUsd: positiveInteger(
      environment,
      "GHOSTWRITER_AI_BETA_LIFETIME_BUDGET_MICRO_USD",
      DEFAULTS.betaLifetimeBudgetMicroUsd,
    ),
    globalConcurrency: positiveInteger(
      environment,
      "GHOSTWRITER_AI_GLOBAL_CONCURRENCY",
      DEFAULTS.globalConcurrency,
    ),
    globalGenerationsPerMinute: positiveInteger(
      environment,
      "GHOSTWRITER_AI_GLOBAL_GENERATIONS_PER_MINUTE",
      DEFAULTS.globalGenerationsPerMinute,
    ),
    hourlyBudgetMicroUsd: positiveInteger(
      environment,
      "GHOSTWRITER_AI_HOURLY_BUDGET_MICRO_USD",
      DEFAULTS.hourlyBudgetMicroUsd,
    ),
    lifetimeGenerationsPerAccount: positiveInteger(
      environment,
      "GHOSTWRITER_AI_LIFETIME_GENERATIONS_PER_ACCOUNT",
      DEFAULTS.lifetimeGenerationsPerAccount,
    ),
    maxApprovedAccounts: positiveInteger(
      environment,
      "GHOSTWRITER_BETA_MAX_APPROVED_ACCOUNTS",
      DEFAULTS.maxApprovedAccounts,
    ),
    maxInputTokens: positiveInteger(
      environment,
      "GHOSTWRITER_AI_MAX_INPUT_TOKENS",
      DEFAULTS.maxInputTokens,
    ),
    maxOperationMicroUsd: positiveInteger(
      environment,
      "GHOSTWRITER_AI_MAX_OPERATION_MICRO_USD",
      DEFAULTS.maxOperationMicroUsd,
    ),
    maxOutputTokens: positiveInteger(
      environment,
      "GHOSTWRITER_AI_MAX_OUTPUT_TOKENS",
      DEFAULTS.maxOutputTokens,
    ),
    requestBodyBytes: positiveInteger(
      environment,
      "GHOSTWRITER_AI_REQUEST_BODY_BYTES",
      DEFAULTS.requestBodyBytes,
    ),
    requestTimeoutMs: positiveInteger(
      environment,
      "GHOSTWRITER_AI_REQUEST_TIMEOUT_MS",
      DEFAULTS.requestTimeoutMs,
    ),
    rolling24HourBudgetMicroUsd: positiveInteger(
      environment,
      "GHOSTWRITER_AI_24H_BUDGET_MICRO_USD",
      DEFAULTS.rolling24HourBudgetMicroUsd,
    ),
  };

  if (Object.values(values).some((value) => value === null)) {
    return { config: null, enabled: false, reason: "One or more AI limits are invalid." };
  }

  const safeValues = values as { [Key in keyof typeof values]: number };

  if (
    safeValues.accountConcurrency > LIMITS.accountConcurrency ||
    safeValues.accountGenerationsPer24Hours > LIMITS.accountGenerationsPer24Hours ||
    safeValues.accountGenerationsPerMinute > LIMITS.accountGenerationsPerMinute ||
    safeValues.betaLifetimeBudgetMicroUsd > LIMITS.betaLifetimeBudgetMicroUsd ||
    safeValues.globalConcurrency > LIMITS.globalConcurrency ||
    safeValues.globalGenerationsPerMinute > LIMITS.globalGenerationsPerMinute ||
    safeValues.hourlyBudgetMicroUsd > LIMITS.hourlyBudgetMicroUsd ||
    safeValues.lifetimeGenerationsPerAccount > LIMITS.lifetimeGenerationsPerAccount ||
    safeValues.maxApprovedAccounts > LIMITS.maxApprovedAccounts ||
    safeValues.maxInputTokens > LIMITS.maxInputTokens ||
    safeValues.maxOperationMicroUsd > LIMITS.maxOperationMicroUsd ||
    safeValues.maxOutputTokens > LIMITS.maxOutputTokens ||
    safeValues.requestBodyBytes !== LIMITS.requestBodyBytes ||
    safeValues.requestTimeoutMs > LIMITS.requestTimeoutMs ||
    safeValues.rolling24HourBudgetMicroUsd > LIMITS.rolling24HourBudgetMicroUsd
  ) {
    return { config: null, enabled: false, reason: "An AI safety limit exceeds the audited maximum." };
  }

  const maximumReservationMicroUsd = calculateMaximumAiCostMicroUsd({
    maxInputTokens: safeValues.maxInputTokens,
    maxOutputTokens: safeValues.maxOutputTokens,
  });

  if (
    maximumReservationMicroUsd > safeValues.maxOperationMicroUsd ||
    safeValues.maxOperationMicroUsd > safeValues.hourlyBudgetMicroUsd ||
    safeValues.hourlyBudgetMicroUsd > safeValues.rolling24HourBudgetMicroUsd ||
    safeValues.rolling24HourBudgetMicroUsd > safeValues.betaLifetimeBudgetMicroUsd
  ) {
    return { config: null, enabled: false, reason: "The configured AI cost bounds are internally inconsistent." };
  }

  return {
    config: {
      ...safeValues,
      fingerprintSecret,
      maximumReservationMicroUsd,
      model: AI_MODEL_ID,
      pricingVersion: AI_PRICING_VERSION,
      provider: AI_PROVIDER_ID,
      providerApiKey,
      providerUrl: "https://api.groq.com/openai/v1/chat/completions",
    },
    enabled: true,
    reason: null,
  };
}

export function isAiKillSwitchEnabled(environment: AiPolicyEnvironment = process.env): boolean {
  return enabled(environment.AI_ENABLED);
}
