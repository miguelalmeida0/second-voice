import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  REWRITE_OUTPUT_MAX_CHARS,
  REWRITE_PROMPT_VERSION,
  cleanupRewriteOutput,
  validateRewriteProviderPayload,
} from "../src/server/ghostwriter-quality.ts";

const GHOSTWRITER_SERVER = readFileSync(
  new URL("../src/server/ghostwriter.ts", import.meta.url),
  "utf8",
);

function providerPayload(content: string) {
  return {
    choices: [
      {
        message: {
          content,
        },
      },
    ],
  };
}

test("single rewrite prompt carries an explicit contract version", () => {
  assert.equal(REWRITE_PROMPT_VERSION, "single-rewrite-v1");
  assert.match(GHOSTWRITER_SERVER, /Contract version:\n\$\{REWRITE_PROMPT_VERSION\}/);
  assert.match(GHOSTWRITER_SERVER, /Return only the rewritten passage/);
  assert.match(GHOSTWRITER_SERVER, /Preserve the core message, facts, and point of view/);
});

test("rewrite output cleanup trims framing quotes and excess blank lines", () => {
  assert.equal(cleanupRewriteOutput("  \"The road went on.\"  "), "The road went on.");
  assert.equal(cleanupRewriteOutput("Line one\n\n\n\nLine two"), "Line one\n\nLine two");
});

test("provider payload validation accepts only bounded plain rewrite text", () => {
  const accepted = validateRewriteProviderPayload(providerPayload("  The road went on under old stars.  "));

  assert.equal(accepted.ok, true);
  if (!accepted.ok) {
    throw new Error("expected provider payload to be accepted");
  }

  assert.equal(accepted.rewrite, "The road went on under old stars.");
  assert.equal(accepted.schemaVersion, "openai-chat-choice-v1");
  assert.equal(accepted.guardVersion, "rewrite-output-guard-v1");
});

test("provider payload validation rejects malformed, empty, oversized, and wrapped output", () => {
  const malformed = validateRewriteProviderPayload({ message: { content: "missing choices" } });
  const empty = validateRewriteProviderPayload(providerPayload("   "));
  const oversized = validateRewriteProviderPayload(providerPayload("x".repeat(REWRITE_OUTPUT_MAX_CHARS + 1)));
  const fenced = validateRewriteProviderPayload(providerPayload("```text\nThe road went on.\n```"));
  const prefaced = validateRewriteProviderPayload(providerPayload("Here is the rewritten passage: The road went on."));

  assert.deepEqual(
    [malformed, empty, oversized, fenced, prefaced].map((result) =>
      result.ok ? "accepted" : result.reason,
    ),
    ["invalid_schema", "empty", "too_large", "format_violation", "format_violation"],
  );
});

test("rewriteText uses the quality contract before accepting provider output", () => {
  assert.match(GHOSTWRITER_SERVER, /validateRewriteProviderPayload\(json\)/);
  assert.match(GHOSTWRITER_SERVER, /ai_provider_output_rejected/);
  assert.match(GHOSTWRITER_SERVER, /reason: validatedRewrite\.reason/);
  assert.match(GHOSTWRITER_SERVER, /status: 502/);
  assert.match(GHOSTWRITER_SERVER, /const rewrite = validatedRewrite\.rewrite;/);
});
