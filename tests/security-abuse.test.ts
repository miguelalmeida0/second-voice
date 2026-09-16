import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  __issueShieldCookiesForTests,
  __resetAbuseProtectionForTests,
  challengeDifficulty,
  issueChallengeToken,
  resolveClientIp,
  validateGhostwriterHeaders,
  validateGhostwriterLabPost,
  validateGhostwriterPost,
  validateGhostwriterSharePost,
} from "../src/server/abuse-protection.ts";

const ORIGINAL_ENV = { ...process.env };
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/136.0.0.0 Safari/537.36";
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

function configureSecurityEnv(overrides: Record<string, string | undefined> = {}) {
  restoreEnv();
  MUTABLE_ENV.NODE_ENV = "development";
  MUTABLE_ENV.GHOSTWRITER_SECURITY_SECRET = TEST_SIGNING_VALUE;
  MUTABLE_ENV.GHOSTWRITER_TRUST_PROXY = "true";
  MUTABLE_ENV.GHOSTWRITER_ABUSE_STORE_MODE = "memory";
  MUTABLE_ENV.GHOSTWRITER_POW_DIFFICULTY = "3";
  MUTABLE_ENV.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:3000";

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete MUTABLE_ENV[key];
    } else {
      MUTABLE_ENV[key] = value;
    }
  }

  __resetAbuseProtectionForTests();
}

function solveChallenge(challengeToken: string, difficulty: number): string {
  const prefix = "0".repeat(difficulty);

  for (let nonce = 0; nonce < 2_000_000; nonce += 1) {
    const candidate = String(nonce);
    const digest = createHash("sha256").update(`${challengeToken}.${candidate}`).digest("hex");

    if (digest.startsWith(prefix)) {
      return candidate;
    }
  }

  throw new Error("Proof-of-work challenge was not solved within the test budget.");
}

function buildChallengeRequest(sessionToken: string, csrfToken: string, ip = "203.0.113.8") {
  return new Request("http://127.0.0.1:3000/api/ghostwriter/challenge", {
    headers: new Headers({
      cookie: `gw_session=${encodeURIComponent(sessionToken)}; gw_csrf=${encodeURIComponent(csrfToken)}`,
      "sec-fetch-site": "same-origin",
      "user-agent": USER_AGENT,
      "x-ghostwriter-csrf": csrfToken,
      "x-real-ip": ip,
    }),
    method: "GET",
  });
}

function buildRewriteRequest(sessionToken: string, csrfToken: string, ip = "203.0.113.8") {
  return new Request("http://127.0.0.1:3000/api/ghostwriter", {
    body: JSON.stringify({
      author: "tolkien",
      challengeNonce: "0",
      challengeToken: "placeholder",
      mood: 55,
      share: false,
      text: "The road goes ever on.",
    }),
    headers: new Headers({
      "content-type": "application/json",
      cookie: `gw_session=${encodeURIComponent(sessionToken)}; gw_csrf=${encodeURIComponent(csrfToken)}`,
      origin: "http://127.0.0.1:3000",
      referer: "http://127.0.0.1:3000/ghostwriter",
      "sec-fetch-site": "same-origin",
      "user-agent": USER_AGENT,
      "x-ghostwriter-csrf": csrfToken,
      "x-real-ip": ip,
    }),
    method: "POST",
  });
}

function buildLabRequest(sessionToken: string, csrfToken: string, ip = "203.0.113.8") {
  return new Request("http://127.0.0.1:3000/api/ghostwriter/lab", {
    body: JSON.stringify({
      author: "tolkien",
      baselineRewrite: "The road went on under old stars.",
      challengeNonce: "0",
      challengeToken: "placeholder",
      mood: 55,
      source: "The road goes ever on.",
    }),
    headers: new Headers({
      "content-type": "application/json",
      cookie: `gw_session=${encodeURIComponent(sessionToken)}; gw_csrf=${encodeURIComponent(csrfToken)}`,
      origin: "http://127.0.0.1:3000",
      referer: "http://127.0.0.1:3000/second-voice",
      "sec-fetch-site": "same-origin",
      "user-agent": USER_AGENT,
      "x-ghostwriter-csrf": csrfToken,
      "x-real-ip": ip,
    }),
    method: "POST",
  });
}

