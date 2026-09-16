import "../lib/server-only.ts";
import { createAuthClient, readAuthCookie, sessionRpc } from "./auth-session.ts";
import { readAnonymousVisitor } from "./anonymous-visitor.ts";

export type AiPrincipalType = "authenticated" | "anonymous";
export type AiIdentity = { accountId: string; emailVerified: true; principalType?: AiPrincipalType; sessionId?: string };
export type AiAuthenticationResult =
  | { identity: AiIdentity; ok: true }
  | { error: string; ok: false; status: 401 | 403 | 503 };

const denied = (): AiAuthenticationResult => ({
  ok: false,
  status: 401,
  error: "Sign in to use your available portfolio trial. Your text has been kept.",
});

export async function authenticateAiRequest(request: Request): Promise<AiAuthenticationResult> {
  const authorization = request.headers.get("authorization");
  const token = authorization
    ? authorization.match(/^Bearer ([^\s]+)$/i)?.[1]
    : readAuthCookie(request, "access");
  if (!token || Buffer.byteLength(token) > 8192) return denied();

  try {
    const client = createAuthClient();
    const [{ data, error }, { data: identity, error: userError }] = await Promise.all([
      client.auth.getClaims(token),
      client.auth.getUser(token),
    ]);
    const claims = data?.claims;
    const user = identity.user;
    if ([error, userError].some((value) => value && (
      value.name === "AuthRetryableFetchError" ||
      (typeof value.status === "number" && (value.status >= 500 || value.status === 0))
    ))) return { ok: false, status: 503, error: "Authentication is temporarily unavailable." };

    const expectedIssuer = (process.env.SUPABASE_URL ?? "").replace(/\/$/, "") + "/auth/v1";
    if (
      error || userError || !claims || !user || claims.iss !== expectedIssuer ||
      claims.aud !== "authenticated" || claims.sub !== user.id ||
      !Number.isSafeInteger(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000) ||
      typeof claims.session_id !== "string" || !/^[a-f0-9-]{36}$/i.test(claims.session_id) ||
      user.is_anonymous || !user.email || !user.email_confirmed_at
    ) return denied();

    if (!await sessionRpc("ghostwriter_ai_session_active", user.id, claims.session_id)) return denied();
    return { ok: true, identity: { accountId: user.id, emailVerified: true, principalType: "authenticated", sessionId: claims.session_id } };
  } catch {
    return { ok: false, status: 503, error: "Authentication is temporarily unavailable." };
  }
}

export async function authenticateRewritePrincipal(request: Request): Promise<AiAuthenticationResult> {
  const authenticated = await authenticateAiRequest(request);
  if (authenticated.ok) return authenticated;
  // A supplied/stale authenticated credential never silently downgrades to anonymous.
  if (request.headers.get("authorization") || readAuthCookie(request, "access")) return authenticated;
  if (authenticated.status !== 401 || process.env.GHOSTWRITER_RELEASE_PROFILE !== "portfolio-free") return authenticated;

  try {
    const visitorId = readAnonymousVisitor(request);
    if (!visitorId) return { ok: false, status: 401, error: "Open Second Voice once to start your free portfolio allowance." };
    return { ok: true, identity: { accountId: visitorId, emailVerified: true, principalType: "anonymous" } };
  } catch {
    return { ok: false, status: 503, error: "Portfolio access is temporarily unavailable." };
  }
}
