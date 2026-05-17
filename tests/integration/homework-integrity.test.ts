/**
 * Release-gate test: homework helper integrity.
 *
 * The homework step engine must refuse to expose a final answer until
 * the learner has at least entered the SOLVE step. The responsible-ai
 * evaluator must flag homework output that leads with a final answer.
 */
import { describe, expect, it } from "vitest";
import { initialStepState, isFinalAnswerGuardSatisfied, nextStep } from "@aivo/homework-svc";
import { evaluateAll } from "@aivo/responsible-ai-svc";

describe("homework integrity release gate", () => {
  it("blocks final answer until SOLVE has been entered", () => {
    let state = initialStepState();
    expect(isFinalAnswerGuardSatisfied(state)).toBe(false);
    state = nextStep(state); // -> plan
    expect(isFinalAnswerGuardSatisfied(state)).toBe(false);
    state = nextStep(state); // -> solve
    expect(state.currentStep).toBe("solve");
    expect(isFinalAnswerGuardSatisfied(state)).toBe(true);
  });

  it("responsible-AI evaluator blocks 'The answer is X' homework output", () => {
    const result = evaluateAll({
      learnerId: "l1",
      contextType: "homework",
      inputSummary: "",
      output: "The answer is 32.",
      policyMode: "block",
    });
    expect(result.allowed).toBe(false);
    expect(result.violations.map((v) => v.code)).toContain("final_answer_before_attempt");
  });

  it("responsible-AI evaluator allows a scaffolded homework response", () => {
    const result = evaluateAll({
      learnerId: "l1",
      contextType: "homework",
      inputSummary: "",
      output: "Let's start by reading the problem out loud.",
      policyMode: "block",
    });
    expect(result.allowed).toBe(true);
    expect(result.violations).toEqual([]);
  });
});
