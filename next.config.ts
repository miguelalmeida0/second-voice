import type { NextConfig } from "next";
import { buildBaselineSecurityHeaders } from "./src/lib/security-http";

const isDevelopment = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Playwright runs from the same checkout as local development. Next 16 keeps a
  // dev-server lock inside distDir, so browser tests must use an isolated build
  // directory instead of competing with an already-running local server.
  distDir: process.env.GHOSTWRITER_NEXT_DIST_DIR?.trim() || ".next",
  devIndicators: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  // Keep local credentials and operator artifacts out of serverless output tracing.
  outputFileTracingExcludes: {
    "/*": ["./.env*", "./**/.env*", "./.git/**/*", "./.codex/**/*", "./.agents/**/*"],
  },
  turbopack: {
    root: process.cwd(),
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async redirects() {
    return [
      // Redirect only the legacy public landing page. API routes and Vercel cron
      // requests must remain on their original host and keep their credentials.
      {
        source: "/",
        has: [{ type: "host", value: "secondvoice-ai.vercel.app" }],
        destination: "https://secondvoice.miguelalmeida.xyz/",
        permanent: true,
      },
      { source: "/second-voice", destination: "/", permanent: true },
      { source: "/second-voice/:path*", destination: "/:path*", permanent: true },
    ];
  },
  async headers() {
    const baselineHeaders = buildBaselineSecurityHeaders({ isDevelopment });

    return [
      {
        source: "/:path*",
        headers: baselineHeaders,
      },
      {
        source: "/g/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
      {
        source: "/api/og/:path*",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow, noarchive",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