function buildShareRequest(sessionToken: string, csrfToken: string, ip = "203.0.113.8") {
  return new Request("http://127.0.0.1:3000/api/ghostwriter/share", {
    body: JSON.stringify({
      author: "tolkien",
      challengeNonce: "0",
      challengeToken: "placeholder",
      mood: 55,
      rewrite: "The road went on under old stars.",
      shareConsent: "rewrite_output_public",
      text: "The road goes ever on.",
    }),
    headers: new Headers({
      "content-type": "application/json",
      cookie: `gw_session=${encodeURIComponent(sessionToken)}; gw_csrf=${encodeURIComponent(csrfToken)}`,
      origin: "http://127.0.0.1:3000",
      referer: "http://127.0.0.1:3000/second-voice",
      "sec-fetch-site": "same-origin",
      "user-agent": USER_AGENT,
      "x-ghostwriter-csrf": csrfToken,
      "x-real-ip": ip,
    }),
    method: "POST",
  });
}

function buildHeaderCheckRequest(
  sessionToken: string,
  csrfToken: string,
  options: {
    contentEncoding?: string;
    contentLength?: string;
    contentType?: string;
    origin?: string;
    referer?: string;
    secFetchSite?: string;
    url?: string;
  } = {},
) {
  const headers = new Headers({
    "content-type": options.contentType ?? "application/json",
    cookie: `gw_session=${encodeURIComponent(sessionToken)}; gw_csrf=${encodeURIComponent(csrfToken)}`,
    "sec-fetch-site": options.secFetchSite ?? "same-origin",
    "user-agent": USER_AGENT,
    "x-ghostwriter-csrf": csrfToken,
    "x-real-ip": "203.0.113.8",
  });

  if (options.origin) {
    headers.set("origin", options.origin);
  }

  if (options.referer) {
    headers.set("referer", options.referer);
  }

  if (options.contentLength) {
    headers.set("content-length", options.contentLength);
  }

  if (options.contentEncoding) {
    headers.set("content-encoding", options.contentEncoding);
  }

  return new Request(options.url ?? "http://127.0.0.1:3000/api/ghostwriter", {
    body: "{}",
    headers,
    method: "POST",
  });
}

test.after(() => {
  restoreEnv();
  __resetAbuseProtectionForTests();
});

test("challenge difficulty stays within the browser proof budget", () => {
  configureSecurityEnv({ GHOSTWRITER_POW_DIFFICULTY: "5" });
  assert.equal(challengeDifficulty(), 4);

  configureSecurityEnv({ GHOSTWRITER_POW_DIFFICULTY: "2" });
  assert.equal(challengeDifficulty(), 3);
});

test("challenge tokens are one-time use across validations", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  const challenge = await issueChallengeToken(
    buildChallengeRequest(shield.sessionToken, shield.csrfToken),
  );

  assert.equal("status" in challenge, false);
  if ("status" in challenge) {
    throw new Error(`unexpected challenge failure: ${challenge.error}`);
  }

  const nonce = solveChallenge(challenge.challengeToken, challengeDifficulty());
  const request = buildRewriteRequest(shield.sessionToken, shield.csrfToken);

  const firstValidation = await validateGhostwriterPost(
    request,
    challenge.challengeToken,
    nonce,
  );

  assert.equal("status" in firstValidation, false);

  const replayValidation = await validateGhostwriterPost(
    buildRewriteRequest(shield.sessionToken, shield.csrfToken),
    challenge.challengeToken,
    nonce,
  );

  assert.equal("status" in replayValidation, true);
  if (!("status" in replayValidation)) {
    throw new Error("expected replay protection to block the second validation");
  }
  assert.equal(replayValidation.status, 403);
  assert.match(replayValidation.error, /already used/i);
});

test("rewrite limits trigger a cooldown after repeated submissions", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  let blocked: Awaited<ReturnType<typeof validateGhostwriterPost>> | null = null;

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const challenge = await issueChallengeToken(
      buildChallengeRequest(shield.sessionToken, shield.csrfToken),
    );

    assert.equal("status" in challenge, false);
    if ("status" in challenge) {
      throw new Error(`unexpected challenge failure: ${challenge.error}`);
    }

    const nonce = solveChallenge(challenge.challengeToken, challengeDifficulty());
    const result = await validateGhostwriterPost(
      buildRewriteRequest(shield.sessionToken, shield.csrfToken),
      challenge.challengeToken,
      nonce,
    );

    if ("status" in result) {
      blocked = result;
      break;
    }
  }

  assert.ok(blocked, "expected the layered limiter to block repeated rewrites");
  if (!blocked || !("status" in blocked)) {
    throw new Error("expected the limiter to produce a guard failure");
  }
  assert.equal(blocked.status, 429);
  assert.equal(blocked.code, "ABUSE_COOLDOWN");
  assert.match(blocked.error, /wait/i);
});

