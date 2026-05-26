/**
 * Sprint 12.6 — smoke test for @aivo/brand.
 *
 * Exercises the public BRAND summary object + the tutor catalogue
 * filter helper. These are pure-data exports consumed by both
 * apps/marketing and apps/web-v2; an empty / wrong tier filter
 * surfaces as a missing tutor avatar in the learner home, so the
 * basic shape gets pinned here.
 */
import { describe, it, expect } from "vitest";
import { BRAND, TUTORS, getTutorsForTier, FUNCTIONING_LEVELS, ROLES } from "../src/index";

describe("@aivo/brand smoke", () => {
  it("BRAND summary object is populated", () => {
    expect(BRAND.name).toBe("AIVO");
    expect(typeof BRAND.tagline).toBe("string");
    expect(typeof BRAND.colors.primary).toBe("string");
  });

  it("TUTORS catalogue has the documented seven core tutors plus expansion", () => {
    expect(TUTORS.nova).toBeTruthy();
    expect(TUTORS.sage).toBeTruthy();
    expect(TUTORS.spark).toBeTruthy();
    expect(Object.keys(TUTORS).length).toBeGreaterThanOrEqual(7);
  });

  it("getTutorsForTier filters Chrono / Lingua / Forge / Compass out of EARLY", () => {
    const early = getTutorsForTier("EARLY").map(([k]) => k);
    expect(early).not.toContain("chrono");
    expect(early).not.toContain("lingua");
    expect(early).not.toContain("forge");
    expect(early).not.toContain("compass");
    expect(early).toContain("nova");

    const high = getTutorsForTier("HIGH").map(([k]) => k);
    expect(high).toContain("chrono");
    expect(high).toContain("lingua");
  });

  it("getTutorsForTier returns the full catalogue when tier is null", () => {
    const all = getTutorsForTier(null);
    expect(all.length).toBe(Object.keys(TUTORS).length);
  });

  it("FUNCTIONING_LEVELS + ROLES are populated", () => {
    expect(FUNCTIONING_LEVELS.STANDARD.label).toBeTruthy();
    expect(ROLES.PARENT.label).toBeTruthy();
    expect(ROLES.PLATFORM_ADMIN.internal).toBe(true);
  });
});
