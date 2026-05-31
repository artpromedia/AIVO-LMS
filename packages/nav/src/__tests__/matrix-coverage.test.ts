import { describe, expect, it } from "vitest";
import { NAV_AREAS, type NavArea } from "../areas.js";
import { _MATRIX } from "../permissions.js";
import { ROLES, type Role } from "../roles.js";

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
