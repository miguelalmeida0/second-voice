import { randomUUID } from "node:crypto";
import type {
  AiLedger,
  AiOperationState,
  AiReservationRequest,
  AiReservationResult,
  StoredAiResult,
} from "../../src/server/ai-ledger.ts";
import type { AiProviderResult } from "../../src/server/ai-provider.ts";

type TestOperation = {
  accountId: string;
  actualMicroUsd: number | null;
  createdAt: number;
  fingerprint: string;
  id: string;
  key: string;
  outcome: "succeeded" | "failed" | null;
  reservationMicroUsd: number;
  result: StoredAiResult | null;
  state: AiOperationState;
};

export class TestAiLedger implements AiLedger {
  readonly approvedAccounts = new Set<string>();
  readonly operations: TestOperation[] = [];
  failReservations = false;
  failSettlement = false;
  now = Date.UTC(2026, 8, 7, 12, 0, 0);

  approve(...accountIds: string[]) {
    for (const accountId of accountIds) {
      this.approvedAccounts.add(accountId);
    }
  }

  private charged(operation: TestOperation): number {
    return operation.state === "reserved" ||
      operation.state === "dispatched" ||
      operation.state === "uncertain"
      ? operation.reservationMicroUsd
      : operation.actualMicroUsd ?? 0;
  }

  private count(predicate: (operation: TestOperation) => boolean): number {
    return this.operations.filter(predicate).length;
  }

  private spend(predicate: (operation: TestOperation) => boolean): number {
    return this.operations.filter(predicate).reduce((sum, operation) => sum + this.charged(operation), 0);
  }

  async reserve(request: AiReservationRequest): Promise<AiReservationResult> {
    if (this.failReservations) {
      throw new Error("datastore unavailable");
    }

    const existing = this.operations.find(
      (operation) =>
        operation.accountId === request.accountId && operation.key === request.idempotencyKey,
    );

    if (existing) {
      if (existing.fingerprint !== request.requestFingerprint) {
        return { kind: "conflict", operationId: existing.id };
      }

      return {
        kind: "replay",
        operationId: existing.id,
        outcome: existing.outcome,
        result: existing.result,
        state: existing.state,
      };
    }

    if (!this.approvedAccounts.has(request.accountId)) {
      return { kind: "denied", reason: "not_entitled" };
    }

    const { policy } = request;
    const minuteAgo = this.now - 60_000;
    const hourAgo = this.now - 60 * 60_000;
    const dayAgo = this.now - 24 * 60 * 60_000;
    const forAccount = (operation: TestOperation) => operation.accountId === request.accountId;

    if (this.count(forAccount) >= policy.lifetimeGenerationsPerAccount) {
      return { kind: "denied", reason: "account_lifetime_limit" };
    }

    if (this.count((operation) => forAccount(operation) && operation.createdAt >= dayAgo) >= policy.accountGenerationsPer24Hours) {
      return { kind: "denied", reason: "account_day_limit" };
    }

    if (this.count((operation) => forAccount(operation) && operation.createdAt >= minuteAgo) >= policy.accountGenerationsPerMinute) {
      return { kind: "denied", reason: "account_minute_limit" };
    }

    if (
      this.count(
        (operation) =>
          forAccount(operation) &&
          (operation.state === "reserved" || operation.state === "dispatched"),
      ) >= policy.accountConcurrency
    ) {
      return { kind: "denied", reason: "account_concurrency_limit" };
    }

    if (this.count((operation) => operation.createdAt >= minuteAgo) >= policy.globalGenerationsPerMinute) {
      return { kind: "denied", reason: "global_minute_limit" };
    }

    if (
      this.count(
        (operation) => operation.state === "reserved" || operation.state === "dispatched",
      ) >= policy.globalConcurrency
    ) {
      return { kind: "denied", reason: "global_concurrency_limit" };
    }

    const nextCost = policy.maximumReservationMicroUsd;

    if (this.spend((operation) => operation.createdAt >= hourAgo) + nextCost > policy.hourlyBudgetMicroUsd) {
      return { kind: "denied", reason: "hour_budget" };
    }

    if (this.spend((operation) => operation.createdAt >= dayAgo) + nextCost > policy.rolling24HourBudgetMicroUsd) {
      return { kind: "denied", reason: "day_budget" };
    }

    if (this.spend(() => true) + nextCost > policy.betaLifetimeBudgetMicroUsd) {
      return { kind: "denied", reason: "beta_lifetime_budget" };
    }

    const operation: TestOperation = {
      accountId: request.accountId,
      actualMicroUsd: null,
      createdAt: this.now,
      fingerprint: request.requestFingerprint,
      id: randomUUID(),
      key: request.idempotencyKey,
      outcome: null,
      reservationMicroUsd: nextCost,
      result: null,
      state: "reserved",
    };
    this.operations.push(operation);
    return { kind: "admitted", operationId: operation.id };
  }

