import { createHash } from "node:crypto";
import { getSupabaseAdmin } from "../integrations/supabase/client.server.ts";
import { resolveAbuseStoreConfig } from "../lib/security-env.ts";
import { logSecurityEvent } from "./security-events.ts";

export type AbuseRateRule = {
  keyHash: string;
  limit: number;
  windowMs: number;
};

export type AbuseRateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type AbuseStore = {
  applyPenalty(keyHashes: string[], severity: number, currentTime: number): Promise<number>;
  consumeChallenge(challengeHash: string, expiresAt: number, currentTime: number): Promise<boolean>;
  consumeRateLimits(
    rules: AbuseRateRule[],
    penaltyKeyHashes: string[],
    currentTime: number,
  ): Promise<AbuseRateLimitResult>;
};

type MemoryBucketState = {
  hits: number[];
  windowMs: number;
};

type MemoryPenaltyState = {
  blockedUntil: number;
  score: number;
  updatedAt: number;
};

type MemoryAbuseState = {
  buckets: Map<string, MemoryBucketState>;
  penalties: Map<string, MemoryPenaltyState>;
  usedChallenges: Map<string, number>;
};

declare global {
  var __ghostwriterAbuseMemoryStore: MemoryAbuseState | undefined;
}

let cachedStore: AbuseStore | null = null;

function clampSeverity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(12, Math.trunc(value)));
}

function penaltyWindowSeconds(score: number): number {
  if (score >= 9) {
    return 60 * 60;
  }

  if (score >= 6) {
    return 15 * 60;
  }

  if (score >= 3) {
    return 5 * 60;
  }

  return 60;
}

function ensureMemoryState(): MemoryAbuseState {
  if (!globalThis.__ghostwriterAbuseMemoryStore) {
    globalThis.__ghostwriterAbuseMemoryStore = {
      buckets: new Map(),
      penalties: new Map(),
      usedChallenges: new Map(),
    };
  }

  return globalThis.__ghostwriterAbuseMemoryStore;
}

function pruneMemoryState(state: MemoryAbuseState, currentTime: number) {
  for (const [key, bucket] of state.buckets) {
    bucket.hits = bucket.hits.filter((hit) => currentTime - hit < bucket.windowMs);

    if (bucket.hits.length === 0) {
      state.buckets.delete(key);
    }
  }

  for (const [key, penalty] of state.penalties) {
    if (penalty.blockedUntil <= currentTime && currentTime - penalty.updatedAt > 60 * 60 * 1000) {
      state.penalties.delete(key);
    }
  }

  for (const [key, expiresAt] of state.usedChallenges) {
    if (expiresAt <= currentTime) {
      state.usedChallenges.delete(key);
    }
  }
}

function parseSupabaseConsumeResult(value: unknown): AbuseRateLimitResult {
  if (!value || typeof value !== "object") {
    throw new Error("Abuse consume RPC returned an invalid payload.");
  }

  const payload = value as { allowed?: unknown; retry_after_seconds?: unknown };

  return {
    allowed: payload.allowed === true,
    retryAfterSeconds: Math.max(
      0,
      Number.isFinite(payload.retry_after_seconds)
        ? Number(payload.retry_after_seconds)
        : Number.parseInt(String(payload.retry_after_seconds ?? "0"), 10) || 0,
    ),
  };
}

class MemoryAbuseStore implements AbuseStore {
  async applyPenalty(keyHashes: string[], severity: number, currentTime: number): Promise<number> {
    const state = ensureMemoryState();
    pruneMemoryState(state, currentTime);

    let retryAfterSeconds = 0;
    const increment = clampSeverity(severity);

    for (const keyHash of keyHashes) {
      const existing = state.penalties.get(keyHash);
      const stale = !existing || currentTime - existing.updatedAt > 60 * 60 * 1000;
      const nextScore = Math.min(12, (stale ? 0 : existing.score) + increment);
      const blockedUntil = Math.max(
        existing?.blockedUntil ?? 0,
        currentTime + penaltyWindowSeconds(nextScore) * 1000,
      );

      state.penalties.set(keyHash, {
        blockedUntil,
        score: nextScore,
        updatedAt: currentTime,
      });

      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        Math.max(1, Math.ceil((blockedUntil - currentTime) / 1000)),
      );
    }

