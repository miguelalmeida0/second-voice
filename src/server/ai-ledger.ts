import "../lib/server-only.ts";

import { getSupabaseAdmin } from "../integrations/supabase/client.server.ts";
import type { AiPolicyConfig } from "./ai-policy.ts";
import { combinedAiLimitError, COMBINED_AI_LIMIT_REASON } from "../lib/combined-ai-limit.ts";

export type AiOperationState =
  | "reserved"
  | "dispatched"
  | "settled"
  | "failed"
  | "uncertain";

export type StoredAiResult = Record<string, unknown>;

export type AiReservationRequest = {
  accountId: string;
  principalType?: "authenticated" | "anonymous";
  sessionId?: string;
  idempotencyKey: string;
  policy: AiPolicyConfig;
  requestFingerprint: string;
};

export type AiReservationResult =
  | { kind: "admitted"; operationId: string }
  | {
      kind: "replay";
      operationId: string;
      outcome: "succeeded" | "failed" | null;
      result: StoredAiResult | null;
      state: AiOperationState;
    }
  | { kind: "conflict"; operationId: string }
  | { kind: "denied"; reason: string; retryAfterSeconds?: number };

export interface AiLedger {
  reportAnomaly?(operationId: string, accountId: string, observedMicroUsd: number | null): Promise<boolean>;
  failBeforeDispatch(operationId: string, accountId: string, reason: string): Promise<boolean>;
  markDispatched(operationId: string, accountId: string): Promise<boolean>;
  markUncertain(operationId: string, accountId: string, reason: string): Promise<boolean>;
  settleKnownFailure(operationId: string, accountId: string, reason: string): Promise<boolean>;
  reserve(request: AiReservationRequest): Promise<AiReservationResult>;
  settleSuccess(options: {
    accountId: string;
    actualMicroUsd: number;
    operationId: string;
    providerRequestId: string | null;
    result: StoredAiResult;
  }): Promise<boolean>;
}

type RpcResponse = {
  data: unknown;
  error: { code?: string; message: string; details?: string | null } | null;
};

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResponse>;
};

