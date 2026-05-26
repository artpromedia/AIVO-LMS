/**
 * Sprint 12.6 — smoke test for @aivo/learner-ui.
 *
 * The bulk of the package is React component primitives (BreakCloud,
 * Celebration, TabsRail, ...) that need jsdom + @testing-library/react
 * to assert against. To keep CI lean we only exercise the pure-data
 * token modules (`fl-profiles`, `age-tiers`) — they have no React
 * dependency and prove the package files resolve, build, and export
 * what the design system contract documents.
 *
 * Component-level coverage lives in Storybook (`pnpm --filter
 * @aivo/learner-ui storybook:build`) and in apps/web-v2 integration
 * tests; this file only exists to satisfy the CI coverage gate.
 */
import { describe, it, expect } from "vitest";
import { FL_PROFILES } from "../src/tokens/fl-profiles";
import { gradeToTier, TIER_THEMES } from "../src/tokens/age-tiers";

describe("@aivo/learner-ui smoke", () => {
  it("FL_PROFILES enumerates every functioning level", () => {
    expect(Object.keys(FL_PROFILES)).toEqual(
      expect.arrayContaining([
        "STANDARD",
        "SUPPORTED",
        "LOW_VERBAL",
        "NON_VERBAL",
        "PRE_SYMBOLIC",
      ]),
    );
  });

  it("gradeToTier maps PK / 5 / 12 to the documented tier bands", () => {
    expect(gradeToTier("PK")).toBe("EARLY");
    expect(gradeToTier(5)).toBe("EARLY");
    expect(gradeToTier(7)).toBe("MIDDLE");
    expect(gradeToTier(12)).toBe("HIGH");
  });

  it("TIER_THEMES has an entry per tier", () => {
    expect(TIER_THEMES.EARLY).toBeTruthy();
    expect(TIER_THEMES.MIDDLE).toBeTruthy();
    expect(TIER_THEMES.HIGH).toBeTruthy();
  });
});
