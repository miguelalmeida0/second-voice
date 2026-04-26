import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateRewriteLabOverall,
  compareRewriteLabCandidates,
  overreachPenalty,
  selectRewriteLabWinner,
  type RewriteLabCandidate,
} from "../src/lib/ghostwriter-lab-shared.ts";

function candidate(
  id: RewriteLabCandidate["id"],
  scores: Partial<RewriteLabCandidate["scores"]>,
): RewriteLabCandidate {
  return {
    evaluatorNote: "test",
    flags: [],
    id,
    label: id,
    latencyMs: 10,
    rewrite: "test rewrite",
    scores: {
      meaningPreservation: 80,
      overreachRisk: "low",
      overall: 80,
      readability: 80,
      surprise: 80,
      voiceMatch: 80,
      ...scores,
    },
  };
}

test("rewrite lab scoring weights meaning and risk explicitly", () => {
  assert.equal(overreachPenalty("low"), 100);
  assert.equal(overreachPenalty("medium"), 65);
  assert.equal(overreachPenalty("high"), 20);
  assert.equal(
    calculateRewriteLabOverall({
      meaningPreservation: 90,
      overreachRisk: "medium",
      readability: 70,
      surprise: 60,
      voiceMatch: 80,
    }),
    77,
  );
});

test("rewrite lab winner selection uses deterministic tie breakers", () => {
  assert.equal(
    selectRewriteLabWinner([
      candidate("expressive", { overall: 84, meaningPreservation: 76 }),
      candidate("faithful", { overall: 84, meaningPreservation: 88 }),
      candidate("compressed", { overall: 80, meaningPreservation: 90 }),
    ]),
    "faithful",
  );

  assert.equal(
    selectRewriteLabWinner([
      candidate("expressive", { overall: 82, meaningPreservation: 86, overreachRisk: "medium" }),
      candidate("compressed", { overall: 82, meaningPreservation: 86, overreachRisk: "low" }),
    ]),
    "compressed",
  );

  assert.equal(
    selectRewriteLabWinner([
      candidate("expressive", { overall: 82, meaningPreservation: 86, overreachRisk: "low", readability: 74 }),
      candidate("compressed", { overall: 82, meaningPreservation: 86, overreachRisk: "low", readability: 91 }),
    ]),
    "compressed",
  );
});

test("rewrite lab final fallback prefers faithful when scores are indistinguishable", () => {
  const tied = [
    candidate("compressed", { overall: 80 }),
    candidate("expressive", { overall: 80 }),
    candidate("faithful", { overall: 80 }),
  ].sort(compareRewriteLabCandidates);

  assert.equal(tied[0].id, "faithful");
});
