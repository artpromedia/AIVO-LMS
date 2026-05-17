import { describe, expect, it } from "vitest";
import { ScienceSubjectBrain } from "../services/science-subject-brain.js";

describe("ScienceSubjectBrain", () => {
  const brain = new ScienceSubjectBrain();

  it("recommends a science diagram for sequencing topics", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "science",
      topic: "water cycle sequence",
      brainContext: {},
    });
    expect(ctx.recommendedSurfaces).toContain("science_diagram");
  });

  it("recommends a manipulative for classification topics", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "science",
      topic: "classify living things",
      brainContext: {},
    });
    expect(ctx.recommendedSurfaces).toContain("drag_manipulative");
  });

  it("recommends annotation for observation vs inference", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "science",
      topic: "observation and inference",
      brainContext: {},
    });
    expect(ctx.recommendedSurfaces).toContain("reading_annotation");
    expect(ctx.misconceptionRisks.map((r) => r.id)).toContain("inference_as_observation");
  });
});
