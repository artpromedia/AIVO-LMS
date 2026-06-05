/**
 * Phase 1 — Unified identity & role switching.
 *
 * The web shell historically modeled the signed-in user as a single
 * {@link SessionProfile} with one `role`. ADR 0020 ("single shell,
 * multi-role") requires that the same user may hold multiple roles
 * and switch between them inside the same session. This module is the
 * conversion layer between the web-v2 single-role `SessionProfile`
 * (which dozens of routes still read) and the canonical multi-role
 * {@link RoleSession} contract that `GET /api/bff/me` returns and
 * `<RoleGate>` / role-switcher consume.
 *
 * Two cookies extend the single-role mock session into multi-role
 * without touching every legacy reader:
 *
 *   - `aivo_mock_session` (existing) — picks the base mock user and
 *      thus the **active** role. Already supported by `mock-session.ts`.
 *   - `aivo_mock_roles` (new) — comma-separated extra `Role`s the same
 *      user also holds. Layered on top of the base role to produce the
 *      `roles[]` array exposed via `RoleSession`.
 *
 * The `aivo_active_role` cookie is set by `POST /api/bff/me/active-role`
 * after a successful switch, and overrides the base mock user's role
 * for the lifetime of the cookie. This is how a multi-role mock user
 * flips between e.g. `teacher` and `parent` in dev without re-logging
 * in.
 */
import type { Role as NavRole } from "@aivo/nav";
import type { Role as WebRole, SessionProfile } from "./types";
import { capabilitiesForRole } from "./permissions";

export const ACTIVE_ROLE_COOKIE = "aivo_active_role";
export const SESSION_ROLES_COOKIE = "aivo_session_roles";

/**
 * web-v2 historically uses snake_case role ids (`school_admin`,
 * `district_admin`, `platform_admin`), while `@aivo/nav` uses camelCase
 * (`schoolAdmin`, `districtAdmin`). `platform_admin` has no nav
 * equivalent today — the nav package models it as `internal`. Map
 * explicitly so future role additions can't silently desync.
 */
const WEB_TO_NAV: Record<WebRole, NavRole> = {
  learner: "learner",
  parent: "parent",
  teacher: "teacher",
  caregiver: "caregiver",
  therapist: "therapist",
  school_admin: "schoolAdmin",
  district_admin: "districtAdmin",
  platform_admin: "internal",
  support: "internal",
  marketing: "internal",
  sales: "internal",
  devops: "internal",
  engineering: "internal",
};

const NAV_TO_WEB: Record<NavRole, WebRole> = {
  learner: "learner",
  parent: "parent",
  teacher: "teacher",
  caregiver: "caregiver",
  therapist: "therapist",
  schoolAdmin: "school_admin",
  districtAdmin: "district_admin",
  internal: "platform_admin",
};

export function toNavRole(role: WebRole): NavRole {
  return WEB_TO_NAV[role];
}

export function toWebRole(role: NavRole): WebRole {
  return NAV_TO_WEB[role];
}

/**
 * Parse the comma-separated `aivo_session_roles` cookie into a deduped
 * list of valid web roles. Unknown entries are dropped silently — the
 * cookie is set by the BFF, but a stale cookie from a previous deploy
 * must not crash the request.
 */
export function parseSessionRolesCookie(value: string | undefined): WebRole[] {
  if (!value) return [];
  const out: WebRole[] = [];
  const seen = new Set<WebRole>();
  for (const raw of value.split(",")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed in WEB_TO_NAV) {
      const r = trimmed as WebRole;
      if (!seen.has(r)) {
        seen.add(r);
        out.push(r);
      }
    }
  }
  return out;
}

/**
 * Parse the `aivo_active_role` cookie. Returns the role only if it is
 * a known web role; any other value (including an empty cookie) is
 * treated as "no override".
 */
export function parseActiveRoleCookie(value: string | undefined): WebRole | null {
  if (!value) return null;
  return value in WEB_TO_NAV ? (value as WebRole) : null;
}

/**
 * Canonical client-side identity returned by `GET /api/bff/me`. Mirrors
 * `RoleSession` from `@aivo/nav` but uses the nav-package camelCase
 * role ids so it can be consumed directly by `<RoleGate>`,
 * `canAccessArea`, and the role switcher without re-mapping.
 */
export interface RoleSessionPayload {
  id: string;
  tenantId: string;
  roles: NavRole[];
  activeRole: NavRole;
  capabilities: string[];
}

/**
 * Build a {@link RoleSessionPayload} from the web-v2 `SessionProfile`.
 *
 * - `roles[]` is the union of the profile's primary role and any
 *   additional roles supplied via {@link SessionProfile.roles} (set by
 *   `mock-session.ts` from the `aivo_session_roles` cookie). Roles are
 *   de-duplicated and the active role is guaranteed to appear first.
 * - `capabilities[]` mirrors the profile's `permissions[]`; the wider
 *   contract calls them capabilities to leave room for permission
 *   strings that aren't tied to a single CRUD verb. The value is always
 *   recomputed from the active role so a role switch cannot leave stale
 *   permissions behind in the single-role session snapshot.
 *
 * Pure function — easy to unit-test, no cookies or fetches.
 */
export function buildRoleSession(profile: SessionProfile): RoleSessionPayload {
  const activeWeb = profile.role;
  const activeNav = toNavRole(activeWeb);
  const seen = new Set<NavRole>([activeNav]);
  const roles: NavRole[] = [activeNav];
  for (const extra of profile.roles ?? []) {
    if (extra === activeWeb) continue;
    const nav = toNavRole(extra);
    if (seen.has(nav)) continue;
    seen.add(nav);
    roles.push(nav);
  }
  return {
    id: profile.userId,
    tenantId: profile.tenantId,
    roles,
    activeRole: activeNav,
    capabilities: capabilitiesForRole(activeWeb),
  };
}