function rpcClient(): RpcClient {
  const admin = getSupabaseAdmin();

  if (!admin) {
    throw new Error("Durable AI ledger is not configured");
  }

  return admin as unknown as RpcClient;
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function operationState(value: unknown): AiOperationState {
  switch (value) {
    case "reserved":
    case "dispatched":
    case "settled":
    case "failed":
    case "uncertain":
      return value;
    default:
      return "uncertain";
  }
}

async function booleanRpc(name: string, args: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await rpcClient().rpc(name, args);

  if (error) {
    const combinedLimit = combinedAiLimitError(error);
    if (combinedLimit) throw combinedLimit;
    throw new Error(`AI ledger RPC ${name} failed (${error.code ?? "unknown"})`);
  }

  return data === true;
}

export class SupabaseAiLedger implements AiLedger {
  reportAnomaly(operationId: string, accountId: string, observedMicroUsd: number | null): Promise<boolean> {
    return booleanRpc("ghostwriter_ai_report_anomaly", {
      p_operation_id: operationId, p_account_id: accountId, p_observed_micro_usd: observedMicroUsd,
    });
  }
  async reserve(request: AiReservationRequest): Promise<AiReservationResult> {
    const { policy } = request;
    const portfolioLimits={accounts:policy.maxApprovedAccounts,accountLifetime:policy.lifetimeGenerationsPerAccount,accountDay:policy.accountGenerationsPer24Hours,accountMinute:policy.accountGenerationsPerMinute,globalMinute:policy.globalGenerationsPerMinute,hourBudget:policy.hourlyBudgetMicroUsd,dayBudget:policy.rolling24HourBudgetMicroUsd,lifetimeBudget:policy.betaLifetimeBudgetMicroUsd,operationBudget:policy.maxOperationMicroUsd};
    const isAnonymous=policy.profile==="portfolio-free"&&request.principalType==="anonymous";
    const rpcName=policy.profile==="portfolio-free"?(isAnonymous?"ghostwriter_anonymous_reserve_bounded":"ghostwriter_free_reserve_bounded"):"ghostwriter_ai_reserve";
    const rpcArgs=isAnonymous?{p_visitor_id:request.accountId,p_idempotency_key:request.idempotencyKey,p_request_fingerprint:request.requestFingerprint,p_organization_id:policy.freeOrganizationId,p_project_id:policy.freeProjectId,p_limits:portfolioLimits,p_global_daily_limit:policy.anonymousGlobalDailyLimit}:policy.profile==="portfolio-free"?{p_account_id:request.accountId,p_session_id:request.sessionId??null,p_idempotency_key:request.idempotencyKey,p_request_fingerprint:request.requestFingerprint,p_organization_id:policy.freeOrganizationId,p_project_id:policy.freeProjectId,p_limits:portfolioLimits}:{
      p_account_concurrency_limit: policy.accountConcurrency,
      p_account_day_limit: policy.accountGenerationsPer24Hours,
      p_account_id: request.accountId,
      p_session_id: request.sessionId ?? null,
      p_account_lifetime_limit: policy.lifetimeGenerationsPerAccount,
      p_account_minute_limit: policy.accountGenerationsPerMinute,
      p_beta_lifetime_budget_micro_usd: policy.betaLifetimeBudgetMicroUsd,
      p_day_budget_micro_usd: policy.rolling24HourBudgetMicroUsd,
      p_global_concurrency_limit: policy.globalConcurrency,
      p_global_minute_limit: policy.globalGenerationsPerMinute,
      p_hour_budget_micro_usd: policy.hourlyBudgetMicroUsd,
      p_idempotency_key: request.idempotencyKey,
      p_max_approved_accounts: policy.maxApprovedAccounts,
      p_pricing_version: policy.pricingVersion,
      p_request_fingerprint: request.requestFingerprint,
      p_reservation_micro_usd: policy.maximumReservationMicroUsd,
    };
    const { data, error } = await rpcClient().rpc(rpcName, rpcArgs);

    if (error) {
      const combinedLimit = combinedAiLimitError(error);
      if (combinedLimit) return {
        kind: "denied", reason: COMBINED_AI_LIMIT_REASON,
        retryAfterSeconds: combinedLimit.retryAfterSeconds,
      };
      throw new Error(`AI reservation failed (${error.code ?? "unknown"})`);
    }

    const result = record(data);

    if (!result) {
      throw new Error("AI reservation returned an invalid response");
    }

    const kind = result.kind;

    if (kind === "admitted" && typeof result.operation_id === "string") {
      return { kind, operationId: result.operation_id };
    }

    if (kind === "conflict" && typeof result.operation_id === "string") {
      return { kind, operationId: result.operation_id };
    }

    if (kind === "denied" && typeof result.reason === "string") {
      return { kind, reason: result.reason };
    }

    if (kind === "replay" && typeof result.operation_id === "string") {
      return {
        kind,
        operationId: result.operation_id,
        outcome:
          result.outcome === "succeeded" || result.outcome === "failed" ? result.outcome : null,
        result: record(result.result),
        state: operationState(result.state),
      };
    }

    throw new Error("AI reservation returned an invalid response");
  }

  markDispatched(operationId: string, accountId: string): Promise<boolean> {
    return booleanRpc("ghostwriter_ai_mark_dispatched", {
      p_account_id: accountId,
      p_operation_id: operationId,
    });
  }

  failBeforeDispatch(operationId: string, accountId: string, reason: string): Promise<boolean> {
    return booleanRpc("ghostwriter_ai_fail_before_dispatch", {
      p_account_id: accountId,
      p_operation_id: operationId,
      p_reason: reason.slice(0, 120),
    });
  }

  markUncertain(operationId: string, accountId: string, reason: string): Promise<boolean> {
    return booleanRpc("ghostwriter_ai_mark_uncertain", {
      p_account_id: accountId,
      p_operation_id: operationId,
      p_reason: reason.slice(0, 120),
    });
  }

  settleKnownFailure(operationId: string, accountId: string, reason: string): Promise<boolean> {
    return booleanRpc("ghostwriter_ai_settle_known_failure", {
      p_account_id: accountId,
      p_operation_id: operationId,
      p_reason: reason.slice(0, 120),
    });
  }

  settleSuccess(options: {
    accountId: string;
    actualMicroUsd: number;
    operationId: string;
    providerRequestId: string | null;
    result: StoredAiResult;
  }): Promise<boolean> {
    return booleanRpc("ghostwriter_ai_settle_success", {
      p_account_id: options.accountId,
      p_actual_micro_usd: options.actualMicroUsd,
      p_operation_id: options.operationId,
      p_provider_request_id: options.providerRequestId,
      p_result: options.result,
    });
  }
}
