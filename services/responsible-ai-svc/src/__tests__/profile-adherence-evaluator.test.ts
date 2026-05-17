import { describe, expect, it } from "vitest";
import { evaluateProfileAdherence } from "../services/profile-adherence-evaluator.js";
import type { EvaluateInput } from "../services/types.js";

const BASE: EvaluateInput = {
  learnerId: "l1",
  contextType: "lesson",
  inputSummary: "",
  output: "",
  policyMode: "warn",
};

describe("evaluateProfileAdherence", () => {
  it("flags speech-required prompt for NON_VERBAL learner", () => {
    const violations = evaluateProfileAdherence({
      ...BASE,
      output: "Please say the number out loud.",
      learnerProfileSummary: { functioningLevel: "NON_VERBAL" },
    });
    expect(violations.map((v) => v.code)).toContain("speech_required_for_non_verbal");
  });

  it("allows speech-required prompt when speech is explicitly available", () => {
    const violations = evaluateProfileAdherence({
      ...BASE,
      output: "Please say the number out loud.",
      learnerProfileSummary: { functioningLevel: "NON_VERBAL", speechAvailable: true },
    });
    expect(violations.map((v) => v.code)).not.toContain("speech_required_for_non_verbal");
  });

  it("flags very long output for LOW_VERBAL learner", () => {
    const violations = evaluateProfileAdherence({
      ...BASE,
      output: "x".repeat(800),
      learnerProfileSummary: { functioningLevel: "LOW_VERBAL" },
    });
    expect(violations.map((v) => v.code)).toContain("long_text_for_low_verbal");
  });

  it("flags hallucinated profile facts not in declared brain context", () => {
    const violations = evaluateProfileAdherence({
      ...BASE,
      output: "Your file says you love roller coasters.",
      learnerProfileSummary: { declaredFactsInBrain: ["math is a favorite subject"] },
    });
    expect(violations.map((v) => v.code)).toContain("hallucinated_profile_fact");
  });

  it("does not flag profile facts that match declared brain context", () => {
    const violations = evaluateProfileAdherence({
      ...BASE,
      output: "We know math is a favorite subject.",
      learnerProfileSummary: { declaredFactsInBrain: ["math is a favorite subject"] },
    });
    expect(violations.map((v) => v.code)).not.toContain("hallucinated_profile_fact");
  });
});
