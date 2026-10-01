import test from "node:test";
import assert from "node:assert/strict";
import {
  __resetRewriteArtifactTokenForTests,
  issueRewriteArtifactToken,
  verifyRewriteArtifactToken,
} from "../src/server/ghostwriter-artifact-token.ts";

const ORIGINAL_ENV = { ...process.env };
const MUTABLE_ENV = process.env as Record<string, string | undefined>;
const TEST_SIGNING_VALUE = "ghostwriter-fixture-".repeat(2);

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function configureTokenEnv() {
  restoreEnv();
  MUTABLE_ENV.NODE_ENV = "development";
  MUTABLE_ENV.GHOSTWRITER_SECURITY_SECRET = TEST_SIGNING_VALUE;
  __resetRewriteArtifactTokenForTests();
}

test.after(() => {
  restoreEnv();
  __resetRewriteArtifactTokenForTests();
});

test("rewrite artifact tokens bind the exact rewrite and source", () => {
  configureTokenEnv();
  const artifactToken = issueRewriteArtifactToken({
    author: "tolkien",
    generationSource: "single_rewrite",
    labSelectionReason: null,
    labWinnerLabel: null,
    labWinnerScore: null,
    mode: "author",
    mood: 52,
    outcome: null,
    rewrite: "The road went on under old stars.",
    source: "The road goes ever on.",
  });

  const verified = verifyRewriteArtifactToken({
    artifactToken,
    author: "tolkien",
    mode: "author",
    mood: 52,
    outcome: "clarity",
    rewrite: "The road went on under old stars.",
    source: "The road goes ever on.",
  });

  assert.equal(verified?.generationSource, "single_rewrite");
  assert.equal(verified?.outcome, null);

  assert.equal(
    verifyRewriteArtifactToken({
      artifactToken,
      author: "tolkien",
      mode: "author",
      mood: 52,
      outcome: "clarity",
      rewrite: "A forged public rewrite.",
      source: "The road goes ever on.",
    }),
    null,
  );

  assert.equal(
    verifyRewriteArtifactToken({
      artifactToken,
      author: "tolkien",
      mode: "author",
      mood: 52,
      outcome: "clarity",
      rewrite: "The road went on under old stars.",
      source: "Different source text.",
    }),
    null,
  );
});

test("rewrite lab artifact tokens carry public-safe verified provenance", () => {
  configureTokenEnv();
  const artifactToken = issueRewriteArtifactToken({
    author: "tolkien",
    generationSource: "rewrite_lab",
    labSelectionReason:
      "Keep the meaning was selected for its 94/100 balance of meaning, voice, readability, and low overreach risk.",
    labWinnerLabel: "Keep the meaning",
    labWinnerScore: 94,
    mode: "author",
    mood: 52,
    outcome: null,
    rewrite: "If this finds you on a hard day, remember: being weary is not defeat.",
    source: "If you are reading this on a hard day, being tired is not failing.",
  });

  const verified = verifyRewriteArtifactToken({
    artifactToken,
    author: "tolkien",
    mode: "author",
    mood: 52,
    outcome: "clarity",
    rewrite: "If this finds you on a hard day, remember: being weary is not defeat.",
    source: "If you are reading this on a hard day, being tired is not failing.",
  });

  assert.equal(verified?.generationSource, "rewrite_lab");
  assert.equal(verified?.labWinnerLabel, "Keep the meaning");
  assert.equal(verified?.labWinnerScore, 94);
  assert.match(verified?.labSelectionReason ?? "", /94\/100 balance/);
});
