/** Shared wire contract. The authoritative limit and clock live in PostgreSQL. */
export const COMBINED_AI_LIMIT_SQLSTATE = "GW429";
export const COMBINED_AI_LIMIT_REASON = "global_combined_limit";
export const COMBINED_AI_LIMIT_MESSAGE =
  "The free demo’s shared rewrite capacity is temporarily used up. Signing in or switching accounts will not increase it. Please try again later. Your text stays here.";

export function safeCombinedRetryAfter(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 86_400
    ? value
    : 60;
}

export class CombinedAiLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: unknown = 60) {
    super(COMBINED_AI_LIMIT_REASON);
    this.name = "CombinedAiLimitError";
    this.retryAfterSeconds = safeCombinedRetryAfter(retryAfterSeconds);
  }
}

/** Parse only our fixed SQLSTATE; never expose a database error or arbitrary details. */
export function combinedAiLimitError(error: unknown): CombinedAiLimitError | null {
  if (!error || typeof error !== "object" || Array.isArray(error)) return null;
  const candidate = error as Record<string, unknown>;
  if (candidate.code !== COMBINED_AI_LIMIT_SQLSTATE) return null;

  let retryAfterSeconds: unknown = 60;
  if (typeof candidate.details === "string" && candidate.details.length <= 512) {
    try {
      const details: unknown = JSON.parse(candidate.details);
      if (details && typeof details === "object" && !Array.isArray(details)) {
        retryAfterSeconds = (details as Record<string, unknown>).retryAfterSeconds;
      }
    } catch {
      // A malformed hint cannot turn a denied request into an allowed request.
    }
  }
  return new CombinedAiLimitError(retryAfterSeconds);
}
