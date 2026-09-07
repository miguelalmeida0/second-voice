import "../lib/server-only.ts";

import { createHmac } from "node:crypto";
import { z } from "zod";
import { authenticateAiRequest, type AiAuthenticationResult } from "./ai-auth.ts";
import { SupabaseAiLedger, type AiLedger, type StoredAiResult } from "./ai-ledger.ts";
import {
  calculateActualAiCostMicroUsd,
  conservativeInputTokenUpperBound,
  isAiKillSwitchEnabled,
  resolveAiPolicyConfig,
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
  authenticate: authenticateAiRequest,
  dispatch: dispatchRewriteToProvider,
  finalize: finalizeRewrite,
  killSwitchEnabled: () => isAiKillSwitchEnabled(),
  ledger: new SupabaseAiLedger(),
  resolvePolicy: () => resolveAiPolicyConfig(),
};

function failure(
  moodLabel: string,
  error: string,
  status: number,
  operationId: string | null = null,
): GovernedGhostwriterResult {
  return {
    artifactToken: null,
    error,
    moodLabel,
    operationId,
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

function denial(reason: string, moodLabel: string): GovernedGhostwriterResult {
  if (reason === "not_entitled" || reason === "entitlement_expired") {
    return failure(moodLabel, "This account is not approved for the closed beta.", 403);
  }

  if (reason.includes("budget")) {
    return failure(moodLabel, "The beta AI budget is currently unavailable.", 503);
  }

  return failure(moodLabel, "Live rewrite allowance reached. Try again later.", 429);
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
    return denial(reservation.reason, prompt.moodLabel);
  }

  if (reservation.kind === "replay") {
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
      return failure(
        prompt.moodLabel,
        "AI budget controls are temporarily unavailable.",
        503,
        operationId,
      );
    }
  } catch {
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
    const reason =
      error instanceof AiProviderDispatchError ? error.code : "provider_dispatch_failed";
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

  return {
    ...result,
    operationId,
  };
}
