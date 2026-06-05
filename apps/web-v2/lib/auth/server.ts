import { redirect } from "next/navigation";
import { Permission } from "@aivo/security";
import { delegatedAdminRbacV2Enabled } from "@/lib/feature-flags";
import { readMockSessionFromCookies } from "@/lib/auth/mock-session";
import { ROLE_HOME, type Role, type SessionProfile } from "@/lib/auth/types";
import { PLATFORM_ROLES, sessionHasPermission } from "@/lib/auth/permissions";

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

export async function requirePagePermission(
  permission: Permission | string,
  roles?: Role[],
): Promise<SessionProfile> {
  const session = await readMockSessionFromCookies();
  if (!session) {
    redirect("/login");
  }
  if (roles && !roles.includes(session.role)) {
    redirect(ROLE_HOME[session.role]);
  }
  if (!sessionHasPermission(session, permission)) {
    redirect(ROLE_HOME[session.role]);
  }
  return session;
}

export function platformPageRoles(): Role[] {
  return delegatedAdminRbacV2Enabled() ? [...PLATFORM_ROLES] : ["platform_admin"];
}

export async function requirePlatformPage(
  permission: Permission | string,
): Promise<SessionProfile> {
  return requirePagePermission(permission, platformPageRoles());
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
