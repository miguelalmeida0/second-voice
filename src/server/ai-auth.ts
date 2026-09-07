import "../lib/server-only.ts";

import { getSupabasePublic } from "../integrations/supabase/client.server.ts";

const MAX_BEARER_TOKEN_BYTES = 8 * 1024;

export type AiIdentity = {
  accountId: string;
  emailVerified: true;
};

export type AiAuthenticationResult =
  | { identity: AiIdentity; ok: true }
  | { error: string; ok: false; status: 401 | 403 | 503 };

type AuthUser = {
  confirmed_at?: string | null;
  email_confirmed_at?: string | null;
  id?: string;
};

function bearerToken(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer ([^\s]+)$/i);

  if (!match?.[1] || Buffer.byteLength(match[1], "utf8") > MAX_BEARER_TOKEN_BYTES) {
    return null;
  }

  return match[1];
}
export async function authenticateAiRequest(request: Request): Promise<AiAuthenticationResult> {
  const token = bearerToken(request);

  if (!token) {
    return {
      error: "Sign in with an approved beta account to use live rewriting.",
      ok: false,
      status: 401,
    };
  }

  const supabase = getSupabasePublic();

  if (!supabase) {
    return {
      error: "Authentication is temporarily unavailable.",
      ok: false,
      status: 503,
    };
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    const user = data.user as AuthUser | null;

    if (error || !user?.id) {
      return {
        error: "Your session is invalid or expired. Sign in again.",
        ok: false,
        status: 401,
      };
    }

    if (!user.email_confirmed_at && !user.confirmed_at) {
      return {
        error: "Verify your email before using live rewriting.",
        ok: false,
        status: 403,
      };
    }

    return {
      identity: {
        accountId: user.id,
        emailVerified: true,
      },
      ok: true,
    };
  } catch {
    return {
      error: "Authentication is temporarily unavailable.",
      ok: false,
      status: 503,
    };
  }
}