test("post ingress limiter blocks repeated pre-body checks", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  let blocked: Awaited<ReturnType<typeof validateGhostwriterHeaders>> | null = null;

  for (let attempt = 0; attempt < 13; attempt += 1) {
    const result = await validateGhostwriterHeaders(
      buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
        origin: "http://127.0.0.1:3000",
        referer: "http://127.0.0.1:3000/second-voice",
      }),
    );

    if ("status" in result) {
      blocked = result;
      break;
    }
  }

  assert.ok(blocked, "expected repeated POST header checks to consume an ingress limiter");
  if (!blocked || !("status" in blocked)) {
    throw new Error("expected the ingress limiter to produce a guard failure");
  }
  assert.equal(blocked.status, 429);
  assert.equal(blocked.code, "ABUSE_COOLDOWN");
  assert.match(blocked.error, /wait/i);
  assert.ok(Number(new Headers(blocked.headers).get("Retry-After") ?? "0") >= 1);
});

test("rewrite lab has a stricter explicit-run limiter", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  let blocked: Awaited<ReturnType<typeof validateGhostwriterLabPost>> | null = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const challenge = await issueChallengeToken(
      buildChallengeRequest(shield.sessionToken, shield.csrfToken),
    );

    assert.equal("status" in challenge, false);
    if ("status" in challenge) {
      throw new Error(`unexpected challenge failure: ${challenge.error}`);
    }

    const nonce = solveChallenge(challenge.challengeToken, challengeDifficulty());
    const result = await validateGhostwriterLabPost(
      buildLabRequest(shield.sessionToken, shield.csrfToken),
      challenge.challengeToken,
      nonce,
    );

    if ("status" in result) {
      blocked = result;
      break;
    }
  }

  assert.ok(blocked, "expected the lab-specific limiter to block repeated lab runs");
  if (!blocked || !("status" in blocked)) {
    throw new Error("expected the lab limiter to produce a guard failure");
  }
  assert.equal(blocked.status, 429);
  assert.equal(blocked.code, "ABUSE_COOLDOWN");
  assert.match(blocked.error, /wait/i);
  assert.ok(Number(new Headers(blocked.headers).get("Retry-After") ?? "0") >= 1);
});

test("public share creation has its own strict limiter", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  let blocked: Awaited<ReturnType<typeof validateGhostwriterSharePost>> | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const challenge = await issueChallengeToken(
      buildChallengeRequest(shield.sessionToken, shield.csrfToken),
    );

    assert.equal("status" in challenge, false);
    if ("status" in challenge) {
      throw new Error(`unexpected challenge failure: ${challenge.error}`);
    }

    const nonce = solveChallenge(challenge.challengeToken, challengeDifficulty());
    const result = await validateGhostwriterSharePost(
      buildShareRequest(shield.sessionToken, shield.csrfToken),
      challenge.challengeToken,
      nonce,
    );

    if ("status" in result) {
      blocked = result;
      break;
    }
  }

  assert.ok(blocked, "expected the share-specific limiter to block repeated public links");
  if (!blocked || !("status" in blocked)) {
    throw new Error("expected the share limiter to produce a guard failure");
  }
  assert.equal(blocked.status, 429);
  assert.equal(blocked.code, "ABUSE_COOLDOWN");
  assert.match(blocked.error, /wait/i);
  assert.ok(Number(new Headers(blocked.headers).get("Retry-After") ?? "0") >= 1);
});

test("proxy IP handling ignores spoofed headers unless trust is enabled", () => {
  const headers = new Headers({
    "cf-connecting-ip": "198.51.100.7",
    "x-forwarded-for": "198.51.100.8, 10.0.0.1",
    "x-real-ip": "198.51.100.9",
  });

  assert.equal(resolveClientIp(headers, false), "unknown");
  assert.equal(resolveClientIp(headers, true), "198.51.100.7");
  assert.equal(resolveClientIp(headers, true, undefined, "production"), "unknown");
  assert.equal(
    resolveClientIp(headers, true, "x-forwarded-for", "production"),
    "198.51.100.8",
  );
  assert.equal(resolveClientIp(headers, true, "x-real-ip", "production"), "198.51.100.9");
});

test("malformed shield cookies fail closed instead of throwing", async () => {
  configureSecurityEnv();
  const result = await issueChallengeToken(
    new Request("http://127.0.0.1:3000/api/ghostwriter/challenge", {
      headers: new Headers({
        cookie: "gw_session=%E0%A4%A; gw_csrf=%E0%A4%A",
        "sec-fetch-site": "same-origin",
        "user-agent": USER_AGENT,
        "x-ghostwriter-csrf": "%E0%A4%A",
      }),
      method: "GET",
    }),
  );

  assert.equal("status" in result, true);
  if (!("status" in result)) {
    throw new Error("expected malformed cookies to be rejected");
  }
  assert.equal(result.status, 403);
});

