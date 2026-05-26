/**
 * Sprint 14 — PII / IEP-data leak detector.
 *
 * Combines a regex pass (high-precision, deterministic) with an optional
 * LLM judge call (pluggable; default = deterministic stub so tests run
 * offline). IEP-specific tokens — goal IDs, accommodation codes, and
 * diagnostic codes — are matched against shared IEP code patterns.
 *
 * Outputs:
 *   - verdict 'block' if any high-confidence regex hits or the LLM judge
 *     returns leak == true.
 *   - verdict 'review' if only low-confidence heuristic signals fire.
 *   - verdict 'allow' otherwise.
 *
 * The detector NEVER logs raw matched text — only masked snippets.
 */
import type {
  DetectorContext,
  DetectorEvidence,
  DetectorResult,
} from "./types.js";

/** Regex bank. Order does not matter — all matchers run independently. */
const PII_PATTERNS: Array<{
  code: string;
  pattern: RegExp;
  mask: string;
  message: string;
}> = [
  {
    code: "pii.ssn",
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    mask: "[SSN]",
    message: "Possible US Social Security Number",
  },
  {
    code: "pii.phone",
    // Word boundaries don't fit around `(` so we anchor on non-digit lookarounds.
    pattern: /(?<!\d)(?:\+?1[-.\s]?)?(?:\(\d{3}\)|\d{3})[-.\s]?\d{3}[-.\s]?\d{4}(?!\d)/g,
    mask: "[PHONE]",
    message: "Phone number",
  },
  {
    code: "pii.email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    mask: "[EMAIL]",
    message: "Email address",
  },
  {
    code: "pii.us_address",
    pattern:
      /\b\d{1,5}\s+[A-Za-z0-9.\s]{2,40}\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr|Boulevard|Blvd|Court|Ct|Way|Place|Pl|Terrace|Ter|Circle|Cir|Parkway|Pkwy|Trail|Tr)\b/gi,
    mask: "[US_ADDRESS]",
    message: "Street address",
  },
  {
    code: "pii.credit_card",
    pattern: /\b(?:\d[ -]?){13,16}\b/g,
    mask: "[CARD]",
    message: "Possible credit card number",
  },
  {
    code: "pii.student_id",
    /** Common US student-ID shapes: ST-12345, S12345678, 8-digit numeric IDs in school context. */
    pattern: /\b(?:ST[- ]?\d{4,8}|S\d{6,9}|STUDENT[- ]?ID[: ]+\w{4,12})\b/gi,
    mask: "[STUDENT_ID]",
    message: "Student identifier",
  },
];

/** IEP-domain leak signals. */
const IEP_PATTERNS: Array<{
  code: string;
  pattern: RegExp;
  mask: string;
  message: string;
}> = [
  {
    code: "iep.goal_id",
    pattern: /\bIEP[- ]?GOAL[- ]?\d{2,6}\b/gi,
    mask: "[IEP_GOAL_ID]",
    message: "IEP goal identifier",
  },
  {
    code: "iep.accommodation_code",
    // Common AIVO accommodation codes: ACC-### (e.g. ACC-104 extended time)
    pattern: /\bACC[- ]?\d{2,4}\b/gi,
    mask: "[ACCOMMODATION_CODE]",
    message: "Accommodation code",
  },
  {
    code: "iep.diagnostic_code",
    // ICD-10 and DSM-5-TR style codes the codes table tracks.
    pattern: /\b(?:F\d{2}(?:\.\d{1,2})?|[A-Z]\d{2}\.[0-9X]{1,3})\b/g,
    mask: "[DX_CODE]",
    message: "Diagnostic code (ICD-10 / DSM-5-TR)",
  },
  {
    code: "iep.disclosure_phrase",
    pattern:
      /\b(?:diagnosed with|on an IEP for|qualifies under|eligibility category)\s+[a-zA-Z][a-zA-Z\s-]{2,40}/gi,
    mask: "[IEP_DISCLOSURE]",
    message: "IEP disclosure phrase",
  },
];

export interface PiiJudgeResult {
  leak: boolean;
  confidence: number;
  reason?: string;
}

export type PiiJudgeFn = (
  text: string,
  context: DetectorContext,
) => Promise<PiiJudgeResult>;

/**
 * Default offline judge: catches a couple of obvious paraphrases the
 * regex tier misses ("my home address is forty-two oak lane"). The real
 * deployment overrides this via `setPiiJudge`.
 */
const _defaultJudge: PiiJudgeFn = async (text) => {
  const lower = text.toLowerCase();
  if (
    /(my (full )?name is|i live at|my address is|here'?s my number)/i.test(
      lower,
    )
  ) {
    return { leak: true, confidence: 0.7, reason: "self_disclosure_phrase" };
  }
  return { leak: false, confidence: 0 };
};

let _judge: PiiJudgeFn = _defaultJudge;

/** Test hook. */
export function setPiiJudge(fn: PiiJudgeFn): void {
  _judge = fn;
}

export function resetPiiJudge(): void {
  _judge = _defaultJudge;
}

function maskSpan(text: string, match: string, mask: string): string {
  // Show only first/last 2 chars to make incident review possible without
  // persisting the live token.
  if (match.length <= 6) return mask;
  return `${match.slice(0, 2)}${mask}${match.slice(-2)}`;
}

export async function detectPii(
  context: DetectorContext,
): Promise<DetectorResult> {
  const started = Date.now();
  const text = context.text ?? "";
  const evidence: DetectorEvidence[] = [];
  try {
    if (text.length === 0) {
      return {
        detector: "pii",
        verdict: "allow",
        evidence: [],
        durationMs: Date.now() - started,
        errored: false,
      };
    }

    for (const matcher of [...PII_PATTERNS, ...IEP_PATTERNS]) {
      const matches = text.match(matcher.pattern);
      if (matches && matches.length > 0) {
        evidence.push({
          code: matcher.code,
          message: matcher.message,
          evidence: maskSpan(text, matches[0], matcher.mask),
          confidence: 1.0,
        });
      }
    }

    let judgeBlock = false;
    try {
      const j = await _judge(text, context);
      if (j.leak) {
        evidence.push({
          code: "pii.judge",
          message: j.reason ?? "LLM judge flagged possible PII disclosure",
          confidence: j.confidence,
        });
        judgeBlock = j.confidence >= 0.8;
      }
    } catch (err) {
      // Judge failure → mark errored so the pipeline can fail closed.
      return {
        detector: "pii",
        verdict: "review",
        evidence,
        durationMs: Date.now() - started,
        errored: true,
        error: (err as Error).message,
      };
    }

    const hardHit = evidence.some((e) => e.confidence >= 0.9);
    const verdict = hardHit || judgeBlock
      ? "block"
      : evidence.length > 0
        ? "review"
        : "allow";

    return {
      detector: "pii",
      verdict,
      evidence,
      durationMs: Date.now() - started,
      errored: false,
    };
  } catch (err) {
    return {
      detector: "pii",
      verdict: "review",
      evidence,
      durationMs: Date.now() - started,
      errored: true,
      error: (err as Error).message,
    };
  }
}