  async markDispatched(operationId: string, accountId: string): Promise<boolean> {
    const operation = this.operations.find(
      (candidate) => candidate.id === operationId && candidate.accountId === accountId,
    );

    if (!operation || operation.state !== "reserved") {
      return false;
    }

    operation.state = "dispatched";
    return true;
  }

  async failBeforeDispatch(operationId: string, accountId: string): Promise<boolean> {
    const operation = this.operations.find(
      (candidate) => candidate.id === operationId && candidate.accountId === accountId,
    );

    if (!operation || (operation.state !== "reserved" && operation.state !== "dispatched")) {
      return false;
    }

    operation.actualMicroUsd = 0;
    operation.outcome = "failed";
    operation.state = "failed";
    return true;
  }

  async markUncertain(operationId: string, accountId: string): Promise<boolean> {
    const operation = this.operations.find(
      (candidate) => candidate.id === operationId && candidate.accountId === accountId,
    );

    if (!operation || (operation.state !== "reserved" && operation.state !== "dispatched")) {
      return false;
    }

    operation.state = "uncertain";
    return true;
  }

  async settleSuccess(options: {
    accountId: string;
    actualMicroUsd: number;
    operationId: string;
    providerRequestId: string | null;
    result: StoredAiResult;
  }): Promise<boolean> {
    if (this.failSettlement) {
      throw new Error("settlement unavailable");
    }

    const operation = this.operations.find(
      (candidate) =>
        candidate.id === options.operationId && candidate.accountId === options.accountId,
    );

    if (
      !operation ||
      operation.state !== "dispatched" ||
      options.actualMicroUsd > operation.reservationMicroUsd
    ) {
      return false;
    }

    operation.actualMicroUsd = options.actualMicroUsd;
    operation.outcome = "succeeded";
    operation.result = options.result;
    operation.state = "settled";
    return true;
  }

  snapshot() {
    return {
      reservedMicroUsd: this.operations
        .filter(
          (operation) =>
            operation.state === "reserved" ||
            operation.state === "dispatched" ||
            operation.state === "uncertain",
        )
        .reduce((sum, operation) => sum + operation.reservationMicroUsd, 0),
      settledMicroUsd: this.operations
        .filter((operation) => operation.state === "settled")
        .reduce((sum, operation) => sum + (operation.actualMicroUsd ?? 0), 0),
    };
  }
}
export class MockAiProvider {
  calls = 0;
  mode:
    | "success"
    | "timeout"
    | "disconnect"
    | "provider-429"
    | "provider-500"
    | "malformed" = "success";

  async dispatch(): Promise<AiProviderResult> {
    this.calls += 1;

    if (this.mode !== "success") {
      throw new Error(this.mode);
    }

    return {
      completionTokens: 100,
      promptTokens: 500,
      providerRequestId: `mock-${this.calls}`,
      rewrite: "A safe mock rewrite.",
    };
  }
}
