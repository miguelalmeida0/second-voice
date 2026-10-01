import "../lib/server-only.ts";

import { createHmac } from "node:crypto";
import { z } from "zod";
import { authenticateRewritePrincipal, type AiAuthenticationResult } from "./ai-auth.ts";
import { SupabaseAiLedger, type AiLedger, type StoredAiResult } from "./ai-ledger.ts";
import {
  calculateActualAiCostMicroUsd,
  conservativeInputTokenUpperBound,
  isAiKillSwitchEnabled,
  resolveLiveAiPolicy,
  type AiPolicyConfig,
  type AiPolicyResolution,
} from "./ai-policy.ts";
import {
  AiProviderDispatchError,
  dispatchRewriteToProvider,
  type AiProviderResult,
} from "./ai-provider.ts";
import {
  buildOutcomePrompt,
  buildPrompt,
  finalizeRewrite,
  type GhostwriterInput,
  type GhostwriterResult,
} from "./ghostwriter.ts";
import { logSecurityEvent } from "./security-events.ts";
import { CombinedAiLimitError, COMBINED_AI_LIMIT_MESSAGE, COMBINED_AI_LIMIT_REASON, safeCombinedRetryAfter } from "../lib/combined-ai-limit.ts";

const IdempotencyKeySchema = z
  .string()
  .min(16)
  .max(80)
  .regex(/^[A-Za-z0-9._:-]+$/);

const StoredGhostwriterResultSchema = z.object({
  artifactToken: z.string().nullable(),
  error: z.string().nullable(),
  moodLabel: z.string(),
  rewrite: z.string(),
  shortId: z.string().nullable(),
  status: z.number().int(),
});

export type GovernedGhostwriterResult = GhostwriterResult & {
  operationId: string | null;
  reasonCode?: string;
  retryAfterSeconds?: number;
};

type GatewayDependencies = {
  authenticate: (request: Request) => Promise<AiAuthenticationResult>;
  dispatch: (options: {
    policy: AiPolicyConfig;
    system: string;
    user: string;
  }) => Promise<AiProviderResult>;
  finalize: typeof finalizeRewrite;
  killSwitchEnabled: () => boolean;
  ledger: AiLedger;
  resolvePolicy: () => AiPolicyResolution;
};

const DEFAULT_DEPENDENCIES: GatewayDependencies = {
  authenticate: authenticateRewritePrincipal,
  dispatch: dispatchRewriteToProvider,
  finalize: finalizeRewrite,
  killSwitchEnabled: () => isAiKillSwitchEnabled(),
  ledger: new SupabaseAiLedger(),
  resolvePolicy: () => resolveLiveAiPolicy(),
};

function failure(
  moodLabel: string,
  error: string,
  status: number,
  operationId: string | null = null,
  reasonCode?: string,
): GovernedGhostwriterResult {
  return {
    artifactToken: null,
    error,
    moodLabel,
    operationId,
    ...(reasonCode ? { reasonCode } : {}),
    rewrite: "",
    shortId: null,
    status,
  };
}

function requestFingerprint(
  input: GhostwriterInput,
  pricingVersion: string,
  secret: string,
): string {
  const canonical = JSON.stringify({
    author: input.author,
    mode: input.mode,
    mood: input.mood,
    outcome: input.outcome,
    pricingVersion,
    sharePublicly: input.sharePublicly === true,
    text: input.text,
  });

  return createHmac("sha256", secret).update(canonical).digest("hex");
}

