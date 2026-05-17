import { describe, expect, it } from "vitest";
import { ElaSubjectBrain } from "../services/ela-subject-brain.js";

describe("ElaSubjectBrain", () => {
  const brain = new ElaSubjectBrain();

  it("recommends reading_annotation for comprehension topics", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "ela",
      topic: "reading comprehension",
      brainContext: {},
    });
    expect(ctx.recommendedSurfaces).toContain("reading_annotation");
  });

  it("inserts reduced-text scaffold for LOW_VERBAL profile", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "ela",
      topic: "reading comprehension",
      functioningLevel: "LOW_VERBAL",
      brainContext: {},
    });
    expect(ctx.recommendedScaffolds[0].toLowerCase()).toContain("text");
    expect(ctx.profileAdaptations.some((a) => a.toLowerCase().includes("chunk"))).toBe(true);
  });

  it("recommends scratchpad for writing topics", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "ela",
      topic: "writing scaffold",
      brainContext: {},
    });
    expect(ctx.recommendedSurfaces).toContain("scratchpad");
  });
});
