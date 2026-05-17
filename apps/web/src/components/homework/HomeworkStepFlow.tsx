"use client";

import { useCallback, useState } from "react";

export type HomeworkStep = "understand" | "plan" | "solve" | "check" | "complete";

const STEP_ORDER: HomeworkStep[] = ["understand", "plan", "solve", "check", "complete"];

const STEP_LABEL: Record<HomeworkStep, string> = {
  understand: "Understand",
  plan: "Plan",
  solve: "Solve",
  check: "Check",
  complete: "Done",
};

const STEP_BLURB: Record<HomeworkStep, string> = {
  understand: "What is the problem asking? Find the key words.",
  plan: "Pick a strategy. Choose a tool that helps.",
  solve: "Try the next small step. Hints are okay.",
  check: "Did your answer make sense? Connect it back.",
  complete: "Great work. Take a moment before the next one.",
};

export interface HomeworkStepFlowProps {
  /**
   * Optional initial step. The flow always begins at "understand" unless
   * a session in progress passes a later step.
   */
  initialStep?: HomeworkStep;
  onAdvance?: (next: HomeworkStep) => void;
  /**
   * Sprint 10 guard: when true the "Solve" button is required before the
   * UI will reveal the Check step. Tests lock this guard.
   */
  enforceFinalAnswerGuard?: boolean;
}

export function HomeworkStepFlow({
  initialStep = "understand",
  onAdvance,
  enforceFinalAnswerGuard = true,
}: HomeworkStepFlowProps) {
  const [current, setCurrent] = useState<HomeworkStep>(initialStep);
  const [history, setHistory] = useState<HomeworkStep[]>([]);

  const advance = useCallback(() => {
    const index = STEP_ORDER.indexOf(current);
    if (index < 0 || index >= STEP_ORDER.length - 1) return;
    const next = STEP_ORDER[index + 1];
    setHistory((h) => [...h, current]);
    setCurrent(next);
    onAdvance?.(next);
  }, [current, onAdvance]);

  const finalAnswerAllowed =
    !enforceFinalAnswerGuard ||
    history.includes("solve") ||
    current === "solve" ||
    current === "check" ||
    current === "complete";

  return (
    <section data-testid="homework-step-flow" className="homework-step-flow">
      <ol className="flex gap-2 text-sm" aria-label="Homework steps">
        {STEP_ORDER.map((step) => (
          <li
            key={step}
            data-active={step === current ? "true" : undefined}
            data-done={history.includes(step) ? "true" : undefined}
            className={
              step === current
                ? "rounded bg-blue-600 px-2 py-1 text-white"
                : history.includes(step)
                  ? "rounded bg-green-200 px-2 py-1"
                  : "rounded bg-gray-200 px-2 py-1 text-gray-700"
            }
          >
            {STEP_LABEL[step]}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-base">{STEP_BLURB[current]}</p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={advance}
          disabled={current === "complete"}
          className="rounded bg-blue-600 px-3 py-1.5 text-white disabled:opacity-50"
        >
          Next step
        </button>
        {!finalAnswerAllowed ? (
          <span className="self-center text-sm text-gray-600">
            Try the Solve step before checking the answer.
          </span>
        ) : null}
      </div>
    </section>
  );
}

export default HomeworkStepFlow;