function denial(reason: string, moodLabel: string, retryAfterSeconds?: number): GovernedGhostwriterResult {
  if (reason === COMBINED_AI_LIMIT_REASON) return {
    ...failure(moodLabel, COMBINED_AI_LIMIT_MESSAGE, 429, null, "GLOBAL_CAPACITY"),
    retryAfterSeconds: safeCombinedRetryAfter(retryAfterSeconds),
  };
  if (["account_minute_limit", "global_minute_limit"].includes(reason)) return {
    ...failure(
      moodLabel,
      "Please wait 60 seconds before another rewrite. Your text has been kept and no rewrite was used.",
      429,
      null,
      "BURST_COOLDOWN",
    ),
    retryAfterSeconds: 60,
  };
  if (reason === "account_day_limit") return failure(moodLabel, "Your rolling 24-hour rewrite allowance is used. Try again when an earlier successful rewrite leaves that window. Your text has been kept.", 429, null, "USER_QUOTA");
  if (reason === "anonymous_day_limit") return failure(moodLabel, "Free rewrites are used for today. Try again tomorrow. Your text has been kept.", 429, null, "USER_QUOTA");
  if (reason === "global_day_limit") return failure(moodLabel, "Today’s free demo capacity has been used. Try again tomorrow. Your text has been kept.", 429, null, "GLOBAL_CAPACITY");
  if (["service_paused","unresolved_liability"].includes(reason)) return failure(moodLabel,"Free rewriting is temporarily paused. Your text has been kept.",503,null,"SERVICE_UNAVAILABLE");
  if (reason === "session_revoked") return failure(moodLabel,"Your session expired or was signed out. Sign in again; your text has been kept.",401,null,"SESSION_EXPIRED");
  if (["account_lifetime_limit","global_lifetime_limit","trial_capacity","trial_already_claimed"].includes(reason)) return failure(moodLabel,"This limited portfolio trial has reached its lifetime allowance. Your text has been kept.",429,null,"USER_QUOTA");
  if (reason === "not_entitled" || reason === "entitlement_expired") {
    return failure(moodLabel, "Sign in to claim an available trial. Trial access may be full or revoked.", 403, null, "NOT_ENTITLED");
  }

  if (reason.includes("budget")) {
    return failure(moodLabel, "The beta AI budget is currently unavailable.", 503, null, "SERVICE_UNAVAILABLE");
  }

  return failure(moodLabel, "Live rewrite allowance reached. Try again later.", 429, null, "USER_QUOTA");
}

function replayResult(
  stored: StoredAiResult | null,
  moodLabel: string,
  operationId: string,
): GovernedGhostwriterResult {
  const parsed = StoredGhostwriterResultSchema.safeParse(stored);

  if (!parsed.success || parsed.data.status !== 200 || parsed.data.error !== null) {
    return failure(
      moodLabel,
      "A previous attempt exists but cannot be replayed safely.",
      409,
      operationId,
    );
  }

  return {
    ...parsed.data,
    operationId,
  };
}

async function preserveReservationAsUncertain(
  dependencies: GatewayDependencies,
  operationId: string,
  accountId: string,
  reason: string,
  requestId?: string,
) {
  try {
    await dependencies.ledger.markUncertain(operationId, accountId, reason);
  } catch {
    // A dispatched or reserved row is itself conservatively counted at the full reservation.
  }

  logSecurityEvent("ai_operation_uncertain", {
    accountId,
    operationId,
    reason,
    requestId,
  });
}

