import { describe, expect, it } from "vitest";
import { MathSubjectBrain } from "../services/math-subject-brain.js";

describe("MathSubjectBrain", () => {
  const brain = new MathSubjectBrain();

  it("recommends geometry workspace for area topic", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "math",
      topic: "area of a rectangle",
      brainContext: {},
    });
    expect(ctx.recommendedSurfaces).toContain("geometry_workspace");
    expect(ctx.recommendedSurfaces).toContain("scratchpad");
  });

  it("recommends number line or manipulative for fractions", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "math",
      topic: "fractions and halves",
      brainContext: {},
    });
    expect(ctx.recommendedSurfaces).toContain("number_line");
  });

  it("returns mastery gaps for under-mastered skills", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "math",
      topic: "area of a rectangle",
      brainContext: {
        masteryLevels: { "MATH.GEOM.AREA": 0.25 },
      },
    });
    const gap = ctx.masteryGaps.find((g) => g.skillCode === "MATH.GEOM.AREA");
    expect(gap).toBeDefined();
    expect(gap?.severity).toBe("high");
  });

  it("returns misconception risks for area topics", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "math",
      topic: "area",
      brainContext: {},
    });
    expect(ctx.misconceptionRisks.map((r) => r.id)).toContain("perimeter_for_area");
  });

  it("applies LOW_VERBAL profile adaptations", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "math",
      topic: "area",
      functioningLevel: "LOW_VERBAL",
      brainContext: {},
    });
    expect(ctx.profileAdaptations.some((a) => a.toLowerCase().includes("text"))).toBe(true);
  });
});
