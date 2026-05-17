import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight middleware: stamps every request with an x-request-id header
 * so logs across the BFF chain can be correlated. Real auth/role enforcement
 * happens inside route handlers via the guards in lib/bff/guards.ts so the
 * middleware stays runtime-cheap.
 */
export function middleware(req: NextRequest) {
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
