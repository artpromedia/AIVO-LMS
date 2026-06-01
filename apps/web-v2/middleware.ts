import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight middleware: stamps every request with an x-request-id header
 * so logs across the BFF chain can be correlated. Real auth/role enforcement
 * happens inside route handlers via the guards in lib/bff/guards.ts so the
 * middleware stays runtime-cheap.
 */
// Dev-only surfaces (component gallery, render harnesses, lesson-player
// fixtures) that ship in the route tree but must never be reachable in
// production. Blocked with a 404 there; available in dev.
const DEV_ONLY_PREFIXES = [
  "/design-system",
  "/surface-preview",
  "/learner/lesson-player-fixture",
  "/learner/lesson-player-smoke",
];

export function middleware(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const { pathname } = req.nextUrl;
    if (DEV_ONLY_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
      return new NextResponse(null, { status: 404 });
    }
  }

  const requestId =
    req.headers.get("x-request-id") ??
    (typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);

  const res = NextResponse.next({
    request: { headers: new Headers(req.headers) },
  });
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: [
    // Run on everything except static files and Next internals.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)",
  ],
};
