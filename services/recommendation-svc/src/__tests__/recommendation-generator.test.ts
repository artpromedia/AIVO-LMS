import { describe, expect, it } from "vitest";
import { generateRecommendations } from "../services/recommendation-generator.js";

describe("generateRecommendations", () => {
  it("emits scratchpad recommendation from two supporting signals", () => {
    const recommendations = generateRecommendations({
      learnerId: "l1",
      signals: [
        {
          source: "lesson",
          metric: "scratchpad_success_rate",
          value: 0.85,
          summary: "Scratchpad success rate is high.",
        },
        {
          source: "lesson",
          metric: "no_scratchpad_success_rate",
          value: 0.3,
          summary: "Success drops without scratchpad.",
        },
      ],
      currentProfile: {},
    });
    expect(recommendations).toHaveLength(1);
    expect(recommendations[0].type).toBe("preferred_surface_change");
    expect(recommendations[0].status).toBe("PENDING");
    expect(recommendations[0].safety.requiresParentApproval).toBe(true);
  });

  it("does not emit a recommendation from a single weak signal", () => {
    const recommendations = generateRecommendations({
      learnerId: "l1",
      signals: [
        {
          source: "lesson",
          metric: "scratchpad_success_rate",
          value: 0.75,
          summary: "One signal only.",
        },
      ],
      currentProfile: {},
    });
    expect(recommendations).toHaveLength(0);
  });

  it("emits self-regulation recommendation when frustration signals appear", () => {
    const recommendations = generateRecommendations({
      learnerId: "l1",
      signals: [
        {
          source: "homework",
          metric: "homework_frustration_count",
          value: 3,
          summary: "Repeated frustration signals.",
        },
        {
          source: "homework",
          metric: "homework_high_eraser",
          value: 4,
          summary: "High eraser count.",
        },
      ],
      currentProfile: {},
    });
    expect(recommendations.some((r) => r.type === "self_regulation_support_add")).toBe(true);
  });

  it("emits a mastery_adjustment from a single high-confidence baseline signal", () => {
    const recommendations = generateRecommendations({
      learnerId: "l1",
      signals: [
        {
          source: "baseline",
          metric: "mastery_signal",
          value: 0.8,
          summary: "Baseline shows mastery gap.",
        },
      ],
      currentProfile: {},
    });
    expect(recommendations.some((r) => r.type === "mastery_adjustment")).toBe(true);
  });
});
