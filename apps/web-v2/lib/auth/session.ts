/**
 * The single session selector for web-v2.
 *
 * Every page guard, BFF guard, and server action reads the session through
 * `getSession()` / `getRequestSession()` here — never `mock-session.ts` or
 * `identity-session.ts` directly. The selector picks the source by AUTH_MODE:
 *
 *   - AUTH_MODE === "mock"  → the dev mock fixture (mock-session.ts), which
 *                             self-guards to mock mode.
 *   - otherwise (pilot path) → the real identity-svc session
 *                             (identity-session.ts): verified JWT claims, with
 *                             the httpOnly login snapshot as render-continuity
 *                             fallback. Never fabricated.
 *
 * The multi-role overlay (active-role switching + held roles) is applied once,
 * centrally, so both paths behave identically.
 *
 * Server-only.
 */
import { cookies } from "next/headers";
import type { SessionProfile } from "@/lib/auth/types";
import {
  isMockAuthAllowed,
  readMockBaseSession,
  readMockBaseSessionFromRequest,
  applyMultiRoleOverlay,
} from "@/lib/auth/mock-session";
import {
  getIdentityBaseSession,
  getIdentityBaseSessionFromRequest,
} from "@/lib/auth/identity-session";
import {
  ACTIVE_ROLE_COOKIE,
  SESSION_ROLES_COOKIE,
  parseActiveRoleCookie,
  parseSessionRolesCookie,
} from "@/lib/auth/role-session";

/**
 * AUTH_MODE=mock implies the dev/test in-memory fixture. Seed it the moment
 * a mock session resolves — BEFORE any access check. The persistence adapter
 * reads (learners.parentCanAccess etc.) go straight to the Map store and do
 * NOT lazily seed, so on a fresh server every learner would 403/404 until
 * some legacy `db()` code path happened to run first. Dynamic import keeps
 * the seed fixture out of non-mock bundles; `ensureSeeded()` is idempotent.
 */
async function ensureMockStoreSeeded(): Promise<void> {
  const { ensureSeeded } = await import("@/lib/db/seed");
  ensureSeeded();
}

function cookieMapFromRequest(req: Request): Map<string, string> {
  const header = req.headers.get("cookie") ?? "";
  const map = new Map<string, string>();
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf("=");
    if (eq <= 0) continue;
    map.set(part.slice(0, eq), part.slice(eq + 1));
  }
  return map;
}

/**
 * Server-component / route-handler session reader. Returns the active session
 * profile (with multi-role overlay applied) or `null` for logged-out visitors.
 */
export async function getSession(): Promise<SessionProfile | null> {
  const mock = isMockAuthAllowed();
  const base = mock ? await readMockBaseSession() : await getIdentityBaseSession();
  if (!base) return null;
  if (mock) await ensureMockStoreSeeded();
  const jar = await cookies();
  return applyMultiRoleOverlay(base, {
    extraRoles: parseSessionRolesCookie(jar.get(SESSION_ROLES_COOKIE)?.value),
    activeRole: parseActiveRoleCookie(jar.get(ACTIVE_ROLE_COOKIE)?.value),
  });
}

/**
 * Edge-friendly variant for Request-based callers (BFF guards / middleware).
 */
export async function getRequestSession(req: Request): Promise<SessionProfile | null> {
  const mock = isMockAuthAllowed();
  const base = mock
    ? readMockBaseSessionFromRequest(req)
    : await getIdentityBaseSessionFromRequest(req);
  if (!base) return null;
  if (mock) await ensureMockStoreSeeded();
  const cookieMap = cookieMapFromRequest(req);
  return applyMultiRoleOverlay(base, {
    extraRoles: parseSessionRolesCookie(cookieMap.get(SESSION_ROLES_COOKIE)),
    activeRole: parseActiveRoleCookie(cookieMap.get(ACTIVE_ROLE_COOKIE)),
  });
}