    return retryAfterSeconds;
  }

  async consumeChallenge(
    challengeHash: string,
    expiresAt: number,
    currentTime: number,
  ): Promise<boolean> {
    if (expiresAt <= currentTime) {
      return false;
    }

    const state = ensureMemoryState();
    pruneMemoryState(state, currentTime);

    const existing = state.usedChallenges.get(challengeHash);

    if (existing && existing > currentTime) {
      return false;
    }

    state.usedChallenges.set(challengeHash, expiresAt);
    return true;
  }

  async consumeRateLimits(
    rules: AbuseRateRule[],
    penaltyKeyHashes: string[],
    currentTime: number,
  ): Promise<AbuseRateLimitResult> {
    const state = ensureMemoryState();
    pruneMemoryState(state, currentTime);

    let retryAfterSeconds = 0;

    for (const keyHash of penaltyKeyHashes) {
      const penalty = state.penalties.get(keyHash);

      if (!penalty || penalty.blockedUntil <= currentTime) {
        continue;
      }

      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        Math.max(1, Math.ceil((penalty.blockedUntil - currentTime) / 1000)),
      );
    }

    if (retryAfterSeconds > 0) {
      return { allowed: false, retryAfterSeconds };
    }

    for (const rule of rules) {
      const bucket = state.buckets.get(rule.keyHash) ?? {
        hits: [],
        windowMs: rule.windowMs,
      };

      bucket.windowMs = rule.windowMs;
      bucket.hits = bucket.hits.filter((hit) => currentTime - hit < rule.windowMs);
      bucket.hits.push(currentTime);
      state.buckets.set(rule.keyHash, bucket);

      if (bucket.hits.length > rule.limit) {
        const oldestHit = bucket.hits[0] ?? currentTime;
        retryAfterSeconds = Math.max(
          retryAfterSeconds,
          Math.max(1, Math.ceil((oldestHit + rule.windowMs - currentTime) / 1000)),
        );
      }
    }

    return {
      allowed: retryAfterSeconds === 0,
      retryAfterSeconds,
    };
  }
}

class SupabaseAbuseStore implements AbuseStore {
  async applyPenalty(keyHashes: string[], severity: number, currentTime: number): Promise<number> {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      throw new Error("Supabase admin client unavailable for abuse store.");
    }

    const { data, error } = await ((supabase.rpc as unknown) as (...args: unknown[]) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>)("ghostwriter_abuse_apply_penalty", {
      p_key_hashes: keyHashes,
      p_now: new Date(currentTime).toISOString(),
      p_severity: clampSeverity(severity),
    });

    if (error) {
      throw new Error(error.message);
    }

    return Math.max(0, Number.parseInt(String(data ?? "0"), 10) || 0);
  }

  async consumeChallenge(
    challengeHash: string,
    expiresAt: number,
    currentTime: number,
  ): Promise<boolean> {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      throw new Error("Supabase admin client unavailable for abuse store.");
    }

    const { data, error } = await ((supabase.rpc as unknown) as (...args: unknown[]) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>)("ghostwriter_abuse_consume_challenge", {
      p_challenge_hash: challengeHash,
      p_expires_at: new Date(expiresAt).toISOString(),
      p_now: new Date(currentTime).toISOString(),
    });

    if (error) {
      throw new Error(error.message);
    }

    return data === true;
  }

  async consumeRateLimits(
    rules: AbuseRateRule[],
    penaltyKeyHashes: string[],
    currentTime: number,
  ): Promise<AbuseRateLimitResult> {
    const supabase = getSupabaseAdmin();

    if (!supabase) {
      throw new Error("Supabase admin client unavailable for abuse store.");
    }

    const { data, error } = await ((supabase.rpc as unknown) as (...args: unknown[]) => Promise<{
      data: unknown;
      error: { message: string } | null;
    }>)("ghostwriter_abuse_consume", {
      p_now: new Date(currentTime).toISOString(),
      p_penalty_key_hashes: penaltyKeyHashes,
      p_rules: rules,
    });

    if (error) {
      throw new Error(error.message);
    }

    return parseSupabaseConsumeResult(data);
  }
}

export function hashAbuseKey(kind: string, value: string): string {
  return createHash("sha256").update(`${kind}:${value}`).digest("hex");
}

export function resolveAbuseStore(): AbuseStore {
  if (cachedStore) {
    return cachedStore;
  }

  const resolution = resolveAbuseStoreConfig({
    mode: process.env.GHOSTWRITER_ABUSE_STORE_MODE,
    nodeEnv: process.env.NODE_ENV,
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    supabaseUrl: process.env.SUPABASE_URL,
  });

  if (!resolution.mode) {
    throw new Error(resolution.reason ?? "Abuse store configuration unavailable.");
  }

  cachedStore =
    resolution.mode === "supabase" ? new SupabaseAbuseStore() : new MemoryAbuseStore();

  return cachedStore;
}

export async function consumeAbuseRateLimits(
  rules: AbuseRateRule[],
  penaltyKeyHashes: string[],
  currentTime: number,
): Promise<AbuseRateLimitResult> {
  return resolveAbuseStore().consumeRateLimits(rules, penaltyKeyHashes, currentTime);
}

export async function consumeChallengeToken(
  challengeHash: string,
  expiresAt: number,
  currentTime: number,
): Promise<boolean> {
  return resolveAbuseStore().consumeChallenge(challengeHash, expiresAt, currentTime);
}

export async function escalatePenalty(
  keyHashes: string[],
  severity: number,
  currentTime: number,
): Promise<number> {
  return resolveAbuseStore().applyPenalty(keyHashes, severity, currentTime);
}

export function __resetAbuseStoreForTests() {
  cachedStore = null;
  globalThis.__ghostwriterAbuseMemoryStore = undefined;
}

export function logAbuseStoreFailure(location: string, error: unknown) {
  logSecurityEvent("abuse_store_error", {
    error: error instanceof Error ? error.message : "unknown",
    location,
  });
}
