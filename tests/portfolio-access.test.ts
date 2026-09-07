import test from "node:test";
import assert from "node:assert/strict";
import { parsePortfolioAllowance, portfolioAccessView } from "../src/lib/portfolio-access.ts";

test("visitors can reach sign-in without waiting for authentication or inference availability", () => {
  for (const status of ["anonymous", "checking"] as const) {
    const view = portfolioAccessView({ status }, true, false);
    assert.equal(view.signIn, true);
    assert.equal(view.canGenerate, false);
    assert.match(view.message, /Sign in with GitHub/);
  }
  assert.equal(portfolioAccessView({ status: "anonymous" }, false, true).signIn, false);
});

test("only verified available trials enable the composer; fail closed on missing status", () => {
  const allowance = { remaining: 9, todayRemaining: 2, available: true };
  assert.equal(portfolioAccessView({ status: "authenticated", allowance }, true, true).canGenerate, true);
  for (const value of [null, { ...allowance, remaining: 0 }, { ...allowance, todayRemaining: 0 }, { ...allowance, available: false }]) {
    assert.equal(portfolioAccessView({ status: "authenticated", allowance: value }, true, true).canGenerate, false);
  }
  assert.equal(portfolioAccessView({ status: "authenticated", allowance }, true, false).canGenerate, false);
  assert.equal(portfolioAccessView({ status: "unavailable" }, true, true).canGenerate, false);
  assert.match(portfolioAccessView({ status: "authenticated", allowance: { ...allowance, remaining: 0 } }, true, true).message, /trial has reached its limit/);
});

test("allowance parsing rejects malformed or out-of-range responses", () => {
  for (const value of [null, {}, { remaining: "10", available: true }, { remaining: 11, available: true }, { remaining: -1, available: true }, { remaining: 2, available: "true" }, { remaining: 2, todayRemaining: 4, available: true }]) {
    assert.equal(parsePortfolioAllowance(value), null);
  }
  assert.deepEqual(parsePortfolioAllowance({ remaining: 8, todayRemaining: 1, available: true }), { remaining: 8, todayRemaining: 1, available: true });
});
