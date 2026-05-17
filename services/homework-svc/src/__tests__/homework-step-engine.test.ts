import { describe, expect, it } from "vitest";
import {
  initialStepState,
  isFinalAnswerGuardSatisfied,
  nextStep,
  summarizeProgress,
} from "../services/homework-step-engine.js";

describe("homework step engine", () => {
  it("starts on UNDERSTAND", () => {
    const state = initialStepState();
    expect(state.currentStep).toBe("understand");
    expect(state.history).toEqual([]);
  });

  it("advances through UNDERSTAND, PLAN, SOLVE, CHECK, complete", () => {
    let state = initialStepState();
    state = nextStep(state);
    expect(state.currentStep).toBe("plan");
    state = nextStep(state);
    expect(state.currentStep).toBe("solve");
    state = nextStep(state);
    expect(state.currentStep).toBe("check");
    state = nextStep(state);
    expect(state.currentStep).toBe("complete");
    state = nextStep(state);
    expect(state.currentStep).toBe("complete");
  });

  it("blocks final answer until SOLVE has been visited", () => {
    let state = initialStepState();
    expect(isFinalAnswerGuardSatisfied(state)).toBe(false);
    state = nextStep(state);
    expect(isFinalAnswerGuardSatisfied(state)).toBe(false);
    state = nextStep(state); // -> solve
    expect(state.currentStep).toBe("solve");
    state = nextStep(state); // -> check
    expect(isFinalAnswerGuardSatisfied(state)).toBe(true);
  });

  it("summarizes progress", () => {
    let state = initialStepState();
    state = nextStep(state);
    const summary = summarizeProgress(state);
    expect(summary.completedSteps).toContain("understand");
    expect(summary.remaining).toContain("plan");
  });
});
