import { describe, expect, it } from "vitest";
import { analyzeClassification } from "../services/classification-analyzer.js";

describe("analyzeClassification", () => {
  it("returns correct counts when learner groups everything correctly", () => {
    const result = analyzeClassification({
      expectedGroups: [
        { group: "mammals", items: ["dog", "cat"] },
        { group: "birds", items: ["sparrow"] },
      ],
      learnerGrouping: [
        { id: "1", label: "dog", group: "mammals" },
        { id: "2", label: "cat", group: "mammals" },
        { id: "3", label: "sparrow", group: "birds" },
      ],
      ruleExplanation: "Mammals have fur, birds have feathers.",
    });
    expect(result.correctCount).toBe(3);
    expect(result.incorrectCount).toBe(0);
    expect(result.missingExplanation).toBe(false);
  });

  it("flags incorrect grouping", () => {
    const result = analyzeClassification({
      expectedGroups: [
        { group: "mammals", items: ["dog"] },
        { group: "birds", items: ["sparrow"] },
      ],
      learnerGrouping: [{ id: "1", label: "dog", group: "birds" }],
      ruleExplanation: "fur",
    });
    expect(result.incorrectCount).toBe(1);
    expect(result.misconceptionCandidates[0]).toContain("dog");
  });

  it("flags missing rule explanation", () => {
    const result = analyzeClassification({
      expectedGroups: [{ group: "mammals", items: ["dog"] }],
      learnerGrouping: [{ id: "1", label: "dog", group: "mammals" }],
    });
    expect(result.missingExplanation).toBe(true);
    expect(result.missingElements.length).toBeGreaterThan(0);
  });
});
