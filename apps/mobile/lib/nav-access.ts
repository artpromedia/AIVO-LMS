/**
 * Mobile binding for the `@aivo/nav` access-decision helper.
 *
 * The mobile app's `RoleContext` (apps/mobile/lib/role-context.tsx)
 * predates ADR 0020 and stores roles using `@aivo/brand`'s `UserRole`
 * enum (PARENT / LEARNER / TEACHER / ...) for design-token affinity.
 * The canonical RBAC matrix in `@aivo/nav` keys off the lowercase
 * `Role` union (parent / learner / teacher / ...). This module is the
 * single translation surface between the two so every other call site
 * — the role switcher, route guards, deep-link resolvers — can stay
 * agnostic and consume the same decision the web shell does.
 *
 * Per ADR 0020:
 *  - Identity is server-authoritative; the brand-side `UserRole` is
 *    purely a presentation token.
 *  - `canAccessArea` is the only place that computes
 *    allow/switch-role/locked/forbidden, so web and mobile cannot
 *    drift on RBAC outcomes.
 */
import type { UserRole } from "@aivo/brand";
import {
  canAccessArea,
  type AccessDecision,
  type NavArea,
  type Role,
  type RoleSession,
} from "@aivo/nav";

/**
 * Maps `@aivo/brand`'s `UserRole` (UPPER_SNAKE) onto `@aivo/nav`'s
 * `Role` (lowerCamel). Only the five learner-facing roles plus the
 * three admin roles that exist in `@aivo/nav` are mapped — the
 * `internal` operator buckets from `@aivo/brand` (SALES, MARKETING,
 * SUPPORT, FINANCE, DEVOPS, CUSTOMER_CARE) collapse to `internal`
 * because the RBAC matrix doesn't distinguish them.
 */
export const BRAND_TO_NAV_ROLE: Readonly<Record<UserRole, Role>> = {
  LEARNER: "learner",
  PARENT: "parent",
  TEACHER: "teacher",
  THERAPIST: "therapist",
  CAREGIVER: "caregiver",
  DISTRICT_ADMIN: "districtAdmin",
  PLATFORM_ADMIN: "internal",
  SALES: "internal",
  MARKETING: "internal",
  CUSTOMER_CARE: "internal",
  SUPPORT: "internal",
  FINANCE: "internal",
  DEVOPS: "internal",
};

/**
 * Convert a `UserRole` brand identifier to a nav-side `Role`. Returns
 * `null` if the mapping is undefined — callers should treat that as
 * "no nav privileges" rather than crashing.
 */
export function toNavRole(brandRole: UserRole | null | undefined): Role | null {
  if (!brandRole) return null;
  return BRAND_TO_NAV_ROLE[brandRole] ?? null;
}

/**
 * Build a `RoleSession` from the mobile `RoleContext` view of the user.
 *
 * `RoleContext` is intentionally lightweight (no tenant id, no
 * capability claims) so we accept those as separate inputs from the
 * caller — typically the `/me` response cached in the auth layer.
 */
export function buildMobileRoleSession(args: {
  id: string;
  tenantId: string;
  availableRoles: readonly UserRole[];
  activeRole: UserRole;
  capabilities?: readonly string[];
}): RoleSession {
  const roles = args.availableRoles.map(toNavRole).filter((r): r is Role => r !== null);
  const activeRole = toNavRole(args.activeRole);
  if (!activeRole) {
    throw new Error(
      `[mobile/nav-access] active role "${args.activeRole}" has no mapping in BRAND_TO_NAV_ROLE.`,
    );
  }
  if (!roles.includes(activeRole)) {
    roles.unshift(activeRole);
  }
  return {
    id: args.id,
    tenantId: args.tenantId,
    roles,
    activeRole,
    capabilities: args.capabilities ?? [],
  };
}

/**
 * Pure access-decision for the mobile shell. Mirrors the web binding
 * in `apps/web-v2/components/auth/role-gate.tsx`, but plays well with
 * Expo Router guards (which want a synchronous decision before
 * rendering a route).
 */
export function getMobileNavAccess(session: RoleSession, area: NavArea): AccessDecision {
  return canAccessArea(session, area, "mobile");
}
