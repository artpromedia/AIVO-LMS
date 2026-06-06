import { NextRequest, NextResponse } from "next/server";
import { IDENTITY_SESSION_COOKIE } from "@aivo/admin-auth/identity-client";

const PUBLIC_PREFIXES = ["/login", "/api/health", "/_next", "/favicon.ico", "/images", "/assets"];
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

  if (isPublicPath(req.nextUrl.pathname)) {
    return NextResponse.next({ request: { headers } });
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

  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!.*\\..*).*)"],
};
