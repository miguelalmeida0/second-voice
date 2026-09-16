import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy } from "@/lib/security-http";
import {
  GHOSTWRITER_CSRF_COOKIE,
  GHOSTWRITER_SESSION_COOKIE,
  cookieSettings,
  ensureShieldCookies,
} from "@/server/abuse-protection";
import { logSecurityEvent } from "@/server/security-events";
import {
  anonymousVisitorCookieName,
  anonymousVisitorCookieSettings,
  ensureAnonymousVisitor,
} from "@/server/anonymous-visitor";

function isShieldedPagePath(pathname: string) {
  return pathname === "/second-voice" || pathname === "/second-voice/" || pathname === "/second-voice/account";
}

function isNonceCspPath(pathname: string) {
  return isShieldedPagePath(pathname) || pathname === "/g" || pathname.startsWith("/g/");
}

export function proxy(request: NextRequest) {
  const shouldApplyNonceCsp = isNonceCspPath(request.nextUrl.pathname);
  let response: NextResponse;

  if (shouldApplyNonceCsp) {
    const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
    const requestHeaders = new Headers(request.headers);
    const contentSecurityPolicy = buildContentSecurityPolicy({
      isDevelopment: process.env.NODE_ENV !== "production",
      nonce,
    });

    requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);
    requestHeaders.set("x-nonce", nonce);

    response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  } else {
    response = NextResponse.next();
  }

  if (request.method !== "GET") {
    return response;
  }

  if (!isShieldedPagePath(request.nextUrl.pathname)) {
    return response;
  }

  let shield: ReturnType<typeof ensureShieldCookies>;
  let anonymousVisitor: ReturnType<typeof ensureAnonymousVisitor> | null = null;

  try {
    shield = ensureShieldCookies(request);
    if (process.env.GHOSTWRITER_RELEASE_PROFILE === "portfolio-free") {
      anonymousVisitor = ensureAnonymousVisitor(request);
    }
  } catch (error) {
    logSecurityEvent("security_config_error", {
      error: error instanceof Error ? error.message : "unknown",
      location: "proxy",
    });
    return new NextResponse("Security configuration unavailable.", { status: 503 });
  }

  const applyBootstrapCookies = (target: NextResponse) => {
    if (shield.needsSet) {
      const sessionCookie = cookieSettings();
      target.cookies.set(GHOSTWRITER_SESSION_COOKIE, shield.sessionToken, sessionCookie);
      target.cookies.set(GHOSTWRITER_CSRF_COOKIE, shield.csrfToken, {
        ...sessionCookie,
        httpOnly: false,
      });
    }

    if (anonymousVisitor?.isNew) {
      target.cookies.set(
        anonymousVisitorCookieName(),
        anonymousVisitor.envelope,
        anonymousVisitorCookieSettings(),
      );
    }
  };

  /*
   * A brand-new portfolio visitor must reach the React tree with a durable
   * anonymous identity already present. Redirect once after issuing the
   * signed identity so the second SSR request can resolve the authoritative
   * allowance directly from Postgres instead of waiting on a client effect.
   */
  if (anonymousVisitor?.isNew) {
    const bootstrap = NextResponse.redirect(request.nextUrl, 307);
    applyBootstrapCookies(bootstrap);
    return bootstrap;
  }

  applyBootstrapCookies(response);
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
