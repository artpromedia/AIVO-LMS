import type { NextConfig } from "next";
import path from "node:path";
import { createRequire } from "node:module";
import { withSentryConfig } from "@sentry/nextjs";

const require = createRequire(import.meta.url);
const isProd = process.env.NODE_ENV === "production";
const serverOnlyEmpty = path.join(path.dirname(require.resolve("server-only")), "empty.js");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  // Sprint A3 (ZAP #65): cross-origin isolation headers. COEP intentionally
  // unset — the admin console loads cross-origin tenant logos/avatars that
  // do not send CORP, and we have no SharedArrayBuffer need.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  // ZAP #65 "Server Leaks Information via X-Powered-By".
  poweredByHeader: false,
  transpilePackages: ["@aivo/admin-api", "@aivo/admin-auth", "@aivo/admin-ui", "@aivo/observability"],
  typedRoutes: false,
  devIndicators: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      "server-only": serverOnlyEmpty,
    };
    return config;
  },
};

// Sentry wraps the final config; source-map upload only activates when
// SENTRY_AUTH_TOKEN is present. Runtime init: instrumentation*.ts.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "aivo-web-admin",
  authToken: process.env.SENTRY_AUTH_TOKEN,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
  disableLogger: true,
});
