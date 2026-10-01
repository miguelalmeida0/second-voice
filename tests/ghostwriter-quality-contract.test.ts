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
const AI_PROVIDER_SERVER = readFileSync(
  new URL("../src/server/ai-provider.ts", import.meta.url),
  "utf8",
);
const AI_GATEWAY_SERVER = readFileSync(
  new URL("../src/server/ai-gateway.ts", import.meta.url),
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

test("outcome rewrite prompt is separate from author style prompting", () => {
  assert.match(GHOSTWRITER_SERVER, /export function buildOutcomePrompt\(outcome: OutcomeId\)/);
  assert.match(GHOSTWRITER_SERVER, /You are an outcome-driven rewrite engine/);
  assert.match(GHOSTWRITER_SERVER, /Do not imitate a famous author or literary style/);
  assert.match(GHOSTWRITER_SERVER, /Never invent details, claims, promises, or emotional stakes/);
  assert.match(AI_GATEWAY_SERVER, /input\.mode === "outcome"[\s\S]*buildOutcomePrompt\(input\.outcome\)/);
  assert.match(GHOSTWRITER_SERVER, /data\.mode === "outcome"[\s\S]*\? outcomeLabelFor\(data\.outcome\)/);
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

test("the central provider choke point validates output before finalization", () => {
  assert.match(AI_PROVIDER_SERVER, /validateRewriteProviderPayload\(json\)/);
  assert.match(AI_PROVIDER_SERVER, /ProviderEnvelopeSchema\.safeParse\(json\)/);
  assert.match(AI_PROVIDER_SERVER, /throw new AiProviderDispatchError\("malformed_response"\)/);
  assert.match(AI_PROVIDER_SERVER, /rewrite: validatedRewrite\.rewrite/);
});
