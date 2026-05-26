/**
 * Sprint 14 — Prompt-injection detector.
 *
 * Pattern library based on the publicly-published rebuff and Lakera
 * taxonomies. Covers four attack families:
 *
 *   1. Instruction override        — "ignore previous instructions"
 *   2. Role hijack                 — "you are now <X>" / "act as admin"
 *   3. System-prompt extraction    — "repeat your system prompt"
 *   4. Indirect injection          — content arriving from tool outputs
 *      that contains override directives ("when the assistant reads
 *      this, …")
 *
 * Every hit returns evidence with a stable taxonomy code so dashboards
 * can show category breakdowns.
 *
 * Detector is synchronous and deterministic — no model call. This is
 * intentional: the responsible-ai-svc evaluator is on the hot path of
 * every learner turn and must complete in <50ms p95.
 */
import type {
  DetectorContext,
  DetectorEvidence,
  DetectorResult,
} from "./types.js";

interface InjectionPattern {
  code: string;
  pattern: RegExp;
  message: string;
  confidence: number;
}

const PATTERNS: InjectionPattern[] = [
  // 1. Instruction override -------------------------------------------------
  {
    code: "injection.instruction_override",
    pattern: /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions?\b/i,
    message: "Instruction-override attempt",
    confidence: 1.0,
  },
  {
    code: "injection.instruction_override",
    pattern: /\bdisregard\s+(?:the\s+)?(?:rules|policy|policies|guidelines)\b/i,
    message: "Instruction-override attempt",
    confidence: 0.95,
  },
  {
    code: "injection.instruction_override",
    pattern: /\bforget\s+(?:everything|all)\s+(?:above|prior|before)\b/i,
    message: "Instruction-override attempt",
    confidence: 0.95,
  },
  {
    code: "injection.instruction_override",
    pattern: /\boverride\s+(?:the\s+)?system\s+prompt\b/i,
    message: "Instruction-override attempt",
    confidence: 1.0,
  },

  // 2. Role hijack -----------------------------------------------------------
  {
    code: "injection.role_hijack",
    pattern: /\byou\s+are\s+now\s+(?:an?\s+)?(?:admin|root|developer|jailbroken|unfiltered|uncensored)\b/i,
    message: "Role-hijack attempt",
    confidence: 1.0,
  },
  {
    code: "injection.role_hijack",
    pattern: /\bact\s+as\s+(?:an?\s+)?(?:admin|root|jailbroken|unfiltered|uncensored|DAN)\b/i,
    message: "Role-hijack attempt",
    confidence: 1.0,
  },
  {
    code: "injection.role_hijack",
    pattern: /\bpretend\s+(?:to\s+be|you\s+are)\s+(?:no\s+rules|a\s+different)/i,
    message: "Role-hijack attempt",
    confidence: 0.9,
  },
  {
    code: "injection.role_hijack",
    pattern: /\bdeveloper\s+mode\b/i,
    message: "Developer-mode jailbreak",
    confidence: 0.95,
  },
  {
    code: "injection.role_hijack",
    pattern: /\b(?:DAN|do\s+anything\s+now)\s+mode\b/i,
    message: "DAN-mode jailbreak",
    confidence: 1.0,
  },

  // 3. System-prompt extraction ---------------------------------------------
  {
    code: "injection.system_prompt_extraction",
    pattern: /\b(?:repeat|reveal|print|show|leak|tell\s+me)\s+(?:(?:your|the|all|those|these)\s+)*(?:initial\s+|original\s+|system\s+)?(?:system\s+prompt|initial\s+prompt|instructions?|rules|guidelines?)\b/i,
    message: "System-prompt extraction attempt",
    confidence: 1.0,
  },
  {
    code: "injection.system_prompt_extraction",
    pattern: /\bwhat\s+(?:were|are)\s+(?:your|the)\s+(?:original|initial)\s+instructions\b/i,
    message: "System-prompt extraction attempt",
    confidence: 0.95,
  },
  {
    code: "injection.system_prompt_extraction",
    pattern: /\bprint\s+everything\s+above\s+this\s+line\b/i,
    message: "System-prompt extraction attempt",
    confidence: 1.0,
  },

  // 4. Indirect injection (tool output channel) -----------------------------
  {
    code: "injection.indirect",
    pattern: /\bwhen\s+(?:the\s+)?(?:assistant|model|ai|llm)\s+(?:reads|sees|processes)\s+this\b/i,
    message: "Indirect-injection directive",
    confidence: 0.9,
  },
  {
    code: "injection.indirect",
    pattern: /\[\s*(?:system|assistant|sys)\s*\]\s*:/i,
    message: "Indirect-injection: fake role tag",
    confidence: 0.9,
  },
  {
    code: "injection.indirect",
    pattern: /<\s*\/?\s*(?:system|assistant)\s*>/i,
    message: "Indirect-injection: role tag spoof",
    confidence: 0.85,
  },
  {
    code: "injection.indirect",
    pattern: /\bjailbreak\b/i,
    message: "Jailbreak keyword",
    confidence: 0.7,
  },
];

export function detectInjection(context: DetectorContext): DetectorResult {
  const started = Date.now();
  const text = context.text ?? "";
  const evidence: DetectorEvidence[] = [];
  try {
    if (text.length === 0) {
      return {
        detector: "injection",
        verdict: "allow",
        evidence: [],
        durationMs: Date.now() - started,
        errored: false,
      };
    }
    const seen = new Set<string>();
    for (const p of PATTERNS) {
      if (p.pattern.test(text)) {
        // Collapse duplicate code hits so dashboards aren't double-counted.
        const key = `${p.code}|${p.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        evidence.push({
          code: p.code,
          message: p.message,
          confidence: p.confidence,
        });
      }
    }
    const verdict = evidence.some((e) => e.confidence >= 0.9)
      ? "block"
      : evidence.length > 0
        ? "review"
        : "allow";
    return {
      detector: "injection",
      verdict,
      evidence,
      durationMs: Date.now() - started,
      errored: false,
    };
  } catch (err) {
    return {
      detector: "injection",
      verdict: "review",
      evidence,
      durationMs: Date.now() - started,
      errored: true,
      error: (err as Error).message,
    };
  }
}
