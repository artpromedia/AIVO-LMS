import { describe, expect, it } from "vitest";
import { NAV_AREAS, type NavArea } from "../areas.js";
import { _MATRIX, getPermission } from "../permissions.js";
import { ROLES, type Role } from "../roles.js";
import { getDeepLinkAreas } from "../deep-links.js";

/**
 * Matrix coverage gate — ADR 0020 §Consequences.
 *
 * Every `Role × NavArea` pair must have an explicit entry in MATRIX
 * (even if the entry is `HIDDEN`). The fallthrough default still applies
 * at runtime, but authoring an explicit cell forces every role / area
 * combination to be a conscious decision instead of an accident.
 */
describe("MATRIX coverage (ADR 0020)", () => {
  const matrix = _MATRIX as Record<Role, Partial<Record<NavArea, unknown>>>;

  for (const role of ROLES) {
    it(`role "${role}" has an explicit entry for every NavArea`, () => {
      const undeclared = NAV_AREAS.filter((area) => !(area in matrix[role]));
      expect(
        undeclared,
        `Role "${role}" is missing explicit MATRIX entries for: ` +
          `${undeclared.join(", ")}. Add each as "area: HIDDEN," or with an ` +
          `explicit access record so the coverage gate is satisfied.`,
      ).toEqual([]);
    });
  }
});

/**
 * Deep-link coverage gate — ADR 0020 Phase 3.
 *
 * Every `NavArea` reachable through the deep-link resolver must have
 * a defined permission for every role. This prevents a future
 * deep-link rule from pointing at an area whose row only declares
 * some of the roles — which would let `canAccessArea` silently fall
 * through to `HIDDEN` and 404 a user who really *should* have been
 * sent to `/role-switch`.
 */
describe("Deep-link coverage (ADR 0020 Phase 3)", () => {
  const deepLinkAreas = getDeepLinkAreas();

  it("exposes at least one deep-link area", () => {
    expect(deepLinkAreas.length).toBeGreaterThan(0);
  });

  for (const role of ROLES) {
    for (const area of deepLinkAreas) {
      it(`role "${role}" has a resolvable permission for deep-link area "${area}"`, () => {
        const perm = getPermission(role, area);
        expect(
          ["full", "linked", "locked", "hidden"],
          `Role "${role}" / area "${area}" returned an unknown access kind`,
        ).toContain(perm.access);
      });
    }
  }
});
