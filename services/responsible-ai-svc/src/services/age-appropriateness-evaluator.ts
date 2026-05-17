import type { EvaluateInput, ViolationReport } from "./types.js";

const CLINICAL_PATTERNS: RegExp[] = [
  /\bdiagnose\b/i,
  /\byou have\s+(?:autism|adhd|dyslexia)\b/i,
  /\bprescribe\b/i,
];

const AGE_INAPPROPRIATE_PATTERNS: RegExp[] = [
  /\bgore\b/i,
  /\bgraphic violence\b/i,
  /\bsexual\b/i,
  /\balcohol\b/i,
  /\bdrugs?\b/i,
];

export function evaluateAgeAppropriateness(input: EvaluateInput): ViolationReport[] {
  const violations: ViolationReport[] = [];
  const text = typeof input.output === "string" ? input.output : JSON.stringify(input.output);
  for (const pattern of CLINICAL_PATTERNS) {
    if (pattern.test(text)) {
      violations.push({
        code: "unsafe_medical_advice",
        message: "Output appears to offer clinical or medical advice.",
      });
      break;
    }
  }
  for (const pattern of AGE_INAPPROPRIATE_PATTERNS) {
    if (pattern.test(text)) {
      violations.push({
        code: "age_inappropriate_content",
        message: "Output contains age-inappropriate content.",
      });
      break;
    }
  }
  return violations;
}
