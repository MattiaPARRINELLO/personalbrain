import type { NextConfig } from "next";
import withBundleAnalyzer from "@next/bundle-analyzer";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: process.cwd(),
  serverExternalPackages: ["firebase-admin"],
  async headers() {
    const headers = [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "X-DNS-Prefetch-Control", value: "on" },
    ];

    if (process.env.NODE_ENV === "production") {
      headers.push(
        { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
        // CSP adaptée à Next.js App Router : 'unsafe-inline' sur script-src est
        // requis pour les scripts inline de préchargement RSC.
        {
          key: "Content-Security-Policy",
          value:
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
            "img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; " +
            "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
        }
      );
    }

    return [{ source: "/(.*)", headers }];
  },
};

export default withBundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
})(nextConfig);
