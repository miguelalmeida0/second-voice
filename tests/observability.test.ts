import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SECURITY_EVENTS = readFileSync(
  new URL("../src/server/security-events.ts", import.meta.url),
  "utf8",
);
const GHOSTWRITER_SERVER = readFileSync(
  new URL("../src/server/ghostwriter.ts", import.meta.url),
  "utf8",
);
const REWRITE_LAB_SERVER = readFileSync(
  new URL("../src/server/ghostwriter-lab.ts", import.meta.url),
  "utf8",
);
const AI_GATEWAY_SERVER = readFileSync(
  new URL("../src/server/ai-gateway.ts", import.meta.url),
  "utf8",
);
const FEEDBACK_SERVER = readFileSync(
  new URL("../src/server/ghostwriter-feedback.ts", import.meta.url),
  "utf8",
);

test("quality telemetry is explicit and avoids user text fields", () => {
  assert.match(SECURITY_EVENTS, /rewrite_completed/);
  assert.match(SECURITY_EVENTS, /rewrite_lab_completed/);
  assert.match(SECURITY_EVENTS, /rewrite_feedback_recorded/);
  assert.match(SECURITY_EVENTS, /category: "quality"/);

  assert.match(GHOSTWRITER_SERVER, /logSecurityEvent\("rewrite_completed"/);
  assert.match(GHOSTWRITER_SERVER, /latencyMs: Date\.now\(\) - startedAt/);
  assert.match(GHOSTWRITER_SERVER, /outputChars: rewrite\.length/);
  assert.doesNotMatch(GHOSTWRITER_SERVER, /inputText|sourceText/);

  assert.doesNotMatch(REWRITE_LAB_SERVER, /fetch\(|logSecurityEvent\("rewrite_lab_completed"/);
  assert.match(AI_GATEWAY_SERVER, /logSecurityEvent\("ai_operation_uncertain"/);
  assert.doesNotMatch(AI_GATEWAY_SERVER, /logSecurityEvent\([\s\S]{0,200}(input\.text|providerApiKey)/);

  assert.match(FEEDBACK_SERVER, /logSecurityEvent\("rewrite_feedback_recorded"/);
  assert.match(FEEDBACK_SERVER, /verifyRewriteArtifactToken\(/);
  assert.match(FEEDBACK_SERVER, /rewrite_hash: verifiedArtifact\.rewriteHash/);
  assert.doesNotMatch(FEEDBACK_SERVER, /input_text|output_text/);
});
