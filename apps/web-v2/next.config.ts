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
  // NOTE: Set ``NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`` (32+ random bytes,
  // base64) in the deployment env so Server Action IDs are stable
  // across pod replicas and across redeploys of the same build.
  // Without a pinned key Next auto-generates a per-build value, which
  // causes ``UnrecognizedActionError`` 404s on the login form for users
  // who have a stale tab after a rolling deploy.
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // Topology aliases (ADR 0010). Older docs and external integrations
  // sometimes reference apps that don't exist as separate deployables
  // — every role-scoped UI lives under apps/web-v2 with a route prefix.
  // Permanent-redirect the expected URLs to the real ones so links keep
  // working.
  async redirects() {
    return [
      { source: "/parent-portal", destination: "/parent", permanent: true },
      {
        source: "/parent-portal/:path*",
        destination: "/parent/:path*",
        permanent: true,
      },
      { source: "/learner-app", destination: "/learner", permanent: true },
      {
        source: "/learner-app/:path*",
        destination: "/learner/:path*",
        permanent: true,
      },
      // ADR 0020 Phase 2, slice 1 — `notifications` moved from
      // per-role routes to the canonical top-level `/notifications`
      // surface anchored on the `messages` nav area. Mirrors
      // `CROSS_CUTTING_REGISTRY.notifications.legacyRoutes` (web).
      // Only the routes that actually rendered notifications are
      // redirected; "closest equivalent" admin staff pages stay put.
      {
        source: "/learner/notifications",
        destination: "/notifications",
        permanent: true,
      },
      {
        source: "/parent/notifications",
        destination: "/notifications",
        permanent: true,
      },
      // ADR 0020 Phase 2, slice 2 — `messages` moved to the canonical
      // top-level `/messages` surface anchored on the `messages` nav
      // area. Mirrors `CROSS_CUTTING_REGISTRY.messages.legacyRoutes`
      // (web). No legacy per-role messages pages exist on disk; the
      // redirects future-proof any external links that may still
      // reference the per-role URLs.
      {
        source: "/parent/messages",
        destination: "/messages",
        permanent: true,
      },
      {
        source: "/teacher/messages",
        destination: "/messages",
        permanent: true,
      },
      {
        source: "/caregiver/messages",
        destination: "/messages",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
