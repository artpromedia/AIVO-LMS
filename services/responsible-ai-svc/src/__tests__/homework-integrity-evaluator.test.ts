import { describe, expect, it } from "vitest";
import { evaluateHomeworkIntegrity } from "../services/homework-integrity-evaluator.js";
import type { EvaluateInput } from "../services/types.js";

const BASE: EvaluateInput = {
  learnerId: "l1",
  contextType: "homework",
  inputSummary: "",
  output: "",
  policyMode: "warn",
};

describe("evaluateHomeworkIntegrity", () => {
  it("flags 'the answer is' leading homework response", () => {
    expect(
      evaluateHomeworkIntegrity({ ...BASE, output: "The answer is 32." }).map((v) => v.code),
    ).toContain("final_answer_before_attempt");
  });

  it("flags 'answer:' leading homework response", () => {
    expect(
      evaluateHomeworkIntegrity({ ...BASE, output: "Answer: 32." }).map((v) => v.code),
    ).toContain("final_answer_before_attempt");
  });

  it("flags '=' leading homework response", () => {
    expect(evaluateHomeworkIntegrity({ ...BASE, output: "= 32" }).map((v) => v.code)).toContain(
      "final_answer_before_attempt",
    );
  });

  it("does not flag scaffolded homework responses", () => {
    expect(
      evaluateHomeworkIntegrity({
        ...BASE,
        output: "Let's start by reading the problem out loud.",
      }),
    ).toEqual([]);
  });

  it("only applies to homework context", () => {
    expect(
      evaluateHomeworkIntegrity({
        ...BASE,
        contextType: "lesson",
        output: "The answer is 32.",
      }),
    ).toEqual([]);
  });
});
