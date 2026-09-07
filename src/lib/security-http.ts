type SecurityHeader = {
  key: string;
  value: string;
};

function compactDirectives(parts: string[]): string {
  return parts.join(" ").replace(/\s{2,}/g, " ").trim();
}

export function buildContentSecurityPolicy(options: {
  isDevelopment: boolean;
  nonce: string;
}) {
  const scriptSrc = options.isDevelopment
    ? `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic' 'unsafe-eval';`
    : `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic';`;

  const directives = [
    "default-src 'self';",
    scriptSrc,
    `style-src 'self' 'nonce-${options.nonce}';`,
    "img-src 'self' data: blob:;",
    "font-src 'self' data:;",
    "connect-src 'self';",
    "base-uri 'self';",
    "form-action 'self';",
    "frame-ancestors 'none';",
    "object-src 'none';",
  ];

  if (!options.isDevelopment) {
    directives.push("upgrade-insecure-requests;");
  }

  return compactDirectives(directives);
}

export function buildBaselineSecurityHeaders(options: {
  isDevelopment: boolean;
}): SecurityHeader[] {
  const headers: SecurityHeader[] = [
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), payment=()" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-DNS-Prefetch-Control", value: "off" },
    { key: "X-Frame-Options", value: "DENY" },
  ];

  if (!options.isDevelopment) {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
  }

  return headers;
}

export function buildNoStoreHeaders(): Headers {
  return mergeHeaders({
    "Cache-Control": "no-store, max-age=0, must-revalidate",
    Expires: "0",
    Pragma: "no-cache",
  });
}

export function mergeHeaders(...parts: Array<HeadersInit | undefined>): Headers {
  const headers = new Headers();

  for (const part of parts) {
    if (!part) {
      continue;
    }

    const next = new Headers(part);
    next.forEach((value, key) => {
      headers.set(key, value);
    });
  }

  return headers;
}
