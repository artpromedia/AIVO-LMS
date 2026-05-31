/**
 * Cross-cutting surface registry — ADR 0020 Phase 2 groundwork.
 *
 * Per ADR 0020 §Consequences, cross-cutting features (messages,
 * notifications, settings, billing) should migrate from per-role
 * route trees (`/parent/notifications`, `/teacher/notifications`,
 * `/learner/notifications`, …) to **top-level routes** that read the
 * server-authoritative `activeRole` from the session and filter their
 * content accordingly.
 *
 * This module is the typed registry the migration will consume. It
 * names every cross-cutting surface, declares its canonical top-level
 * routes on each shell, and records which legacy per-role routes the
 * surface will subsume (so dead links in design files / docs / tests
 * can be found and updated). Nothing in the registry forces a route
 * to exist yet — it's a forward-looking contract — but the rbac
 * matrix-coverage test in `__tests__/matrix-coverage.test.ts` checks
 * that every cross-cutting `NavArea` is classified for every role.
 *
 * Migration sequencing (mirrors the table in ADR 0020 Phase 2):
 *   1. notifications — lowest-risk, already partially top-level on
 *      mobile via the unified inbox.
 *   2. messages — depends on notifications shipping first because
 *      they share the same unread counters.
 *   3. settings — needs `activeRole`-aware section visibility before
 *      flipping; today every shell ships a bespoke /role/settings.
 *   4. billing — last, because it touches Stripe surfaces and is the
 *      single area whose copy varies most by role (parent self-pay
 *      vs. school-admin invoice vs. district PO).
 */
import type { NavArea } from "./areas.js";
import type { Role } from "./roles.js";

/**
 * Identifier for a cross-cutting top-level surface. Distinct from
 * `NavArea` so we can express "notifications" (a surface) without
 * conflating it with `messages` (a nav area whose UX the surface
 * subsumes).
 */
export type CrossCuttingSurface =
  | "notifications"
  | "messages"
  | "settings"
  | "billing";

export const CROSS_CUTTING_SURFACES: readonly CrossCuttingSurface[] = [
  "notifications",
  "messages",
  "settings",
  "billing",
] as const;

export interface CrossCuttingSurfaceMeta {
  id: CrossCuttingSurface;
  /** Canonical web route for the top-level surface (Next.js). */
  webRoute: string;
  /** Canonical mobile route for the top-level surface (Expo Router). */
  mobileRoute: string;
  /**
   * The `NavArea` whose RBAC matrix entry governs this surface for
   * each role. Lets `<RoleGate>` and the mobile guard re-use
   * `canAccessArea` instead of inventing a parallel matrix.
   */
  navArea: NavArea;
  /**
   * Migration phase per ADR 0020. Lower numbers are migrated first.
   * Tracked here (rather than in prose) so a future automation gate
   * can fail PRs that ship cross-cutting work out of order.
   */
  phase: 1 | 2 | 3 | 4;
  /**
   * Per-role legacy routes that the cross-cutting surface will absorb
   * once it ships. Used by codemods and link-audit scripts; presence
   * here is not a runtime gate.
   */
  legacyRoutes: Readonly<Partial<Record<Role, { web?: string; mobile?: string }>>>;
}

export const CROSS_CUTTING_REGISTRY: Readonly<
  Record<CrossCuttingSurface, CrossCuttingSurfaceMeta>
> = {
  notifications: {
    id: "notifications",
    webRoute: "/notifications",
    mobileRoute: "/notifications",
    navArea: "messages",
    phase: 1,
    legacyRoutes: {
      learner: { web: "/learner/notifications", mobile: "/(learner)/messages" },
      parent: { web: "/parent/notifications", mobile: "/(parent)/messages" },
      teacher: { web: "/teacher/notifications" },
      schoolAdmin: { web: "/admin/school/staff" },
      districtAdmin: { web: "/admin/district/staff" },
      internal: { web: "/admin/platform/support" },
    },
  },
  messages: {
    id: "messages",
    webRoute: "/messages",
    mobileRoute: "/messages",
    navArea: "messages",
    phase: 2,
    legacyRoutes: {
      parent: { web: "/parent/messages", mobile: "/(parent)/messages" },
      teacher: { web: "/teacher/messages", mobile: "/(teacher)/messages" },
      therapist: { mobile: "/(therapist)/client" },
      caregiver: { web: "/caregiver/messages", mobile: "/(caregiver)/child" },
    },
  },
  settings: {
    id: "settings",
    webRoute: "/settings",
    mobileRoute: "/settings",
    navArea: "settings",
    phase: 3,
    legacyRoutes: {
      learner: { web: "/learner/settings", mobile: "/(learner)/settings" },
      parent: { web: "/parent/settings", mobile: "/(parent)/settings" },
      teacher: { web: "/teacher/settings", mobile: "/(teacher)/settings" },
      therapist: { web: "/therapist/settings" },
      caregiver: { web: "/caregiver/settings" },
      schoolAdmin: { web: "/admin/school/settings" },
      districtAdmin: { web: "/admin/district/settings" },
      internal: { web: "/admin/platform/settings" },
    },
  },
  billing: {
    id: "billing",
    webRoute: "/billing",
    mobileRoute: "/billing",
    navArea: "billing",
    phase: 4,
    legacyRoutes: {
      parent: { web: "/parent/settings/billing", mobile: "/(parent)/billing" },
      schoolAdmin: { web: "/admin/school/billing", mobile: "/(parent)/billing" },
      districtAdmin: { web: "/admin/district/billing" },
      internal: { web: "/admin/platform/billing" },
    },
  },
};

/**
 * Returns the cross-cutting surface registry entries in migration
 * order (phase asc). The role-shell migration cookbook reads from
 * here so its sequencing cannot drift from this code.
 */
export function getCrossCuttingSurfacesInMigrationOrder(): CrossCuttingSurfaceMeta[] {
  return [...CROSS_CUTTING_SURFACES]
    .map((id) => CROSS_CUTTING_REGISTRY[id])
    .sort((a, b) => a.phase - b.phase);
}

/**
 * Look up a registry entry by id. Returns undefined for unknown ids
 * so callers can fall back without throwing — useful when this list
 * grows in future ADRs.
 */
export function getCrossCuttingSurface(
  id: string,
): CrossCuttingSurfaceMeta | undefined {
  return (CROSS_CUTTING_REGISTRY as Record<string, CrossCuttingSurfaceMeta | undefined>)[
    id
  ];
}
