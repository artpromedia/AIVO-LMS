import type {
  EvaluateOutput,
  PolicyMode,
  RecommendedAction,
  Severity,
  ViolationReport,
} from "./types.js";

const CRITICAL_CODES = new Set([
  "prompt_injection_attempt",
  "unsafe_medical_advice",
  "hallucinated_profile_fact",
  "final_answer_before_attempt",
  "raw_markup_injection",
]);

const HIGH_CODES = new Set([
  "speech_required_for_non_verbal",
  "long_text_for_low_verbal",
  "age_inappropriate_content",
]);

export function decideSeverity(violations: ViolationReport[]): Severity {
  if (violations.length === 0) return "none";
  if (violations.some((v) => CRITICAL_CODES.has(v.code))) return "critical";
  if (violations.some((v) => HIGH_CODES.has(v.code))) return "high";
  if (violations.length >= 3) return "medium";
  return "low";
}

export function decideAction(
  severity: Severity,
  policyMode: PolicyMode,
): { allowed: boolean; recommendedAction: RecommendedAction } {
  if (severity === "none") return { allowed: true, recommendedAction: "allow" };
  if (severity === "low") return { allowed: true, recommendedAction: "revise" };
  if (severity === "medium") {
    return { allowed: policyMode === "warn", recommendedAction: "revise" };
  }
  if (severity === "high") {
    return {
      allowed: policyMode === "warn",
      recommendedAction: policyMode === "block" ? "block" : "revise",
    };
  }
  // critical
  return { allowed: false, recommendedAction: "escalate" };
}

export function decideEvaluateOutput(
  violations: ViolationReport[],
  policyMode: PolicyMode,
): EvaluateOutput {
  const severity = decideSeverity(violations);
  const { allowed, recommendedAction } = decideAction(severity, policyMode);
  return {
    allowed,
    severity,
    violations,
    recommendedAction,
  };
}
