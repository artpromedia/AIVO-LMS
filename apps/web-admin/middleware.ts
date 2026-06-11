import { NextRequest, NextResponse } from "next/server";
import { IDENTITY_SESSION_COOKIE } from "@aivo/admin-auth/identity-client";
import { buildCsp, makeNonce } from "@/lib/security/csp";
import { checkSameOrigin } from "@/lib/security/csrf";

/** Per-request CSP + nonce headers (Sprint A3, ZAP #65). */
function withSecurity(req: NextRequest, requestId: string): NextResponse {
  const nonce = makeNonce();
  const csp = buildCsp({
    nonce,
    isProd: process.env.NODE_ENV === "production",
    sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    reportPath: "/api/csp-report",
  });
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("x-request-id", requestId);
  res.headers.set("content-security-policy", csp);
  return res;
}

const PUBLIC_PREFIXES = ["/login", "/logout", "/api/health", "/_next", "/favicon.ico", "/images", "/assets"];
const ADMIN_ROLES = new Set([
  "school_admin",
  "district_admin",
  "platform_admin",
  "support",
  "marketing",
  "sales",
  "devops",
  "engineering",
]);

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function parseRole(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const session = JSON.parse(decodeURIComponent(value)) as { role?: unknown };
    return typeof session.role === "string" ? session.role : null;
  } catch {
    return null;
  }
}

function allowlisted(req: NextRequest): boolean {
  const raw = process.env.ADMIN_IP_ALLOWLIST;
  if (!raw) return true;
  const allowed = raw.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (allowed.length === 0) return true;
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || "unknown";
  return allowed.includes(ip);
}

export function middleware(req: NextRequest) {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const headers = new Headers(req.headers);
  headers.set("x-request-id", requestId);

  // CSRF — mutating requests must prove same-origin (Sprint A3). Server
  // Actions add Next's own origin check on top; the CSP report sink is
  // exempt like every report-uri endpoint.
  if (req.nextUrl.pathname !== "/api/csp-report") {
    const verdict = checkSameOrigin(req);
    if (!verdict.ok) {
      return new NextResponse("Cross-origin request rejected", { status: 403 });
    }
  }

  if (isPublicPath(req.nextUrl.pathname)) {
    return withSecurity(req, requestId);
  }

  if (!allowlisted(req)) {
    return new NextResponse("Forbidden", { status: 403, headers });
  }

  const role = parseRole(req.cookies.get(IDENTITY_SESSION_COOKIE)?.value);
  if (!role || !ADMIN_ROLES.has(role)) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl, { headers });
  }

  return withSecurity(req, requestId);
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
