import { describe, expect, it } from "vitest";
import { buildCompletionLearnedChips } from "./completion-chips";

/**
 * Child-safety regression guard: the baseline completion screen must NEVER
 * surface placement / "starting point" outcomes to a learner. Subject-level
 * estimates are parent-proctor-only; learner-mode completion stays strictly
 * celebration + reassurance copy (IEP / calm pacing).
 *
 * `buildCompletionLearnedChips` is the exact array page.tsx feeds into
 * `<CompletionHero learned=…>`, so a regression here is what the screen
 * would actually render.
 */

const subjectMastery = [
  { subjectName: "Math", estimate: "early_grade_2" },
  { subjectName: "Reading", estimate: "grade_3" },
];

/** A label that reveals placement/level — must never reach a learner. */
const PLACEMENT_MARKER = /starting at|grade|early/i;

describe("buildCompletionLearnedChips — child-safe placement gating", () => {
  it("NEVER renders subject placement labels in learner mode, even with mastery data", () => {
    const chips = buildCompletionLearnedChips({
      asParent: false,
      subjectMastery,
      chips: ["iep", "calm_mode", "no_grades"],
    });
    for (const chip of chips) {
      expect(chip).not.toMatch(PLACEMENT_MARKER);
    }
    expect(chips.some((c) => c.includes("starting at"))).toBe(false);
  });

  it("renders ONLY child-safe reassurance chips in learner mode", () => {
    const chips = buildCompletionLearnedChips({
      asParent: false,
      subjectMastery,
      chips: ["iep", "calm_mode"],
    });
    expect(chips).toEqual(["IEP supports stay on", "Calm pacing locked in"]);
  });

  it("returns an empty list in learner mode when no reassurance chips apply", () => {
    expect(
      buildCompletionLearnedChips({
        asParent: false,
        subjectMastery,
        chips: ["no_grades"],
      }),
    ).toEqual([]);
  });

  it("DOES surface subject placement labels in parent proctor mode", () => {
    const chips = buildCompletionLearnedChips({
      asParent: true,
      subjectMastery,
      chips: [],
    });
    expect(chips).toContain("Math: starting at early grade 2");
    expect(chips).toContain("Reading: starting at grade 3");
  });

  it("places parent placement labels before reassurance chips", () => {
    const chips = buildCompletionLearnedChips({
      asParent: true,
      subjectMastery: [{ subjectName: "Math", estimate: "grade_1" }],
      chips: ["iep"],
    });
    expect(chips).toEqual(["Math: starting at grade 1", "IEP supports stay on"]);
  });
});
