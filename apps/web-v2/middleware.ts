import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, makeNonce } from "@/lib/security/csp";
import { checkSameOrigin } from "@/lib/bff/csrf";

/**
 * Middleware responsibilities (kept runtime-cheap; auth/role enforcement
 * stays in route handlers via lib/bff/guards.ts):
 *  1. x-request-id stamping for log correlation across the BFF chain.
 *  2. Content-Security-Policy with a per-request nonce (Sprint A3,
 *     ZAP #65/#73) — Next nonces its own inline scripts from the CSP
 *     request header per the official guide.
 *  3. Central CSRF same-origin verification for every mutating /api/bff
 *     request (Sprint A3) — new BFF routes are covered by default.
 *  4. Dev-only surface blocking + /admin topology redirects (unchanged).
 */
// Dev-only surfaces (component gallery, render harnesses, lesson-player
// fixtures) that ship in the route tree but must never be reachable in
// production. Blocked with a 404 there; available in dev and explicit
// AIVO_TEST_MODE builds used by the production-equivalent CI server.
const DEV_ONLY_PREFIXES = [
  "/design-system",
  "/surface-preview",
  "/learner/lesson-player-fixture",
  "/learner/lesson-player-smoke",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const testMode = process.env.AIVO_TEST_MODE === "1";
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (process.env.NODE_ENV === "production") {
      const targetPath = pathname.replace(/^\/admin/, "") || "/platform";
      const targetBase =
        targetPath === "/district" || targetPath.startsWith("/district/")
          ? process.env.DISTRICT_APP_URL || "https://district.aivolearning.com"
          : process.env.ADMIN_APP_URL || "https://admin.aivolearning.com";
      const adminUrl = new URL(targetPath, targetBase);
      adminUrl.search = req.nextUrl.search;
      return NextResponse.redirect(adminUrl, 308);
    }
    return new NextResponse(null, { status: 404 });
  }

  if (process.env.NODE_ENV === "production" && !testMode) {
    if (DEV_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return new NextResponse(null, { status: 404 });
    }
  }

  // CSRF — every mutating BFF request must prove same-origin (the report
  // endpoint is exempt: browsers POST CSP violation reports without
  // fetch-metadata same-origin semantics on some engines).
  if (pathname.startsWith("/api/bff/") && pathname !== "/api/bff/csp-report") {
    const verdict = checkSameOrigin(req);
    if (!verdict.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "CSRF_REJECTED",
            message: "Cross-origin state-changing requests are not allowed.",
          },
        },
        { status: 403 },
      );
    }
  }

  const requestId =
    req.headers.get("x-request-id") ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const nonce = makeNonce();
  const csp = buildCsp({
    nonce,
    isProd: process.env.NODE_ENV === "production",
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    reportPath: "/api/bff/csp-report",
  });

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  // Next reads the nonce for its own inline scripts from the request CSP.
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-request-id", requestId);
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  matcher: [
    // Run on everything except static files and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)",
  ],
};
