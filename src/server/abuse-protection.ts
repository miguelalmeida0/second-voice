import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { signingKey, rejectAmbiguousSecrets } from "./signing-purpose.ts";
import type { NextRequest } from "next/server";
import {
  consumeAbuseRateLimits,
  consumeChallengeToken,
  escalatePenalty,
  hashAbuseKey,
  logAbuseStoreFailure,
  __resetAbuseStoreForTests,
  type AbuseRateRule,
} from "./abuse-store.ts";
import {
  normalizeTrustedClientIpHeader,
  normalizeIpAddress,
  normalizeSiteOrigin,
  resolveSecuritySecret,
  shouldTrustProxy,
} from "../lib/security-env.ts";
import { logSecurityEvent } from "./security-events.ts";

export const GHOSTWRITER_SESSION_COOKIE = "gw_session";
export const GHOSTWRITER_CSRF_COOKIE = "gw_csrf";
export const GHOSTWRITER_MAX_BODY_BYTES = 10_000;

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CHALLENGE_TTL_MS = 90 * 1000;
const SUSPICIOUS_USER_AGENT =
  /(bot|spider|crawl|curl|wget|python|httpx|postman|insomnia|scrapy|java|go-http-client|libwww|headless|phantom|selenium|playwright)/i;

type SignedPayload = {
  exp: number;
  iat: number;
  sid: string;
  ua: string;
};

type SessionPayload = SignedPayload;

type CsrfPayload = SignedPayload & {
  nonce: string;
};

type ChallengePayload = SignedPayload & {
  difficulty: number;
  nonce: string;
};

type ShieldCookies = {
  csrfToken: string;
  needsSet: boolean;
  sessionToken: string;
};

type GuardSuccess = {
  csrfToken: string;
  ip: string;
  penaltyKeyHashes: string[];
  sessionId: string;
  userAgent: string;
};

type GuardFailure = {
  error: string;
  headers?: HeadersInit;
  status: number;
};

let cachedEphemeralSecret: string | null = null;
let warnedAboutEphemeralSecret = false;

function clampDifficulty(raw: string | undefined): number {
  const parsed = Number.parseInt(raw ?? "4", 10);

  if (!Number.isFinite(parsed)) {
    return 4;
  }

  return Math.max(3, Math.min(4, parsed));
}

function now(): number {
  return Date.now();
}

