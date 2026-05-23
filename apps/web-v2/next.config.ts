import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
  ...(isProd
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  allowedDevOrigins: [
    "*.replit.dev",
    "*.replit.app",
    "*.janeway.replit.dev",
    "*.riker.replit.dev",
    "*.spock.replit.dev",
    "*.picard.replit.dev",
  ],
  typedRoutes: false,
  // Hide the floating "N" dev-mode badge that sits in the bottom-left
  // corner during `next dev`. It overlapped real UI affordances on the
  // mobile screenshots and isn't useful day-to-day. Production builds
  // never render it; this flag silences it in dev too.
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
};

export default withNextIntl(nextConfig);
