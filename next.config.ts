import type { NextConfig } from "next";
import { buildBaselineSecurityHeaders } from "./src/lib/security-http";

const isDevelopment = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  turbopack: {
    root: process.cwd(),
  },
  images: {
    formats: ["image/avif", "image/webp"],
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
