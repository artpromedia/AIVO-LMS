/**
 * Four-step homework helper engine: UNDERSTAND -> PLAN -> SOLVE -> CHECK.
 *
 * The engine owns the state of a homework session's step progression.
 * Step transitions are explicit so the UI cannot accidentally skip the
 * Understand phase or jump to a final answer before the learner attempts
 * the problem.
 */

export type HomeworkStep = "understand" | "plan" | "solve" | "check" | "complete";

export interface HomeworkStepState {
  currentStep: HomeworkStep;
  history: HomeworkStep[];
}

export const STEP_ORDER: HomeworkStep[] = ["understand", "plan", "solve", "check", "complete"];

export function initialStepState(): HomeworkStepState {
  return { currentStep: "understand", history: [] };
}

export function nextStep(state: HomeworkStepState): HomeworkStepState {
  const index = STEP_ORDER.indexOf(state.currentStep);
  if (index === -1 || index === STEP_ORDER.length - 1) {
    return { currentStep: "complete", history: [...state.history, state.currentStep] };
  }
  return {
    currentStep: STEP_ORDER[index + 1],
    history: [...state.history, state.currentStep],
  };
}

export function isFinalAnswerGuardSatisfied(state: HomeworkStepState): boolean {
  // Final answer cannot be revealed until learner has at least entered SOLVE.
  return (
    state.history.includes("solve") ||
    state.currentStep === "solve" ||
    state.currentStep === "check" ||
    state.currentStep === "complete"
  );
}

export function summarizeProgress(state: HomeworkStepState): {
  completedSteps: HomeworkStep[];
  remaining: HomeworkStep[];
} {
  const currentIndex = STEP_ORDER.indexOf(state.currentStep);
  return {
    completedSteps: state.history,
    remaining: STEP_ORDER.slice(Math.max(0, currentIndex)),
  };
}
