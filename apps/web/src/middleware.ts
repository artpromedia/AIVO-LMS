/**
 * Edge middleware for the AIVO web app.
 *
 * Layered responsibilities (in priority order):
 *
 *   1. **Host allowlist (security-critical).** Admin and district routes
 *      are only reachable on `admin.aivolearning.com` and
 *      `district.aivolearning.com` (plus dev hosts). A request for
 *      `/dashboard/admin` arriving on `app.aivolearning.com` returns
 *      404 — surface separation is enforced before any rendering.
 *
 *   2. **Edge RBAC via the signed surface cookie.** identity-svc issues an
 *      `aivo_session_role` cookie alongside `refreshToken` whose value is
 *      `<role>.<expEpoch>.<base64url(hmac-sha256)>`, signed with
 *      `SURFACE_COOKIE_SECRET` (or `JWT_SECRET`). Here on the edge we verify
 *      the HMAC and check that `<role>` is allowed on the requested surface
 *      *before* SSR runs. A forged or stale cookie -> redirect to the
 *      surface-specific login page. The canonical signer/verifier lives at
 *      `packages/security/src/surface-cookie.ts`; this file inlines an
 *      edge-runtime-compatible verify so middleware has no workspace deps
 *      that pull `jose`/Node-only code into the Edge bundle.
 *
 *   3. **Layered defense.** Dashboard layouts still call `useAuth()` and
 *      identity-svc still validates every access token. The edge check is
 *      additive — even if a forged role cookie ever passed verification it
 *      would still hit those checks before any tenant data is returned.
 *
 *   4. **Hardening response headers** for protected surfaces.
 */
import { NextResponse, type NextRequest } from "next/server";

const ADMIN_PATHS = ["/admin", "/dashboard/admin", "/dashboard/internal"];
const DISTRICT_PATHS = ["/district", "/dashboard/district"];

const ADMIN_LOGIN_PATHS = new Set(["/admin/login"]);
const DISTRICT_LOGIN_PATHS = new Set(["/district/login"]);

// Roles allowed on each surface. Mirrors identity-svc auth.ts.
const ADMIN_ALLOWED_ROLES = new Set([
  "PLATFORM_ADMIN",
  "SALES",
  "MARKETING",
  "CUSTOMER_CARE",
  "SUPPORT",
  "FINANCE",
  "DEVOPS",
]);
const DISTRICT_ALLOWED_ROLES = new Set(["DISTRICT_ADMIN", "PLATFORM_ADMIN"]);

const ADMIN_ALLOWED_HOSTS = ["admin.aivolearning.com"];
const DISTRICT_ALLOWED_HOSTS = ["district.aivolearning.com"];

const SHARED_DEV_HOST_SUFFIXES = [
  "localhost",
  "127.0.0.1",
  ".replit.dev",
  ".replit.app",
  ".janeway.replit.dev",
];

const SURFACE_COOKIE_NAME = "aivo_session_role";

function hostMatches(host: string, exact: string[], suffixes: string[]): boolean {
  const normalized = host.toLowerCase().split(":")[0];
  if (exact.includes(normalized)) return true;
  for (const suffix of suffixes) {
    if (suffix.startsWith(".")) {
      if (normalized.endsWith(suffix) || normalized === suffix.slice(1)) return true;
    } else if (normalized === suffix) {
      return true;
    }
  }
  return false;
}

function pathStartsWithAny(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function getSurfaceSecret(): string {
  const secret = process.env.SURFACE_COOKIE_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      // Fail-closed: refuse to authorize anyone if no secret is configured.
      return "";
    }
    return "dev-only-surface-cookie-secret-do-not-use-in-prod";
  }
  return secret;
}

function b64urlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifySurfaceCookie(value: string | undefined): Promise<{ role: string; exp: number } | null> {
  if (!value) return null;
  const secret = getSurfaceSecret();
  if (!secret) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [role, expStr, sig] = parts;
  if (!role || !expStr || !sig) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= 0) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(`${role}.${exp}`))
  );
  const expected = b64urlEncode(expectedBytes);
  if (!constantTimeEqual(sig, expected)) return null;
  return { role, exp };
}

function redirectTo(req: NextRequest, pathname: string): NextResponse {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const host = req.headers.get("host") || "";

  const isAdminPath = pathStartsWithAny(pathname, ADMIN_PATHS);
  const isDistrictPath = pathStartsWithAny(pathname, DISTRICT_PATHS);

  if (!isAdminPath && !isDistrictPath) {
    return NextResponse.next();
  }

  if (isAdminPath) {
    if (!hostMatches(host, ADMIN_ALLOWED_HOSTS, SHARED_DEV_HOST_SUFFIXES)) {
      return new NextResponse("Not Found", { status: 404 });
    }
    if (!ADMIN_LOGIN_PATHS.has(pathname)) {
      const cookie = req.cookies.get(SURFACE_COOKIE_NAME)?.value;
      const claims = await verifySurfaceCookie(cookie);
      if (!claims) return redirectTo(req, "/admin/login");
      if (!ADMIN_ALLOWED_ROLES.has(claims.role)) {
        // Authenticated, but on the wrong surface — bounce to their surface.
        if (DISTRICT_ALLOWED_ROLES.has(claims.role)) return redirectTo(req, "/district/login");
        return redirectTo(req, "/admin/login");
      }
    }
  }

  if (isDistrictPath) {
    if (!hostMatches(host, DISTRICT_ALLOWED_HOSTS, SHARED_DEV_HOST_SUFFIXES)) {
      return new NextResponse("Not Found", { status: 404 });
    }
    if (!DISTRICT_LOGIN_PATHS.has(pathname)) {
      const cookie = req.cookies.get(SURFACE_COOKIE_NAME)?.value;
      const claims = await verifySurfaceCookie(cookie);
      if (!claims) return redirectTo(req, "/district/login");
      if (!DISTRICT_ALLOWED_ROLES.has(claims.role)) {
        if (ADMIN_ALLOWED_ROLES.has(claims.role)) return redirectTo(req, "/admin/login");
        return redirectTo(req, "/district/login");
      }
    }
  }

  const res = NextResponse.next();
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/district/:path*", "/dashboard/admin/:path*", "/dashboard/district/:path*", "/dashboard/internal/:path*"],
};
