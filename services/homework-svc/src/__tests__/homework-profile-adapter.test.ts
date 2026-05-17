import { describe, expect, it } from "vitest";
import { adaptHomeworkForProfile } from "../services/homework-profile-adapter.js";

describe("adaptHomeworkForProfile", () => {
  it("recommends geometry workspace and scratchpad for geometry topics", () => {
    const adaptation = adaptHomeworkForProfile("math", "perimeter and area of a rectangle", {});
    expect(adaptation.recommendedSurfaces).toContain("geometry_workspace");
    expect(adaptation.recommendedSurfaces).toContain("scratchpad");
  });

  it("reduces text density for LOW_VERBAL learners", () => {
    const adaptation = adaptHomeworkForProfile("ela", "reading comprehension", {
      functioningLevel: "LOW_VERBAL",
    });
    expect(adaptation.reducedText).toBe(true);
    expect(adaptation.uiAdjustments.shorterPrompts).toBe(true);
  });

  it("disables speech-required tasks for NON_VERBAL learners", () => {
    const adaptation = adaptHomeworkForProfile("math", "addition", {
      functioningLevel: "NON_VERBAL",
    });
    expect(adaptation.speechRequired).toBe(false);
    expect(adaptation.scaffolds.some((s) => s.toLowerCase().includes("choice"))).toBe(true);
    expect(adaptation.uiAdjustments.quietMode).toBe(true);
  });

  it("respects accommodations for sensory adjustments", () => {
    const adaptation = adaptHomeworkForProfile("math", "area", {
      accommodations: ["reduced_motion", "high_contrast", "extended_time"],
    });
    expect(adaptation.uiAdjustments.reduceMotion).toBe(true);
    expect(adaptation.uiAdjustments.highContrast).toBe(true);
    expect(adaptation.scaffolds.some((s) => s.toLowerCase().includes("timer"))).toBe(true);
  });
});