test("json requests require an exact application/json media type", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  const request = buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
    contentType: "text/plain; application/json",
    origin: "http://127.0.0.1:3000",
    referer: "http://127.0.0.1:3000/second-voice",
  });

  const result = await validateGhostwriterHeaders(request);

  assert.equal("status" in result, true);
  if (!("status" in result)) {
    throw new Error("expected smuggled content-type to be rejected");
  }
  assert.equal(result.status, 415);
});

test("compressed request bodies are rejected before parsing", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  const request = buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
    contentEncoding: "gzip",
    origin: "http://127.0.0.1:3000",
    referer: "http://127.0.0.1:3000/second-voice",
  });

  const result = await validateGhostwriterHeaders(request);

  assert.equal("status" in result, true);
  if (!("status" in result)) {
    throw new Error("expected compressed body to be rejected");
  }
  assert.equal(result.status, 415);
});

test("malformed content-length is rejected before body parsing", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  const request = buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
    contentLength: "12x",
    origin: "http://127.0.0.1:3000",
    referer: "http://127.0.0.1:3000/second-voice",
  });

  const result = await validateGhostwriterHeaders(request);

  assert.equal("status" in result, true);
  if (!("status" in result)) {
    throw new Error("expected malformed content-length to be rejected");
  }
  assert.equal(result.status, 413);
});

test("missing production secrets fail closed", async () => {
  configureSecurityEnv({
    GHOSTWRITER_SECURITY_SECRET: undefined,
    NODE_ENV: "production",
  });

  const challenge = await issueChallengeToken(new Request("http://127.0.0.1:3000/api/ghostwriter/challenge"));

  assert.equal("status" in challenge, true);
  if (!("status" in challenge)) {
    throw new Error("expected production config failure to block challenge issuance");
  }
  assert.equal(challenge.status, 503);
});

test("mutating requests trust configured site origin instead of the request host", async () => {
  configureSecurityEnv({
    NEXT_PUBLIC_SITE_URL: "https://ghostwriter.example",
    NODE_ENV: "production",
  });

  const shield = __issueShieldCookiesForTests(USER_AGENT);
  const forgedHostRequest = buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
    origin: "https://evil.example",
    referer: "https://evil.example/ghostwriter",
    url: "https://evil.example/api/ghostwriter",
  });

  const forgedHostResult = await validateGhostwriterHeaders(forgedHostRequest);

  assert.equal("status" in forgedHostResult, true);
  if (!("status" in forgedHostResult)) {
    throw new Error("expected the forged host request to fail origin validation");
  }
  assert.equal(forgedHostResult.status, 403);
  assert.match(forgedHostResult.error, /origin/i);

  const canonicalOriginRequest = buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
    origin: "https://ghostwriter.example",
    referer: "https://ghostwriter.example/ghostwriter",
    url: "https://evil.example/api/ghostwriter",
  });

  const canonicalOriginResult = await validateGhostwriterHeaders(canonicalOriginRequest);

  assert.equal("status" in canonicalOriginResult, true);
  if (!("status" in canonicalOriginResult)) {
    throw new Error("expected production abuse store configuration to fail closed");
  }
  assert.equal(canonicalOriginResult.status, 503);
  assert.doesNotMatch(canonicalOriginResult.error, /origin/i);
});

test("development also trusts the live local request origin alongside NEXT_PUBLIC_SITE_URL", async () => {
  configureSecurityEnv({
    NEXT_PUBLIC_SITE_URL: "https://ghostwriter.example",
  });

  const shield = __issueShieldCookiesForTests(USER_AGENT);
  const localOriginRequest = buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
    origin: "http://127.0.0.1:3000",
    referer: "http://127.0.0.1:3000/ghostwriter",
  });

  const result = await validateGhostwriterHeaders(localOriginRequest);

  assert.equal("status" in result, false);
});

test("production same-origin fetch metadata alone does not authorize mutating requests", async () => {
  configureSecurityEnv({
    NODE_ENV: "production",
  });
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  const request = buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
    secFetchSite: "same-origin",
  });

  const result = await validateGhostwriterHeaders(request);

  assert.equal("status" in result, true);
  if (!("status" in result)) {
    throw new Error("expected request without origin or referer to fail");
  }
  assert.equal(result.status, 403);
  assert.match(result.error, /origin/i);
});

test("development accepts same-origin browser requests without origin headers", async () => {
  configureSecurityEnv();
  const shield = __issueShieldCookiesForTests(USER_AGENT);
  const request = buildHeaderCheckRequest(shield.sessionToken, shield.csrfToken, {
    secFetchSite: "same-origin",
  });

  request.headers.delete("origin");
  request.headers.delete("referer");

  const result = await validateGhostwriterHeaders(request);

  assert.equal("status" in result, false);
});
