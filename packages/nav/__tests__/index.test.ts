/**
 * Sprint 12.6 — smoke test for @aivo/nav.
 *
 * Asserts the role / area registries are exported and non-empty.
 * The package is consumed by every shell (web-v2, mobile, admin)
 * to drive sidebar / bottom-tab routing — an empty registry would
 * surface as a blank shell, so the basic shape is worth pinning.
 */
import { describe, it, expect } from "vitest";
import { NAV_AREAS, ROLES } from "../src/index";

describe("@aivo/nav smoke", () => {
  it("exposes a non-empty role registry", () => {
    expect(Array.isArray(ROLES)).toBe(true);
    expect(ROLES.length).toBeGreaterThan(0);
    expect(ROLES).toContain("learner");
    expect(ROLES).toContain("parent");
  });

  it("exposes a non-empty navigation-area registry", () => {
    expect(Array.isArray(NAV_AREAS)).toBe(true);
    expect(NAV_AREAS.length).toBeGreaterThan(0);
    expect(NAV_AREAS).toContain("home");
  });
});
