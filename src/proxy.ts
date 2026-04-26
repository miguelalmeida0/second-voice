import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security-http";
import {
  GHOSTWRITER_CSRF_COOKIE,
  GHOSTWRITER_SESSION_COOKIE,
  cookieSettings,
  ensureShieldCookies,
} from "@/server/abuse-protection";
import { logSecurityEvent } from "@/server/security-events";

function isShieldedPagePath(pathname: string) {
  return (
    pathname === "/second-voice" ||
    pathname.startsWith("/second-voice/") ||
    pathname === "/ghostwriter" ||
    pathname.startsWith("/ghostwriter/")
  );
}

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  const contentSecurityPolicy = buildContentSecurityPolicy({
    isDevelopment: process.env.NODE_ENV !== "production",
    nonce,
  });

  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("Content-Security-Policy", contentSecurityPolicy);

  if (request.method !== "GET") {
    return response;
  }

  if (!isShieldedPagePath(request.nextUrl.pathname)) {
    return response;
  }

  let shield: ReturnType<typeof ensureShieldCookies>;

  try {
    shield = ensureShieldCookies(request);
  } catch (error) {
    logSecurityEvent("security_config_error", {
      error: error instanceof Error ? error.message : "unknown",
      location: "proxy",
    });
    return new NextResponse("Security configuration unavailable.", { status: 503 });
  }

  if (!shield.needsSet) {
    return response;
  }

  const sessionCookie = cookieSettings();
  response.cookies.set(GHOSTWRITER_SESSION_COOKIE, shield.sessionToken, sessionCookie);
  response.cookies.set(GHOSTWRITER_CSRF_COOKIE, shield.csrfToken, {
    ...sessionCookie,
    httpOnly: false,
  });

  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
