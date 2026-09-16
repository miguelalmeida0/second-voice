import "../lib/server-only.ts";

export function authRedirectOrigin() {
  const origin = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "");
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      !["http:", "https:"].includes(origin.protocol) ||
      (process.env.NODE_ENV === "production" && origin.protocol !== "https:")) {
    throw new Error("Invalid configured auth origin");
  }
  return origin.origin;
}

export function isAuthOriginAllowed(candidate: URL, configured: URL) {
  if (candidate.origin === configured.origin) return true;
  return process.env.NODE_ENV !== "production" &&
    ["localhost", "127.0.0.1"].includes(candidate.hostname) &&
    ["localhost", "127.0.0.1"].includes(configured.hostname) &&
    candidate.protocol === configured.protocol && candidate.port === configured.port;
}

export function callbackOrigin(request: Request) {
  const configured = new URL(authRedirectOrigin());
  // Next may construct Request.url with its internal localhost fetch hostname.
  // Accept that development-only alias, but never use it as a redirect target.
  if (!isAuthOriginAllowed(new URL(request.url), configured)) throw new Error("Invalid callback origin");
  const host = request.headers.get("host");
  if (host && host !== configured.host) throw new Error("Noncanonical callback host");
  return configured.origin;
}

export function localAuthPageRedirect(request: Request) {
  if (process.env.NODE_ENV === "production" || request.method !== "GET") return null;
  const configured = new URL(authRedirectOrigin());
  const host = request.headers.get("host");
  if (!host || host === configured.host || !/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return null;
  const actual = new URL(configured.protocol + "//" + host);
  if (!isAuthOriginAllowed(actual, configured)) return null;
  const url = new URL(request.url);
  return configured.origin + url.pathname + url.search;
}
