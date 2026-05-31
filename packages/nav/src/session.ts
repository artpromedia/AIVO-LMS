import { ROLE_META, ROLES, type Role } from "./roles.js";
import type { Surface } from "./routes.js";

/**
 * Canonical client-side representation of the signed-in user's identity
 * for multi-role routing decisions. Returned (in shape) by `GET /me`
 * and consumed by every shell, `<RoleGate>` boundary, route resolver,
 * and the role-switcher UI.
 *
 * ADR 0020 ("single shell, multi-role") requires that this contract is
 * the single client-side source of truth. The `activeRole` field is
 * server-authoritative: a client that desyncs from the server must
 * trust the server's value (and refresh).
 */
export interface RoleSession {
  /** Stable user id. */
  id: string;
  /** Tenant the user is acting in (school or district scope). */
  tenantId: string;
  /**
   * Every role the user is entitled to act as. Must be a subset of
   * {@link ROLES} and must always include {@link activeRole}.
   */
  roles: readonly Role[];
  /** The role the user is currently acting as. */
  activeRole: Role;
  /**
   * Capability strings granted by the server for the current
   * {@link activeRole}. Used by BFF guards and by capability-driven UI
   * (e.g. hiding a "delete tenant" affordance the user lacks).
   */
  capabilities: readonly string[];
  /**
   * Last-active role per device, restored by the role switcher when
   * the user signs back in. Optional because first-time sessions have
   * no history yet.
   */
  lastActiveRoleByDevice?: Partial<Record<string, Role>>;
}

/**
 * Lightweight runtime validation for `RoleSession`. Useful when
 * accepting `/me` responses from the network and when hydrating SSR
 * payloads where the type system has been erased.
 */
export function isRoleSession(value: unknown): value is RoleSession {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || v.id.length === 0) return false;
  if (typeof v.tenantId !== "string" || v.tenantId.length === 0) return false;
  if (!Array.isArray(v.roles)) return false;
  if (typeof v.activeRole !== "string") return false;
  if (!Array.isArray(v.capabilities)) return false;
  const allRoles = new Set<string>(ROLES);
  for (const r of v.roles) if (typeof r !== "string" || !allRoles.has(r)) return false;
  if (!allRoles.has(v.activeRole as string)) return false;
  if (!(v.roles as unknown[]).includes(v.activeRole)) return false;
  for (const c of v.capabilities) if (typeof c !== "string") return false;
  return true;
}

/**
 * Filter a role list down to the roles that the given surface exposes.
 *
 * The web shell exposes every role; the mobile shell omits
 * `districtAdmin` and `internal` per {@link ROLE_META}. Role switchers
 * call this to render only relevant rows on each surface.
 */
export function getRolesForSurface(roles: readonly Role[], surface: Surface): Role[] {
  return roles.filter((r) =>
    surface === "web" ? ROLE_META[r].onWeb : ROLE_META[r].onMobile,
  );
}

/**
 * `true` if switching *into* `role` requires a fresh step-up factor
 * (passcode, biometric, WebAuthn). Mirrors the policy declared in
 * {@link ROLE_META} so the switcher, the API guard, and the analytics
 * layer all agree.
 */
export function requiresStepUpForRole(role: Role): boolean {
  return ROLE_META[role].requiresStepUp;
}

/**
 * Test whether the session currently grants the named role *as the
 * active role*. Does **not** consult capabilities — that's a separate
 * concern. Returned `false` if the role isn't in `session.roles` at
 * all, so this is also a safe "is this role even possible for me?"
 * check.
 */
export function hasActiveRole(session: RoleSession, role: Role): boolean {
  return session.activeRole === role && session.roles.includes(role);
}

/**
 * Test whether the session holds `role` regardless of active state.
 * Useful for "show the parent tab in the role switcher" decisions.
 */
export function holdsRole(session: RoleSession, role: Role): boolean {
  return session.roles.includes(role);
}
