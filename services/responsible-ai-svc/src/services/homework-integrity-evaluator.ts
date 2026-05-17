import type { EvaluateInput, ViolationReport } from "./types.js";

/**
 * Homework integrity violations focus on the helper giving a final answer
 * before the learner has had a chance to attempt the problem. The output
 * is treated as offering the final answer when it begins with
 * "the answer is", "=" leading the response, or "x =".
 */
const FINAL_ANSWER_HEAD_PATTERNS = [
  /^\s*the answer is\b/i,
  /^\s*answer:\s*/i,
  /^\s*=\s*/i,
  /^\s*x\s*=\s*\d/i,
];

export function evaluateHomeworkIntegrity(input: EvaluateInput): ViolationReport[] {
  if (input.contextType !== "homework") return [];
  const violations: ViolationReport[] = [];
  const text = typeof input.output === "string" ? input.output : JSON.stringify(input.output);
  for (const pattern of FINAL_ANSWER_HEAD_PATTERNS) {
    if (pattern.test(text.trim())) {
      violations.push({
        code: "final_answer_before_attempt",
        message: "Homework helper offered a final answer before the learner attempted the problem.",
      });
      break;
    }
  }
  return violations;
}