function secret(): string {
  rejectAmbiguousSecrets();
  if (!cachedEphemeralSecret) {
    cachedEphemeralSecret = randomBytes(32).toString("base64url");
  }

  const resolved = resolveSecuritySecret({
    configuredSecret: process.env.GHOSTWRITER_SECURITY_SECRET,
    ephemeralSecret: cachedEphemeralSecret,
    nodeEnv: process.env.NODE_ENV,
  });

  if (resolved.mode === "configured" && resolved.secret) {
    return resolved.secret;
  }

  if (resolved.mode === "ephemeral" && resolved.secret) {
    if (!warnedAboutEphemeralSecret) {
      warnedAboutEphemeralSecret = true;
      logSecurityEvent("security_config_warning", {
        message:
          "GHOSTWRITER_SECURITY_SECRET is missing or weak. Falling back to an ephemeral development secret.",
      });
    }

    return resolved.secret;
  }

  throw new Error(resolved.reason ?? "Security secret unavailable.");
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signToken(kind: string, payload: Record<string, unknown>): string {
  rejectAmbiguousSecrets();
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = createHmac("sha256", signingKey(secret(), kind)).update(`${kind}.${encodedPayload}`).digest("base64url");
  return `${encodedPayload}.${signature}`;
}

function verifyToken<T>(kind: string, token: string): T | null {
  const parts = token.split(".");

  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;

  if (!encodedPayload || !signature) {
    return null;
  }

  const expectedSignature = createHmac("sha256", signingKey(secret(), kind))
    .update(`${kind}.${encodedPayload}`)
    .digest("base64url");

  try {
    const signatureBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    return JSON.parse(base64UrlDecode(encodedPayload)) as T;
  } catch {
    return null;
  }
}

function userAgentHash(userAgent: string): string {
  return createHash("sha256").update(userAgent || "unknown").digest("hex").slice(0, 16);
}

function randomToken(length = 24): string {
  return randomBytes(length).toString("base64url");
}

function issueSession(userAgent: string): ShieldCookies {
  const sid = randomToken(18);
  const issuedAt = now();
  const ua = userAgentHash(userAgent);

  const sessionToken = signToken("gw.session", {
    exp: issuedAt + SESSION_TTL_MS,
    iat: issuedAt,
    sid,
    ua,
  } satisfies SessionPayload);

  const csrfToken = signToken("gw.csrf", {
    exp: issuedAt + SESSION_TTL_MS,
    iat: issuedAt,
    nonce: randomToken(12),
    sid,
    ua,
  } satisfies CsrfPayload);

  return {
    csrfToken,
    needsSet: true,
    sessionToken,
  };
}

function verifySessionToken(token: string | undefined, userAgent: string): SessionPayload | null {
  if (!token) {
    return null;
  }

  const payload = verifyToken<SessionPayload>("gw.session", token);

  if (!payload) {
    return null;
  }

  if (payload.exp <= now() || payload.ua !== userAgentHash(userAgent)) {
    return null;
  }

  return payload;
}

function verifyCsrfToken(
  csrfToken: string | undefined,
  session: SessionPayload,
  userAgent: string,
): CsrfPayload | null {
  if (!csrfToken) {
    return null;
  }

  const payload = verifyToken<CsrfPayload>("gw.csrf", csrfToken);

  if (!payload) {
    return null;
  }

  if (
    payload.exp <= now() ||
    payload.sid !== session.sid ||
    payload.ua !== userAgentHash(userAgent)
  ) {
    return null;
  }

  return payload;
}

function contentLength(headers: Headers): number {
  const raw = headers.get("content-length");

  if (!raw) {
    return 0;
  }

  const trimmed = raw.trim();

  if (!/^\d+$/.test(trimmed)) {
    return GHOSTWRITER_MAX_BODY_BYTES + 1;
  }

  return Number.parseInt(trimmed, 10);
}

function fingerprintSeed(ip: string, sessionId: string, userAgent: string): string {
  return createHash("sha256")
    .update(`${ip}|${sessionId}|${userAgent || "unknown"}`)
    .digest("hex");
}

function uniqueKeyHashes(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function allowedOrigins(request: Request): Set<string> {
  const siteOrigin = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
  const nodeEnv = process.env.NODE_ENV ?? "development";
  const origins = new Set<string>();

  if (siteOrigin) {
    origins.add(siteOrigin);
  }

  if (nodeEnv === "production") {
    return origins;
  }

  try {
    const requestOrigin = new URL(request.url).origin;
    origins.add(requestOrigin);
  } catch {
    // ignore malformed internal request URLs and fall back to NEXT_PUBLIC_SITE_URL
  }

  return origins;
}

function developmentSameOriginFallback(request: Request, origins: Set<string>): boolean {
  if ((process.env.NODE_ENV ?? "development") === "production") {
    return false;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");

  if (secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
    return false;
  }

  try {
    return origins.has(new URL(request.url).origin);
  } catch {
    return false;
  }
}

function sameOrigin(value: string | null, origins: Set<string>): boolean {
  if (!value) {
    return false;
  }

  try {
    return origins.has(new URL(value).origin);
  } catch {
    return false;
  }
}

function buildPenaltyKeyHashes(ip: string, sessionId: string, userAgent: string): string[] {
  const fingerprint = hashAbuseKey("fingerprint", fingerprintSeed(ip, sessionId, userAgent));

  return uniqueKeyHashes([
    hashAbuseKey("session", sessionId),
    fingerprint,
    ip === "unknown" ? null : hashAbuseKey("ip", ip),
  ]);
}

function buildChallengeRateRules(ip: string, sessionId: string, userAgent: string): AbuseRateRule[] {
  return uniqueKeyHashes([
    hashAbuseKey("challenge-session", sessionId),
    hashAbuseKey("challenge-fingerprint", fingerprintSeed(ip, sessionId, userAgent)),
    ip === "unknown" ? null : hashAbuseKey("challenge-ip", ip),
  ]).map((keyHash, index) => ({
    keyHash,
    limit: index === 0 ? 6 : index === 1 ? 9 : 12,
    windowMs: 5 * 60 * 1000,
  }));
}

function buildPostIngressRateRules(ip: string, sessionId: string, userAgent: string): AbuseRateRule[] {
  const rules: AbuseRateRule[] = [
    { keyHash: hashAbuseKey("post-session-burst", sessionId), limit: 12, windowMs: 60 * 1000 },
    {
      keyHash: hashAbuseKey("post-session-five-minute", sessionId),
      limit: 30,
      windowMs: 5 * 60 * 1000,
    },
    {
      keyHash: hashAbuseKey("post-fingerprint-five-minute", fingerprintSeed(ip, sessionId, userAgent)),
      limit: 36,
      windowMs: 5 * 60 * 1000,
    },
  ];

  if (ip !== "unknown") {
    rules.push({
      keyHash: hashAbuseKey("post-ip-five-minute", ip),
      limit: 60,
      windowMs: 5 * 60 * 1000,
    });
  }

  return rules;
}

function buildRewriteRateRules(ip: string, sessionId: string, userAgent: string): AbuseRateRule[] {
  const rules: AbuseRateRule[] = [
    { keyHash: hashAbuseKey("rewrite-session-burst", sessionId), limit: 3, windowMs: 60 * 1000 },
    {
      keyHash: hashAbuseKey("rewrite-session-ten-minute", sessionId),
      limit: 8,
      windowMs: 10 * 60 * 1000,
    },
    {
      keyHash: hashAbuseKey("rewrite-fingerprint", fingerprintSeed(ip, sessionId, userAgent)),
      limit: 8,
      windowMs: 10 * 60 * 1000,
    },
  ];

  if (ip !== "unknown") {
    rules.push(
      { keyHash: hashAbuseKey("rewrite-ip-burst", ip), limit: 4, windowMs: 60 * 1000 },
      { keyHash: hashAbuseKey("rewrite-ip-ten-minute", ip), limit: 12, windowMs: 10 * 60 * 1000 },
    );
  }

  return rules;
}

function buildLabRateRules(ip: string, sessionId: string, userAgent: string): AbuseRateRule[] {
  const rules: AbuseRateRule[] = [
    {
      keyHash: hashAbuseKey("lab-session-ten-minute", sessionId),
      limit: 2,
      windowMs: 10 * 60 * 1000,
    },
    {
      keyHash: hashAbuseKey("lab-fingerprint-ten-minute", fingerprintSeed(ip, sessionId, userAgent)),
      limit: 3,
      windowMs: 10 * 60 * 1000,
    },
  ];

  if (ip !== "unknown") {
    rules.push({
      keyHash: hashAbuseKey("lab-ip-hour", ip),
      limit: 6,
      windowMs: 60 * 60 * 1000,
    });
  }

  return rules;
}

function buildShareRateRules(ip: string, sessionId: string, userAgent: string): AbuseRateRule[] {
  const rules: AbuseRateRule[] = [
    { keyHash: hashAbuseKey("share-session-burst", sessionId), limit: 2, windowMs: 60 * 1000 },
    {
      keyHash: hashAbuseKey("share-session-hour", sessionId),
      limit: 8,
      windowMs: 60 * 60 * 1000,
    },
    {
      keyHash: hashAbuseKey("share-fingerprint-hour", fingerprintSeed(ip, sessionId, userAgent)),
      limit: 10,
      windowMs: 60 * 60 * 1000,
    },
  ];

  if (ip !== "unknown") {
    rules.push({
      keyHash: hashAbuseKey("share-ip-hour", ip),
      limit: 18,
      windowMs: 60 * 60 * 1000,
    });
  }

  return rules;
}

function buildFeedbackRateRules(ip: string, sessionId: string, userAgent: string): AbuseRateRule[] {
  const rules: AbuseRateRule[] = [
    {
      keyHash: hashAbuseKey("feedback-session-ten-minute", sessionId),
      limit: 6,
      windowMs: 10 * 60 * 1000,
    },
    {
      keyHash: hashAbuseKey("feedback-fingerprint-hour", fingerprintSeed(ip, sessionId, userAgent)),
      limit: 12,
      windowMs: 60 * 60 * 1000,
    },
  ];

  if (ip !== "unknown") {
    rules.push({
      keyHash: hashAbuseKey("feedback-ip-hour", ip),
      limit: 18,
      windowMs: 60 * 60 * 1000,
    });
  }

  return rules;
}

function readCookie(headers: Headers, name: string): string | undefined {
  const cookieHeader = headers.get("cookie");

  if (!cookieHeader) {
    return undefined;
  }

  const prefix = `${name}=`;
  for (const part of cookieHeader.split(/;\s*/)) {
    if (part.startsWith(prefix)) {
      try {
        return decodeURIComponent(part.slice(prefix.length));
      } catch {
        return undefined;
      }
    }
  }

  return undefined;
}

export function resolveClientIp(
  headers: Headers,
  trustProxy = shouldTrustProxy(process.env.GHOSTWRITER_TRUST_PROXY),
  trustedHeader = process.env.GHOSTWRITER_CLIENT_IP_HEADER,
  nodeEnv = process.env.NODE_ENV ?? "development",
): string {
  if (!trustProxy) {
    return "unknown";
  }

  const configuredHeader = normalizeTrustedClientIpHeader(trustedHeader);

  if (configuredHeader) {
    const rawValue = headers.get(configuredHeader);
    const candidate =
      configuredHeader === "x-forwarded-for" ? rawValue?.split(",")[0] : rawValue;

    return normalizeIpAddress(candidate ?? "unknown");
  }

  if (nodeEnv === "production") {
    return "unknown";
  }

  return normalizeIpAddress(
    headers.get("cf-connecting-ip") ||
      headers.get("fly-client-ip") ||
      headers.get("x-real-ip") ||
      headers.get("x-forwarded-for")?.split(",")[0] ||
      "unknown",
  );
}

function ensureSecurityConfigured(): GuardFailure | null {
  try {
    secret();
    return null;
  } catch (error) {
    logSecurityEvent("security_config_error", {
      error: error instanceof Error ? error.message : "unknown",
    });

    return {
      error: "Security configuration unavailable.",
      status: 503,
    };
  }
}

export function cookieSettings() {
  return {
    httpOnly: true,
    maxAge: SESSION_TTL_MS / 1000,
    path: "/",
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

export function ensureShieldCookies(request: NextRequest): ShieldCookies {
  const userAgent = request.headers.get("user-agent") ?? "";
  const sessionToken = request.cookies.get(GHOSTWRITER_SESSION_COOKIE)?.value;
  const csrfToken = request.cookies.get(GHOSTWRITER_CSRF_COOKIE)?.value;
  const session = verifySessionToken(sessionToken, userAgent);
  const csrf = session ? verifyCsrfToken(csrfToken, session, userAgent) : null;

  if (session && csrf && sessionToken && csrfToken) {
    return {
      csrfToken,
      needsSet: false,
      sessionToken,
    };
  }

  return issueSession(userAgent);
}

export function challengeDifficulty(): number {
  return clampDifficulty(process.env.GHOSTWRITER_POW_DIFFICULTY);
}

async function reject(
  error: string,
  status: number,
  guard?: Pick<GuardSuccess, "ip" | "penaltyKeyHashes" | "sessionId">,
  severity = 1,
  presetRetryAfterSeconds = 0,
): Promise<GuardFailure> {
  let retryAfterSeconds = Math.max(0, presetRetryAfterSeconds);

  if (guard) {
    try {
      retryAfterSeconds = Math.max(
        retryAfterSeconds,
        await escalatePenalty(guard.penaltyKeyHashes, severity, now()),
      );
    } catch (storeError) {
      logAbuseStoreFailure("reject", storeError);
    }
  }

  logSecurityEvent("request_blocked", {
    error,
    ip: guard?.ip ?? "unknown",
    retryAfter: retryAfterSeconds,
    sessionId: guard?.sessionId,
    severity,
    status,
  });

  return {
    error,
    headers: retryAfterSeconds > 0 ? { "Retry-After": String(retryAfterSeconds) } : undefined,
    status,
  };
}

async function enforceRateLimits(
  rules: AbuseRateRule[],
  guard: GuardSuccess,
  location: "challenge" | "feedback" | "ingress" | "lab" | "rewrite" | "share"
    | `auth-${"send-code" | "verify" | "refresh" | "logout" | "status"}`,
): Promise<GuardFailure | null> {
  try {
    const result = await consumeAbuseRateLimits(rules, guard.penaltyKeyHashes, now());

    if (result.allowed) {
      return null;
    }

    return reject(
      "Too many requests. Cooldown in progress.",
      429,
      guard,
      location === "rewrite" || location === "lab" || location === "share" ? 2 : 1,
      result.retryAfterSeconds,
    );
  } catch (error) {
    logAbuseStoreFailure(`rate_limit_${location}`, error);

    return {
      error: "Protection temporarily unavailable.",
      status: 503,
    };
  }
}

export async function validateBrowserGuard(request: Request): Promise<GuardSuccess | GuardFailure> {
  const securityFailure = ensureSecurityConfigured();

  if (securityFailure) {
    return securityFailure;
  }

  const origins = allowedOrigins(request);
  const userAgent = request.headers.get("user-agent") ?? "";
  const ip = resolveClientIp(request.headers);
  const sessionToken = readCookie(request.headers, GHOSTWRITER_SESSION_COOKIE);
  const csrfCookie = readCookie(request.headers, GHOSTWRITER_CSRF_COOKIE);
  const csrfHeader = request.headers.get("x-ghostwriter-csrf") ?? "";
  const session = verifySessionToken(sessionToken, userAgent);

  if (!session) {
    return reject("Security session expired. Refresh and try again.", 403, undefined, 1);
  }

  const guard = {
    csrfToken: csrfHeader,
    ip,
    penaltyKeyHashes: buildPenaltyKeyHashes(ip, session.sid, userAgent),
    sessionId: session.sid,
    userAgent,
  } satisfies GuardSuccess;

  if (!userAgent || SUSPICIOUS_USER_AGENT.test(userAgent)) {
    return reject("Request blocked.", 403, guard, 2);
  }

  const secFetchSite = request.headers.get("sec-fetch-site");

  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
    return reject("Cross-site request blocked.", 403, guard, 2);
  }

  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const hasSameOriginSignal =
      (origin ? sameOrigin(origin, origins) : false) ||
      (referer ? sameOrigin(referer, origins) : false) ||
      developmentSameOriginFallback(request, origins);

    if (!hasSameOriginSignal) {
      return reject("Origin check failed.", 403, guard, 2);
    }
  }

  const csrf = verifyCsrfToken(csrfCookie, session, userAgent);

  if (!csrf || !csrfHeader || csrfHeader !== csrfCookie) {
    return reject("Request verification failed.", 403, guard, 2);
  }

  if ((process.env.NODE_ENV ?? "development") === "production" && guard.ip === "unknown") {
    return reject("Client identity unavailable.", 503, guard, 1);
  }

  return guard;
}

async function validateChallengeProof(
  guard: GuardSuccess,
  challengeToken: string,
  challengeNonce: string,
): Promise<GuardFailure | null> {
  const challenge = verifyToken<ChallengePayload>("gw.challenge", challengeToken);

  if (!challenge || challenge.exp <= now()) {
    return reject("Challenge expired. Try again.", 403, guard, 1);
  }

  if (
    challenge.sid !== guard.sessionId ||
    challenge.ua !== userAgentHash(guard.userAgent) ||
    challenge.difficulty !== challengeDifficulty()
  ) {
    return reject("Challenge invalid.", 403, guard, 2);
  }

  if (!/^\d{1,10}$/.test(challengeNonce)) {
    return reject("Challenge invalid.", 403, guard, 1);
  }

  const digest = createHash("sha256").update(`${challengeToken}.${challengeNonce}`).digest("hex");
  const prefix = "0".repeat(challenge.difficulty);

  if (!digest.startsWith(prefix)) {
    return reject("Challenge proof failed.", 403, guard, 2);
  }

  try {
    const wasConsumed = await consumeChallengeToken(
      hashAbuseKey("challenge", challengeToken),
      challenge.exp,
      now(),
    );

    if (!wasConsumed) {
      logSecurityEvent("challenge_replay_detected", {
        ip: guard.ip,
        sessionId: guard.sessionId,
      });
      return reject("Challenge already used.", 403, guard, 3);
    }
  } catch (error) {
    logAbuseStoreFailure("challenge_consume", error);

    return {
      error: "Protection temporarily unavailable.",
      status: 503,
    };
  }

  return null;
}

export async function validateGhostwriterHeaders(request: Request, purpose: "rewrite" | "auth" = "rewrite"): Promise<GuardSuccess | GuardFailure> {
  const guard = await validateBrowserGuard(request);

  if ("status" in guard) {
    return guard;
  }

  if (request.method !== "GET") {
    const ingressRateFailure = await enforceRateLimits(
      purpose === "auth"
        ? [{ keyHash: hashAbuseKey("auth-ingress", guard.sessionId), limit: 30, windowMs: 60_000 }]
        : buildPostIngressRateRules(guard.ip, guard.sessionId, guard.userAgent),
      guard,
      "ingress",
    );

    if (ingressRateFailure) {
      return ingressRateFailure;
    }
  }

  const contentType = request.headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();
  const contentEncoding = request.headers.get("content-encoding")?.trim().toLowerCase();

  if (mediaType !== "application/json") {
    return reject("Unsupported request format.", 415, guard, 1);
  }

  if (contentEncoding && contentEncoding !== "identity") {
    return reject("Compressed request bodies are not supported.", 415, guard, 1);
  }

  const length = contentLength(request.headers);

  if (length > GHOSTWRITER_MAX_BODY_BYTES) {
    return reject("Request too large.", 413, guard, 1);
  }

  return guard;
}

export async function issueChallengeToken(
  request: Request,
): Promise<{ challengeToken: string; difficulty: number } | GuardFailure> {
  const guard = await validateBrowserGuard(request);

  if ("status" in guard) {
    return guard;
  }

  const challengeRateFailure = await enforceRateLimits(
    buildChallengeRateRules(guard.ip, guard.sessionId, guard.userAgent),
    guard,
    "challenge",
  );

  if (challengeRateFailure) {
    return challengeRateFailure;
  }

  const issuedAt = now();
  const difficulty = challengeDifficulty();
  const challengeToken = signToken("gw.challenge", {
    difficulty,
    exp: issuedAt + CHALLENGE_TTL_MS,
    iat: issuedAt,
    nonce: randomToken(12),
    sid: guard.sessionId,
    ua: userAgentHash(guard.userAgent),
  } satisfies ChallengePayload);

  return {
    challengeToken,
    difficulty,
  };
}

export async function validateGhostwriterPost(
  request: Request,
  challengeToken: string,
  challengeNonce: string,
  prevalidatedGuard?: GuardSuccess,
): Promise<GuardSuccess | GuardFailure> {
  const guard = prevalidatedGuard ?? (await validateGhostwriterHeaders(request));

  if ("status" in guard) {
    return guard;
  }

  const rewriteRateFailure = await enforceRateLimits(
    buildRewriteRateRules(guard.ip, guard.sessionId, guard.userAgent),
    guard,
    "rewrite",
  );

  if (rewriteRateFailure) {
    return rewriteRateFailure;
  }

  const challengeFailure = await validateChallengeProof(guard, challengeToken, challengeNonce);

  if (challengeFailure) {
    return challengeFailure;
  }

  return guard;
}

export async function validateGhostwriterAuthPost(
  guard: GuardSuccess,
  action: "send-code" | "verify" | "refresh" | "logout" | "status" | "github",
  challengeToken?: string,
  challengeNonce?: string,
): Promise<GuardSuccess | GuardFailure> {
  const limit = action === "send-code" ? 2 : 10;
  const windowMs = action === "send-code" ? 600_000 : 60_000;
  const rules = [{keyHash: hashAbuseKey(`auth-${action}-session`, guard.sessionId),limit,windowMs}];
  if (guard.ip) rules.push({keyHash:hashAbuseKey(`auth-${action}-ip`,guard.ip),limit:limit * 3,windowMs});
  const failure = await enforceRateLimits(rules, guard, action==="github"?"auth-verify":`auth-${action}`);
  if (failure) return failure;
  // Revocation/status retain same-origin, CSRF, session and independent rate
  // checks. They must not depend on generation or challenge issuance capacity.
  if (action === "logout" || action === "status") return guard;
  if (!challengeToken || !challengeNonce) return {error:"Challenge required.",status:403};
  return await validateChallengeProof(guard, challengeToken, challengeNonce) ?? guard;
}

export async function validateGhostwriterLabPost(
  request: Request,
  challengeToken: string,
  challengeNonce: string,
  prevalidatedGuard?: GuardSuccess,
): Promise<GuardSuccess | GuardFailure> {
  const guard = prevalidatedGuard ?? (await validateGhostwriterHeaders(request));

  if ("status" in guard) {
    return guard;
  }

  const labRateFailure = await enforceRateLimits(
    buildLabRateRules(guard.ip, guard.sessionId, guard.userAgent),
    guard,
    "lab",
  );

  if (labRateFailure) {
    return labRateFailure;
  }

  const challengeFailure = await validateChallengeProof(guard, challengeToken, challengeNonce);

  if (challengeFailure) {
    return challengeFailure;
  }

  return guard;
}

export async function validateGhostwriterSharePost(
  request: Request,
  challengeToken: string,
  challengeNonce: string,
  prevalidatedGuard?: GuardSuccess,
): Promise<GuardSuccess | GuardFailure> {
  const guard = prevalidatedGuard ?? (await validateGhostwriterHeaders(request));

  if ("status" in guard) {
    return guard;
  }

  const shareRateFailure = await enforceRateLimits(
    buildShareRateRules(guard.ip, guard.sessionId, guard.userAgent),
    guard,
    "share",
  );

  if (shareRateFailure) {
    return shareRateFailure;
  }

  const challengeFailure = await validateChallengeProof(guard, challengeToken, challengeNonce);

  if (challengeFailure) {
    return challengeFailure;
  }

  return guard;
}

export async function validateGhostwriterFeedbackPost(
  request: Request,
  challengeToken: string,
  challengeNonce: string,
  prevalidatedGuard?: GuardSuccess,
): Promise<GuardSuccess | GuardFailure> {
  const guard = prevalidatedGuard ?? (await validateGhostwriterHeaders(request));

  if ("status" in guard) {
    return guard;
  }

  const feedbackRateFailure = await enforceRateLimits(
    buildFeedbackRateRules(guard.ip, guard.sessionId, guard.userAgent),
    guard,
    "feedback",
  );

  if (feedbackRateFailure) {
    return feedbackRateFailure;
  }

  const challengeFailure = await validateChallengeProof(guard, challengeToken, challengeNonce);

  if (challengeFailure) {
    return challengeFailure;
  }

  return guard;
}

export function __issueShieldCookiesForTests(userAgent: string): ShieldCookies {
  return issueSession(userAgent);
}

export function __resetAbuseProtectionForTests() {
  cachedEphemeralSecret = null;
  warnedAboutEphemeralSecret = false;
  __resetAbuseStoreForTests();
}
