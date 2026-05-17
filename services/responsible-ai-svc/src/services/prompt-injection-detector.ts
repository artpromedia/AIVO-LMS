import type { ViolationReport } from "./types.js";

const INJECTION_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  {
    pattern: /\bignore (?:all )?(?:previous|prior) instructions\b/i,
    message: "ignore previous instructions",
  },
  { pattern: /\boverride (?:the )?system prompt\b/i, message: "override system prompt" },
  { pattern: /\bjailbreak\b/i, message: "jailbreak phrase" },
  { pattern: /\bdeveloper mode\b/i, message: "developer mode" },
  { pattern: /\bdisregard (?:the )?(?:rules|policy|guidelines)\b/i, message: "disregard rules" },
  { pattern: /\bact as (?:an? )?(?:unfiltered|uncensored)\b/i, message: "act as unfiltered" },
];

export function detectPromptInjection(text: string): ViolationReport[] {
  const violations: ViolationReport[] = [];
  if (typeof text !== "string" || text.length === 0) return violations;
  for (const { pattern, message } of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      violations.push({
        code: "prompt_injection_attempt",
        message: `Detected: ${message}`,
        evidence: message,
      });
    }
  }
  return violations;
}