export async function executeGovernedRewrite(
  request: Request,
  input: GhostwriterInput,
  context: { requestId?: string } = {},
  dependencyOverrides: Partial<GatewayDependencies> = {},
): Promise<GovernedGhostwriterResult> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...dependencyOverrides };
  const policyResolution = dependencies.resolvePolicy();
  const prompt =
    input.mode === "outcome"
      ? (() => {
          const outcome = buildOutcomePrompt(input.outcome);
          return { moodLabel: outcome.outcomeLabel, system: outcome.system };
        })()
      : buildPrompt(input.author, input.mood);

  if (!policyResolution.enabled) {
    return failure(prompt.moodLabel, "Live rewriting is disabled.", 503);
  }

  const authentication = await dependencies.authenticate(request);

  if (!authentication.ok) {
    return failure(prompt.moodLabel, authentication.error, authentication.status);
  }

  const idempotencyKey = IdempotencyKeySchema.safeParse(request.headers.get("idempotency-key"));

  if (!idempotencyKey.success) {
    return failure(prompt.moodLabel, "A valid idempotency key is required.", 400);
  }

  const { config } = policyResolution;
  const conservativeInputTokens = conservativeInputTokenUpperBound(prompt.system, input.text);

  if (conservativeInputTokens > config.maxInputTokens) {
    return failure(prompt.moodLabel, "The passage is too large for the audited AI limit.", 413);
  }

  let reservation;

  try {
    reservation = await dependencies.ledger.reserve({
      accountId: authentication.identity.accountId,
      principalType: authentication.identity.principalType ?? "authenticated",
      sessionId: authentication.identity.sessionId,
      idempotencyKey: idempotencyKey.data,
      policy: config,
      requestFingerprint: requestFingerprint(
        input,
        config.pricingVersion,
        config.fingerprintSecret,
      ),
    });
  } catch {
    return failure(prompt.moodLabel, "AI budget controls are temporarily unavailable.", 503);
  }

  if (reservation.kind === "conflict") {
    return failure(
      prompt.moodLabel,
      "That idempotency key was already used for a different request.",
      409,
      reservation.operationId,
    );
  }

  if (reservation.kind === "denied") {
    return denial(reservation.reason, prompt.moodLabel, reservation.retryAfterSeconds);
  }

  if (reservation.kind === "replay") {
    const current = await dependencies.authenticate(request);
    if (!current.ok || current.identity.accountId !== authentication.identity.accountId || current.identity.sessionId !== authentication.identity.sessionId) {
      return failure(prompt.moodLabel, "Your session is no longer available. No result was returned.", 401);
    }
    if (reservation.state === "settled" && reservation.outcome === "succeeded") {
      return replayResult(reservation.result, prompt.moodLabel, reservation.operationId);
    }

    return failure(
      prompt.moodLabel,
      reservation.state === "uncertain" || reservation.state === "dispatched"
        ? "The provider status of the previous attempt is uncertain; it will not be regenerated."
        : "The previous attempt is still pending or failed; it will not be regenerated.",
      409,
      reservation.operationId,
    );
  }

  const operationId = reservation.operationId;
  const accountId = authentication.identity.accountId;

  if (!dependencies.killSwitchEnabled()) {
    try {
      await dependencies.ledger.failBeforeDispatch(operationId, accountId, "kill_switch_disabled");
    } catch {
      // The reservation remains charged until reconciliation if release cannot be persisted.
    }
    return failure(prompt.moodLabel, "Live rewriting is disabled.", 503, operationId);
  }

  try {
    const markedDispatched = await dependencies.ledger.markDispatched(operationId, accountId);

    if (!markedDispatched) {
      await dependencies.ledger.failBeforeDispatch(operationId, accountId, "dispatch_claim_denied").catch(() => undefined);
      return failure(prompt.moodLabel,"AI budget controls are temporarily unavailable.",503,operationId);
    }
  } catch (error) {
    if (error instanceof CombinedAiLimitError) {
      // The dispatch transaction rolled back: no provider authorization was issued.
      // Release only this undispatched reservation; never refund a dispatch stamp.
      await dependencies.ledger.failBeforeDispatch(operationId, accountId, "combined_global_limit")
        .catch(() => undefined);
      return {
        ...denial(COMBINED_AI_LIMIT_REASON, prompt.moodLabel, error.retryAfterSeconds),
        operationId,
      };
    }
    return failure(
      prompt.moodLabel,
      "AI budget controls are temporarily unavailable.",
      503,
      operationId,
    );
  }

  if (!dependencies.killSwitchEnabled()) {
    try {
      await dependencies.ledger.failBeforeDispatch(operationId, accountId, "kill_switch_disabled");
    } catch {
      // The full reservation remains accounted for if the datastore is unavailable.
    }
    return failure(prompt.moodLabel, "Live rewriting is disabled.", 503, operationId);
  }

  let providerResult: AiProviderResult;

  try {
    providerResult = await dependencies.dispatch({
      policy: config,
      system: prompt.system,
      user: input.text,
    });
  } catch (error) {
    const providerError = error instanceof AiProviderDispatchError ? error : null;
    const reason = providerError?.code ?? "provider_dispatch_failed";
    const knownProviderRejection = providerError !== null && [
      "provider_rate_limited",
      "provider_rejected",
      "provider_unavailable",
    ].includes(providerError.code);

    logSecurityEvent("ai_provider_error", {
      reason,
      ...(providerError?.status ? { status: providerError.status } : {}),
      ...(providerError?.retryAfterSeconds ? { retryAfter: providerError.retryAfterSeconds } : {}),
      requestId: context.requestId,
    });

    if (knownProviderRejection && providerError) {
      try {
        const settled = await dependencies.ledger.settleKnownFailure(operationId, accountId, reason);
        if (!settled) throw new Error("known_failure_settlement_rejected");
      } catch {
        await preserveReservationAsUncertain(
          dependencies,
          operationId,
          accountId,
          reason,
          context.requestId,
        );
        return failure(
          prompt.moodLabel,
          "The writing model did not complete the rewrite and accounting could not be finalized safely.",
          502,
          operationId,
          "SERVICE_UNAVAILABLE",
        );
      }

      if (providerError.code === "provider_rate_limited") {
        return {
          ...failure(
            prompt.moodLabel,
            "The writing model is temporarily busy. Your rewrite was not used. Try again shortly.",
            503,
            operationId,
            "PROVIDER_BUSY",
          ),
          ...(providerError.retryAfterSeconds ? { retryAfterSeconds: providerError.retryAfterSeconds } : {}),
        };
      }

      if (providerError.code === "provider_unavailable") {
        return {
          ...failure(
            prompt.moodLabel,
            "The writing model is temporarily unavailable. Your rewrite was not used.",
            503,
            operationId,
            "PROVIDER_BUSY",
          ),
          ...(providerError.retryAfterSeconds ? { retryAfterSeconds: providerError.retryAfterSeconds } : {}),
        };
      }

      return failure(
        prompt.moodLabel,
        "The writing model rejected the request. Your rewrite was not used.",
        502,
        operationId,
        "PROVIDER_FAILED",
      );
    }

    await preserveReservationAsUncertain(
      dependencies,
      operationId,
      accountId,
      reason,
      context.requestId,
    );
    return failure(
      prompt.moodLabel,
      "The provider response was interrupted; this request will not be retried automatically.",
      502,
      operationId,
      "SERVICE_UNAVAILABLE",
    );
  }

  const actualMicroUsd = calculateActualAiCostMicroUsd({
    completionTokens: providerResult.completionTokens,
    promptTokens: providerResult.promptTokens,
  });

  if (
    actualMicroUsd === null ||
    actualMicroUsd > config.maximumReservationMicroUsd ||
    providerResult.promptTokens > config.maxInputTokens ||
    providerResult.completionTokens > config.maxOutputTokens
  ) {
    // Persist the observed liability without clamping and close fleet admission.
    await dependencies.ledger.reportAnomaly?.(operationId, accountId, actualMicroUsd).catch(() => undefined);
    await preserveReservationAsUncertain(
      dependencies,
      operationId,
      accountId,
      "provider_usage_out_of_bounds",
      context.requestId,
    );
    return failure(
      prompt.moodLabel,
      "The provider returned unaccountable usage; the request was quarantined.",
      502,
      operationId,
    );
  }

  let result: GhostwriterResult;

  try {
    result = await dependencies.finalize(input, providerResult.rewrite, context);
  } catch {
    await preserveReservationAsUncertain(
      dependencies,
      operationId,
      accountId,
      "result_persistence_failed",
      context.requestId,
    );
    return failure(
      prompt.moodLabel,
      "The rewrite completed but could not be recorded safely.",
      502,
      operationId,
    );
  }

  try {
    const settled = await dependencies.ledger.settleSuccess({
      accountId,
      actualMicroUsd,
      operationId,
      providerRequestId: providerResult.providerRequestId,
      result: result as unknown as StoredAiResult,
    });

    if (!settled) {
      throw new Error("settlement_rejected");
    }
  } catch {
    await preserveReservationAsUncertain(
      dependencies,
      operationId,
      accountId,
      "settlement_failed",
      context.requestId,
    );
    return failure(
      prompt.moodLabel,
      "The rewrite completed but settlement is uncertain; it will not be regenerated.",
      502,
      operationId,
    );
  }

  // Settlement preserves the start/liability even if deletion or logout raced
  // the provider. Never release private output to a now-revoked session.
  const current = await dependencies.authenticate(request);
  if (!current.ok || current.identity.accountId !== accountId || current.identity.sessionId !== authentication.identity.sessionId) {
    return failure(prompt.moodLabel, "Your session is no longer available. No result was returned.", 401, operationId);
  }
  return { ...result, operationId };
}
