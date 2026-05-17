import { describe, expect, it } from "vitest";
import { analyzeScienceReasoning } from "../services/science-reasoning-analyzer.js";

describe("analyzeScienceReasoning", () => {
  it("analyzes hypothesis structure", () => {
    const result = analyzeScienceReasoning({
      learnerId: "l1",
      prompt: "What happens when ice melts?",
      response: "If we heat the ice then it will melt because the molecules move faster.",
      expectedReasoningType: "hypothesis",
    });
    expect(result.reasoningType).toBe("hypothesis");
    expect(result.observedStrengths.length).toBeGreaterThan(0);
  });

  it("flags hypothesis missing a reason", () => {
    const result = analyzeScienceReasoning({
      learnerId: "l1",
      prompt: "What happens when ice melts?",
      response: "If we heat the ice then it melts.",
      expectedReasoningType: "hypothesis",
    });
    expect(result.missingElements.some((m) => m.includes("reason"))).toBe(true);
  });

  it("flags inference without observation", () => {
    const result = analyzeScienceReasoning({
      learnerId: "l1",
      prompt: "Describe what you saw.",
      response: "I think it must be a chemical reaction.",
      expectedReasoningType: "observation",
    });
    expect(result.misconceptionCandidates).toContain("inference_without_observation");
  });

  it("analyzes a sequence response", () => {
    const result = analyzeScienceReasoning({
      learnerId: "l1",
      prompt: "Put the water cycle in order.",
      response: {
        expectedOrder: ["evaporation", "condensation", "precipitation"],
        learnerOrder: ["evaporation", "precipitation", "condensation"],
      },
      expectedReasoningType: "sequence",
    });
    expect(result.reasoningType).toBe("sequence");
    expect(result.missingElements.length).toBeGreaterThan(0);
  });

  it("rewards strong observation language", () => {
    const result = analyzeScienceReasoning({
      learnerId: "l1",
      prompt: "Describe what you saw.",
      response: "I see bubbles forming on the surface and I notice steam rising.",
      expectedReasoningType: "observation",
    });
    expect(result.observedStrengths.length).toBeGreaterThan(0);
  });

  it("flags an empty response as missing", () => {
    const result = analyzeScienceReasoning({
      learnerId: "l1",
      prompt: "What did you observe?",
      response: "",
      expectedReasoningType: "observation",
    });
    expect(result.missingElements.some((m) => m.toLowerCase().includes("no written"))).toBe(true);
  });
});
