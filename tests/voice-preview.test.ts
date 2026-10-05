import test from "node:test";
import assert from "node:assert/strict";
import { voicePreview, surpriseVoice } from "../src/lib/voice-preview.ts";

test("preview changes with voice and strength without using the draft", () => {
  const gentle = voicePreview("tolkien", 0);
  const middle = voicePreview("tolkien", 50);
  const strong = voicePreview("tolkien", 100);
  assert.equal(new Set([gentle, middle, strong]).size, 3);
  assert.match(middle, /Thursday/);
  assert.notEqual(voicePreview("hemingway", 50), middle);
  assert.equal(voicePreview("tolkien", -5), gentle);
  assert.equal(voicePreview("tolkien", 105), strong);
});

test("surprise always picks a different voice and one of three preview strengths", () => {
  for (const current of ["tolkien", "stephenking", "tolstoy", "hemingway"] as const) {
    for (const random of [0, 0.25, 0.5, 0.999999]) {
      const next = surpriseVoice(current, () => random);
      assert.notEqual(next.author, current);
      assert.ok([0, 50, 100].includes(next.mood));
      assert.ok(voicePreview(next.author, next.mood).length > 0);
    }
  }
});
