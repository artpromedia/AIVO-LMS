/**
 * Auto-select the single available learner and redirect to /learner/home.
 *
 * Route Handler — cookies can only be mutated here or in Server Actions in
 * Next.js 15, so the parent flow at /learner/select redirects single-child
 * parents through this endpoint instead of mutating cookies in the page
 * render.
 */
import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/types";
import { ACTIVE_LEARNER_COOKIE, verifyActiveLearner } from "@/lib/auth/active-learner";

export const dynamic = "force-dynamic";

/**
 * Resolve the public-facing origin for absolute redirects.
 *
 * `req.url` reflects the host the Next server bound to (e.g. `0.0.0.0:3000`
 * behind the reverse proxy), so `new URL(path, req.url)` would send the
 * browser to an unreachable internal address. The proxy forwards the real
 * host/scheme via `x-forwarded-*` (or `host`), so prefer those and only fall
 * back to `req.url` for direct, un-proxied requests in development.
 */
function resolveOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ??
      (process.env.NODE_ENV === "production" ? "https" : "http");
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

export async function GET(req: Request): Promise<NextResponse> {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (session.role !== "parent") {
    redirect(ROLE_HOME[session.role]);
  }

  const origin = resolveOrigin(req);
  const url = new URL(req.url);
  const learnerId = (url.searchParams.get("learnerId") ?? "").trim();
  const authorized = learnerId ? await verifyActiveLearner(session, learnerId) : null;
  if (!authorized) {
    return NextResponse.redirect(new URL("/learner/select?error=forbidden", origin));
  }

  const res = NextResponse.redirect(new URL("/learner/home", origin));
  res.cookies.set({
    name: ACTIVE_LEARNER_COOKIE,
    value: authorized,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
