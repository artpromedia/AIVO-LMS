import { redirect } from "next/navigation";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { ROLE_HOME, type Role, type SessionProfile } from "@/lib/auth/types";

/**
 * Server-component helper: ensures the visitor is signed in with one of the
 * accepted roles. Mismatched roles are bounced to their own home page so a
 * teacher never lands on /parent/home.
 */
export async function requirePageRole(roles: Role[]): Promise<SessionProfile> {
  const session = await readMockSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  if (!roles.includes(session.role)) {
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}

/**
 * Server-component helper for anonymous-access surfaces (sign-in pages,
 * accept-invite landings). Returns `null` for logged-out visitors so the
 * page can render the sign-in UI. If the visitor is already authenticated
 * and `redirectAuthenticatedRoles` includes their role, they are bounced
 * to their role home — this prevents a signed-in admin from re-seeing the
 * admin sign-in form.
 *
 * The function is named to satisfy `scripts/route-audit.mjs`, which scans
 * for `requirePageRole|requireSession|requireAnonymous` to confirm every
 * role-grouped page makes an explicit auth choice.
 */
export async function requireAnonymous(
  redirectAuthenticatedRoles: readonly Role[] = [],
): Promise<SessionProfile | null> {
  const session = await readMockSessionFromCookies();
  if (!session) return null;
  if (redirectAuthenticatedRoles.includes(session.role)) {
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}
