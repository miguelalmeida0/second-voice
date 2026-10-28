import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReviewParts,
  buildReviewText,
  createReviewState,
  reviewReducer,
} from "../src/components/ghostwriter/rewrite-review.ts";

// Each fixture catches lost slices, incorrect edit grouping, or unstable IDs.
test("groups adjacent substitutions, insertions and deletions with sequential IDs", () => {
  assert.deepEqual(buildReviewParts("red cat old", "blue cat new tail"), [
    { kind: "change", id: 0, original: "red", suggestion: "blue" },
    { kind: "equal", text: " cat " },
    { kind: "change", id: 1, original: "old", suggestion: "new tail" },
  ]);
  assert.deepEqual(buildReviewParts("cat old", "cat"), [
    { kind: "equal", text: "cat" },
    { kind: "change", id: 0, original: " old", suggestion: "" },
  ]);
  assert.deepEqual(buildReviewParts("cat", "cat tail"), [
    { kind: "equal", text: "cat" },
    { kind: "change", id: 0, original: "", suggestion: " tail" },
  ]);
});

test("preserves exact spaces, tabs, newlines and punctuation", () => {
  const parts = buildReviewParts(" A\tB\n\nC! ", " A  B\r\nC? ");
  let state = createReviewState(parts);
  assert.equal(buildReviewText(parts, state), " A  B\r\nC? ");
  for (const part of parts) {
    if (part.kind === "change") state = reviewReducer(state, { type: "decide", id: part.id, decision: "keep" });
  }
  assert.equal(buildReviewText(parts, state), " A\tB\n\nC! ");
});

test("keeps combining characters and joined emoji whole", () => {
  assert.deepEqual(buildReviewParts("café 👩🏽‍💻!", "café 👨‍👩‍👧‍👦!"), [
    { kind: "change", id: 0, original: "café", suggestion: "café" },
    { kind: "equal", text: " " },
    { kind: "change", id: 1, original: "👩🏽‍💻", suggestion: "👨‍👩‍👧‍👦" },
    { kind: "equal", text: "!" },
  ]);
});

test("handles empty and identical inputs without inventing edits", () => {
  assert.deepEqual(buildReviewParts("", ""), []);
  assert.deepEqual(buildReviewParts("same\n🙂", "same\n🙂"), [{ kind: "equal", text: "same\n🙂" }]);
  assert.deepEqual(buildReviewParts("", "new\n"), [{ kind: "change", id: 0, original: "", suggestion: "new\n" }]);
  assert.deepEqual(buildReviewParts("old\n", ""), [{ kind: "change", id: 0, original: "old\n", suggestion: "" }]);
  assert.equal(buildReviewText([], createReviewState([])), "");
});

test("aligns repeated words deterministically and preserves their exact order", () => {
  assert.deepEqual(buildReviewParts("go go stop", "go stop go"), [
    { kind: "equal", text: "go " },
    { kind: "change", id: 0, original: "go ", suggestion: "" },
    { kind: "equal", text: "stop" },
    { kind: "change", id: 1, original: "", suggestion: " go" },
  ]);
});

test("pending and accepted edits preview suggestions while kept edits use source slices", () => {
  const parts = buildReviewParts("red cat old", "blue cat new tail");
  const initial = createReviewState(parts);
  const kept = reviewReducer(initial, { type: "decide", id: 0, decision: "keep" });
  const accepted = reviewReducer(kept, { type: "decide", id: 1, decision: "accept" });
  assert.deepEqual(initial.decisions, ["pending", "pending"]);
  assert.deepEqual(accepted.decisions, ["keep", "accept"]);
  assert.equal(buildReviewText(parts, initial), "blue cat new tail");
  assert.equal(buildReviewText(parts, accepted), "red cat new tail");
});

test("undo restores prior decisions immutably including a changed decision", () => {
  const initial = createReviewState(buildReviewParts("old", "new"));
  const kept = reviewReducer(initial, { type: "decide", id: 0, decision: "keep" });
  const accepted = reviewReducer(kept, { type: "decide", id: 0, decision: "accept" });
  const undone = reviewReducer(accepted, { type: "undo" });
  assert.deepEqual(undone.decisions, ["keep"]);
  assert.deepEqual(reviewReducer(undone, { type: "undo" }).decisions, ["pending"]);
  assert.deepEqual(initial.decisions, ["pending"]);
  assert.deepEqual(kept.decisions, ["keep"]);
  assert.deepEqual(accepted.decisions, ["accept"]);
});

test("reset is one undoable action and retains earlier undo history", () => {
  const parts = buildReviewParts("red cat old", "blue cat new tail");
  let state = createReviewState(parts);
  state = reviewReducer(state, { type: "decide", id: 0, decision: "keep" });
  state = reviewReducer(state, { type: "decide", id: 1, decision: "accept" });
  const reset = reviewReducer(state, { type: "reset" });
  assert.deepEqual(reset.decisions, ["pending", "pending"]);
  assert.equal(buildReviewText(parts, reset), "blue cat new tail");
  const restored = reviewReducer(reset, { type: "undo" });
  assert.deepEqual(restored.decisions, ["keep", "accept"]);
  assert.deepEqual(reviewReducer(restored, { type: "undo" }).decisions, ["keep", "pending"]);
  assert.deepEqual(state.decisions, ["keep", "accept"]);
});

test("invalid IDs, repeated decisions and empty undo or reset are identity no-ops", () => {
  const initial = createReviewState(buildReviewParts("old", "new"));
  assert.equal(reviewReducer(initial, { type: "undo" }), initial);
  assert.equal(reviewReducer(initial, { type: "reset" }), initial);
  for (const id of [-1, 1, 0.5, NaN, Infinity]) {
    assert.equal(reviewReducer(initial, { type: "decide", id, decision: "accept" }), initial);
  }
  const kept = reviewReducer(initial, { type: "decide", id: 0, decision: "keep" });
  assert.equal(reviewReducer(kept, { type: "decide", id: 0, decision: "keep" }), kept);
  assert.deepEqual(reviewReducer(kept, { type: "undo" }).decisions, ["pending"]);
});

test("large comparisons fall back to one exact whole-text replacement", () => {
  const source = "old ".repeat(2000) + "👩🏽‍💻\n";
  const result = "new ".repeat(2000) + "👨‍👩‍👧‍👦\n";
  const parts = buildReviewParts(source, result);
  assert.deepEqual(parts, [{ kind: "change", id: 0, original: source, suggestion: result }]);
  const initial = createReviewState(parts);
  assert.equal(buildReviewText(parts, initial), result);
  assert.equal(buildReviewText(parts, reviewReducer(initial, { type: "decide", id: 0, decision: "keep" })), source);
});

test("accept all is one undoable transaction across kept, accepted and pending edits", () => {
  const parts = buildReviewParts("red cat old dog small", "blue cat new dog large");
  let state = createReviewState(parts);
  state = reviewReducer(state, { type: "decide", id: 0, decision: "keep" });
  state = reviewReducer(state, { type: "decide", id: 1, decision: "accept" });
  const accepted = reviewReducer(state, { type: "accept-all" });
  assert.deepEqual(accepted.decisions, ["accept", "accept", "accept"]);
  assert.equal(buildReviewText(parts, accepted), "blue cat new dog large");
  assert.equal(accepted.history.length, state.history.length + 1);
  assert.deepEqual(reviewReducer(accepted, { type: "undo" }), state);
  assert.equal(reviewReducer(accepted, { type: "accept-all" }), accepted);
  const empty = createReviewState(buildReviewParts("same", "same"));
  assert.equal(reviewReducer(empty, { type: "accept-all" }), empty);
});
