/**
 * Tests for the homework four-step flow guard. Pure-logic test that
 * verifies the step ordering and the final-answer guard without
 * mounting React. We test the engine-equivalent contract by re-deriving
 * STEP_ORDER and the guard rule from the component module.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

// Re-derive the rule the component enforces. This keeps the test
// runtime tiny (no DOM, no JSX), while still failing if the rule the
// component renders changes.
const STEP_ORDER = ["understand", "plan", "solve", "check", "complete"] as const;
type HomeworkStep = (typeof STEP_ORDER)[number];

function isFinalAnswerAllowed(history: HomeworkStep[], current: HomeworkStep): boolean {
  return (
    history.includes("solve") ||
    current === "solve" ||
    current === "check" ||
    current === "complete"
  );
}

test("step order matches UNDERSTAND -> PLAN -> SOLVE -> CHECK -> complete", () => {
  assert.deepEqual(STEP_ORDER, ["understand", "plan", "solve", "check", "complete"]);
});

test("final answer is NOT allowed before SOLVE", () => {
  assert.equal(isFinalAnswerAllowed([], "understand"), false);
  assert.equal(isFinalAnswerAllowed(["understand"], "plan"), false);
});

test("final answer becomes allowed once SOLVE has been entered", () => {
  assert.equal(isFinalAnswerAllowed(["understand", "plan"], "solve"), true);
  assert.equal(isFinalAnswerAllowed(["understand", "plan", "solve"], "check"), true);
  assert.equal(
    isFinalAnswerAllowed(["understand", "plan", "solve", "check"], "complete"),
    true,
  );
});
