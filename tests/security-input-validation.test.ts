import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const GHOSTWRITER_SERVER = readFileSync(
  new URL("../src/server/ghostwriter.ts", import.meta.url),
  "utf8",
);
const REWRITE_LAB_SERVER = readFileSync(
  new URL("../src/server/ghostwriter-lab.ts", import.meta.url),
  "utf8",
);
const REQUEST_ID_SERVER = readFileSync(
  new URL("../src/server/request-id.ts", import.meta.url),
  "utf8",
);
const GHOSTWRITER_ROUTE = readFileSync(
  new URL("../src/app/api/ghostwriter/route.ts", import.meta.url),
  "utf8",
);
const GHOSTWRITER_LAB_ROUTE = readFileSync(
  new URL("../src/app/api/ghostwriter/lab/route.ts", import.meta.url),
  "utf8",
);
const GHOSTWRITER_SHARE_ROUTE = readFileSync(
  new URL("../src/app/api/ghostwriter/share/route.ts", import.meta.url),
  "utf8",
);
const GHOSTWRITER_FEEDBACK_ROUTE = readFileSync(
  new URL("../src/app/api/ghostwriter/feedback/route.ts", import.meta.url),
  "utf8",
);
const GHOSTWRITER_FEEDBACK_SERVER = readFileSync(
  new URL("../src/server/ghostwriter-feedback.ts", import.meta.url),
  "utf8",
);
const GHOSTWRITER_CHALLENGE_ROUTE = readFileSync(
  new URL("../src/app/api/ghostwriter/challenge/route.ts", import.meta.url),
  "utf8",
);

test("rewrite input schema trims before enforcing non-empty text", () => {
  assert.match(GHOSTWRITER_SERVER, /text:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.max\(2000\)/);
  assert.match(GHOSTWRITER_SERVER, /mode:\s*z\.enum\(\["author", "outcome"\]\)\.default\(DEFAULT_REWRITE_MODE\)/);
  assert.match(
    GHOSTWRITER_SERVER,
    /outcome:\s*z\.enum\(\["clarity", "reply", "confident", "concise", "persuasive"\]\)\.default\(DEFAULT_OUTCOME_ID\)/,
  );
  assert.match(GHOSTWRITER_ROUTE, /mode:\s*parsed\.data\.mode/);
  assert.match(GHOSTWRITER_ROUTE, /outcome:\s*parsed\.data\.outcome/);
});

test("rewrite artifact provenance schema accepts only bounded public metadata", () => {
  assert.match(GHOSTWRITER_SERVER, /RewriteArtifactProvenanceSchema = z\.discriminatedUnion\("source"/);
  assert.match(GHOSTWRITER_SERVER, /source: z\.literal\("single_rewrite"\)/);
  assert.match(GHOSTWRITER_SERVER, /source: z\.literal\("rewrite_lab"\)/);
  assert.match(GHOSTWRITER_SERVER, /label: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(80\)/);
  assert.match(GHOSTWRITER_SERVER, /overall: z\.number\(\)\.int\(\)\.min\(0\)\.max\(100\)/);
  assert.match(GHOSTWRITER_SERVER, /reason: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(280\)/);
  assert.doesNotMatch(GHOSTWRITER_ROUTE, /artifactProvenance: RewriteArtifactProvenanceSchema\.optional\(\)/);
  assert.match(GHOSTWRITER_ROUTE, /artifactToken: result\.artifactToken/);
  assert.match(GHOSTWRITER_SHARE_ROUTE, /artifactToken: z\.string\(\)\.min\(32\)\.max\(4096\)/);
  assert.doesNotMatch(GHOSTWRITER_SHARE_ROUTE, /artifactProvenance/);
  assert.match(GHOSTWRITER_SHARE_ROUTE, /rewrite: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(REWRITE_OUTPUT_MAX_CHARS\)/);
  assert.match(GHOSTWRITER_FEEDBACK_SERVER, /RewriteFeedbackSubjectSchema = InputSchema\.pick/);
  assert.match(GHOSTWRITER_FEEDBACK_SERVER, /artifactToken: z\.string\(\)\.min\(32\)\.max\(4096\)/);
  assert.match(GHOSTWRITER_FEEDBACK_SERVER, /rating: z\.enum\(REWRITE_FEEDBACK_RATINGS\)/);
  assert.match(GHOSTWRITER_FEEDBACK_SERVER, /reason: z\.enum\(REWRITE_FEEDBACK_REASONS\)\.optional\(\)/);
  assert.match(GHOSTWRITER_FEEDBACK_SERVER, /Feedback reason does not match rating\./);
  assert.match(GHOSTWRITER_FEEDBACK_SERVER, /rewrite: z\.string\(\)\.trim\(\)\.min\(1\)\.max\(REWRITE_OUTPUT_MAX_CHARS\)/);
  assert.match(GHOSTWRITER_FEEDBACK_SERVER, /verifyRewriteArtifactToken\(/);
  assert.match(GHOSTWRITER_FEEDBACK_SERVER, /rewriteHash\(rewrite\)/);
  assert.doesNotMatch(GHOSTWRITER_FEEDBACK_SERVER, /input_text|output_text/);
  assert.match(GHOSTWRITER_FEEDBACK_ROUTE, /RewriteFeedbackSchema\.safeParse\(body\.data\)/);
  assert.match(GHOSTWRITER_FEEDBACK_ROUTE, /FeedbackChallengeSchema\.safeParse\(body\.data\)/);
  assert.doesNotMatch(GHOSTWRITER_FEEDBACK_ROUTE, /RewriteFeedbackSchema\.extend/);
  assert.doesNotMatch(GHOSTWRITER_FEEDBACK_ROUTE, /text:\s*parsed\.data\.text/);
});

test("rewrite lab input schema trims source fields before enforcing non-empty text", () => {
  assert.match(
    REWRITE_LAB_SERVER,
    /baselineRewrite:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.max\(3_000\)/,
  );
  assert.match(
    REWRITE_LAB_SERVER,
    /source:\s*z\.string\(\)\.trim\(\)\.min\(1\)\.max\(LAB_SOURCE_MAX_LENGTH\)/,
  );
});

test("ghostwriter api routes attach server-generated request ids", () => {
  assert.match(REQUEST_ID_SERVER, /REQUEST_ID_HEADER = "x-request-id"/);

  for (const route of [
    GHOSTWRITER_ROUTE,
    GHOSTWRITER_LAB_ROUTE,
    GHOSTWRITER_SHARE_ROUTE,
    GHOSTWRITER_FEEDBACK_ROUTE,
    GHOSTWRITER_CHALLENGE_ROUTE,
  ]) {
    assert.match(route, /createRequestId\(\)/);
    assert.match(route, /withRequestId\(/);
  }
});
