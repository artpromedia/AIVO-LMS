import { getPermission } from "./permissions.js";
import { ROLE_META, ROLES, type Role } from "./roles.js";
import type { NavArea } from "./areas.js";
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

/**
 * The four outcomes a `<RoleGate>` boundary needs to act on:
 *
 *  - `allow`         — render the route.
 *  - `switch-role`   — the session holds a role that grants this area;
 *                      route to `/role-switch?to=<role>&next=<path>`.
 *  - `locked`        — the active role exists but the area is locked
 *                      for it (render `<LockedScreen area=… />`).
 *  - `forbidden`     — no role the session holds can reach this area.
 *
 * `requiredRole` is populated for `switch-role`; `lockReason` is
 * populated for `locked`.
 */
export interface AccessDecision {
  outcome: "allow" | "switch-role" | "locked" | "forbidden";
  requiredRole?: Role;
  lockReason?: string;
}

/**
 * Decide what a guard should do when the active role tries to reach a
 * given `NavArea` on a given surface. This is the single function the
 * web `<RoleGate>` and the mobile route guard should both consume so
 * both shells agree on outcomes.
 *
 * Resolution order:
 *   1. If the active role has `full` or `linked` access → `allow`.
 *   2. If the active role is `locked` for the area → `locked`.
 *   3. Otherwise, if any *other* role the session holds (and that the
 *      current surface exposes) can reach the area → `switch-role`
 *      with that role as `requiredRole`.
 *   4. Otherwise → `forbidden`.
 *
 * Step 3 prefers the first role in `session.roles` declaration order,
 * which mirrors how role-switchers list options. Callers that want a
 * different preference can post-process.
 */
export function canAccessArea(
  session: RoleSession,
  area: NavArea,
  surface: Surface,
): AccessDecision {
  const activePerm = getPermission(session.activeRole, area);
  if (activePerm.access === "full" || activePerm.access === "linked") {
    return { outcome: "allow" };
  }
  if (activePerm.access === "locked") {
    return { outcome: "locked", lockReason: activePerm.lockReason };
  }

  const surfaceRoles = getRolesForSurface(session.roles, surface);
  for (const role of surfaceRoles) {
    if (role === session.activeRole) continue;
    const p = getPermission(role, area);
    if (p.access === "full" || p.access === "linked") {
      return { outcome: "switch-role", requiredRole: role };
    }
  }
  return { outcome: "forbidden" };
}

/**
 * The set of all roles in `ROLES` the surface should expose. Useful
 * when building the role switcher for a brand-new session where the
 * server hasn't told us which roles the user holds yet.
 */
export function allRolesForSurface(surface: Surface): Role[] {
  return ROLES.filter((r) =>
    surface === "web" ? ROLE_META[r].onWeb : ROLE_META[r].onMobile,
  );
}
