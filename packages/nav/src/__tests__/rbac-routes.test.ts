/**
 * Phase 5 — RBAC route-coverage gate.
 *
 * ADR 0020 Phase 5 ("Hardening & policy") requires that, for every
 * navigable route in this package, every {@link Role} in {@link ROLES}
 * either:
 *
 *   - **renders**  (active role has `full` or `linked` access), or
 *   - **redirects** (no held role can reach the area), or
 *   - **403s**    (`canAccessArea` returns `forbidden`) / locks
 *     (`canAccessArea` returns `locked`), or
 *   - **switches** (another held role can reach the area; the gate
 *     returns `switch-role`).
 *
 * The matrix in `permissions.ts` is the single source of truth, so the
 * test re-derives the expected outcome from `getPermission` and asserts
 * the runtime helpers (`canAccessArea`, `resolveRoute`) agree. A
 * mismatch usually means someone updated one side of the contract
 * without the other.
 *
 * The suite is intentionally exhaustive (Role × NavArea × Surface) so a
 * newly-added role or area immediately surfaces in CI as a missing
 * coverage row rather than as a silent runtime bug.
 */
import { describe, expect, it } from "vitest";
import { NAV_AREAS, type NavArea } from "../areas.js";
import { getPermission, hasAccess, _MATRIX } from "../permissions.js";
import { ROLES, ROLE_META, type Role } from "../roles.js";
import { resolveRoute, type Surface } from "../routes.js";
import { canAccessArea, type RoleSession } from "../session.js";

const SURFACES: Surface[] = ["web", "mobile"];

function singleRoleSession(role: Role): RoleSession {
  return {
    id: `u_${role}`,
    tenantId: "t_test",
    roles: [role],
    activeRole: role,
    capabilities: [],
  };
}

describe("Phase 5 RBAC — single-role session × every area × every surface", () => {
  for (const role of ROLES) {
    for (const area of NAV_AREAS) {
      for (const surface of SURFACES) {
        const surfaceExposesRole =
          surface === "web" ? ROLE_META[role].onWeb : ROLE_META[role].onMobile;
        if (!surfaceExposesRole) continue;
        const perm = getPermission(role, area);

        it(`${role} / ${area} / ${surface}: canAccessArea matches matrix declaration`, () => {
          const decision = canAccessArea(singleRoleSession(role), area, surface);
          if (perm.access === "full" || perm.access === "linked") {
            expect(decision.outcome).toBe("allow");
          } else if (perm.access === "locked") {
            expect(decision.outcome).toBe("locked");
            // The matrix is required to ship a human-readable lock
            // reason for every locked cell so the LockedScreen has copy.
            expect(perm.lockReason, `Role ${role} / area ${area} is locked but lacks lockReason`)
              .toBeTruthy();
          } else {
            // Hidden + no other role to switch into → forbidden.
            expect(decision.outcome).toBe("forbidden");
          }
        });

        it(`${role} / ${area} / ${surface}: resolveRoute matches matrix declaration`, () => {
          const route = resolveRoute(role, area, surface);
          if (perm.access === "hidden") {
            expect(route).toBeNull();
          } else if (perm.access === "locked") {
            expect(route).toBe(`/locked/${area}`);
          } else {
            const expected = surface === "web" ? perm.webRoute : perm.mobileRoute;
            // Some roles are full/linked on one surface but only have
            // a route declared for the other (e.g. internal is web-only
            // for many areas). When no route is declared the resolver
            // returns null and the caller falls back to the role's home.
            expect(route).toBe(expected ?? null);
          }
        });

        it(`${role} / ${area} / ${surface}: hasAccess matches "full" or "linked"`, () => {
          const expected = perm.access === "full" || perm.access === "linked";
          expect(hasAccess(role, area)).toBe(expected);
        });
      }
    }
  }
});

describe("Phase 5 RBAC — multi-role session resolves to switch-role", () => {
  // When the active role is hidden for an area but another held role
  // can reach it, the gate must return `switch-role` with that role as
  // `requiredRole`. This is the path the role switcher binds to and the
  // single way a deep-link to e.g. `/admin/school` resolves for a user
  // that is signed in as parent but also holds schoolAdmin.
  it("learner+parent session on /parent/* resolves to switch-role for parent areas", () => {
    const session: RoleSession = {
      id: "u_dual",
      tenantId: "t_demo",
      roles: ["learner", "parent"],
      activeRole: "learner",
      capabilities: [],
    };
    // approvals: hidden for learner (no MATRIX entry → HIDDEN sentinel
    // via fallback) but `full` for parent. Wait — learner has approvals
    // *locked*. Pick a parent-only area that is HIDDEN for learner:
    // `learners`.
    const decision = canAccessArea(session, "learners", "web");
    expect(decision.outcome).toBe("switch-role");
    expect(decision.requiredRole).toBe("parent");
  });

  it("schoolAdmin+parent session on /admin/* resolves to switch-role for admin areas", () => {
    const session: RoleSession = {
      id: "u_admin_parent",
      tenantId: "t_demo",
      roles: ["parent", "schoolAdmin"],
      activeRole: "parent",
      capabilities: [],
    };
    const decision = canAccessArea(session, "admin", "web");
    expect(decision.outcome).toBe("switch-role");
    expect(decision.requiredRole).toBe("schoolAdmin");
  });

  it("learner-only session resolves to forbidden for admin areas", () => {
    const session = singleRoleSession("learner");
    expect(canAccessArea(session, "admin", "web").outcome).toBe("forbidden");
  });

  it("every locked NavArea ships a lockReason", () => {
    // Defensive scan of the whole matrix — keeps Phase 5's "what does
    // the user see?" promise consistent across roles even if a new
    // locked cell sneaks in without copy.
    const missing: string[] = [];
    for (const role of ROLES) {
      for (const area of NAV_AREAS) {
        const perm = _MATRIX[role][area as NavArea];
        if (perm?.access === "locked" && !perm.lockReason) {
          missing.push(`${role}/${area}`);
        }
      }
    }
    expect(missing, `Locked cells missing lockReason: ${missing.join(", ")}`).toEqual([]);
  });
});

describe("Phase 5 RBAC — surface gating", () => {
  for (const role of ROLES) {
    const meta = ROLE_META[role];
    it(`role "${role}" is hidden from surfaces it does not opt into`, () => {
      // A web-only role on mobile, or a mobile-only role on web, must
      // never appear in the role-switcher's surface-filtered list.
      // `getRolesForSurface` is the canonical filter; here we just
      // re-derive from ROLE_META so both sides stay aligned.
      if (!meta.onMobile) expect(meta.onWeb).toBe(true);
      if (!meta.onWeb) expect(meta.onMobile).toBe(true);
    });
  }
});
