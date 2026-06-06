import type { NextConfig } from "next";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const isProd = process.env.NODE_ENV === "production";
const serverOnlyEmpty = path.join(path.dirname(require.resolve("server-only")), "empty.js");

const SECURITY_HEADERS = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
  ...(isProd
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

const nextConfig: NextConfig = {
  output: "standalone",
  reactStrictMode: true,
  transpilePackages: ["@aivo/admin-api", "@aivo/admin-auth", "@aivo/admin-ui"],
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

export default nextConfig;
