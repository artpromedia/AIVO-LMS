/**
 * Sprint 14 — Responsible-AI evaluation pipeline.
 *
 * Composes the four real detectors (PII/IEP, prompt injection, crisis,
 * age-appropriateness) into a single decision call. The pipeline fails
 * CLOSED: if any detector errors AND RESPONSIBLE_AI_FAIL_CLOSED=true,
 * the overall verdict is downgraded to 'review' or 'block' depending on
 * what the working detectors saw.
 *
 * Returns a structured envelope rather than a plain verdict so the
 * evaluator route can translate to the legacy EvaluateOutput shape
 * without losing detector-level evidence.
 */
import { detectPii } from "./detectors/pii.js";
import { detectInjection } from "./detectors/injection.js";
import { detectCrisis } from "./detectors/crisis.js";
import { detectAgeAppropriateness } from "./detectors/age.js";
import { recordResponsibleAiBlock, recordResponsibleAiEvaluation } from "./metrics.js";
import type {
  DetectorContext,
  DetectorResult,
  DetectorVerdict,
} from "./detectors/types.js";

export interface PipelineResult {
  verdict: DetectorVerdict;
  detectors: DetectorResult[];
  reasoning: string;
  /** True when fail-closed downgraded the verdict due to an errored detector. */
  failedClosed: boolean;
}

const FAIL_CLOSED_DEFAULT = "true";

function failClosedEnabled(): boolean {
  const raw = (
    process.env.RESPONSIBLE_AI_FAIL_CLOSED ?? FAIL_CLOSED_DEFAULT
  )
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/**
 * Aggregate verdicts: any 'block' wins, then 'review', else 'allow'.
 */
function combineVerdicts(results: DetectorResult[]): DetectorVerdict {
  if (results.some((r) => r.verdict === "block")) return "block";
  if (results.some((r) => r.verdict === "review")) return "review";
  return "allow";
}

function summarise(results: DetectorResult[]): string {
  const lines: string[] = [];
  for (const r of results) {
    if (r.errored) {
      lines.push(`${r.detector}: ERRORED (${r.error ?? "unknown"})`);
      continue;
    }
    if (r.verdict === "allow") {
      lines.push(`${r.detector}: allow`);
      continue;
    }
    const codes = r.evidence.map((e) => e.code).join(",");
    lines.push(`${r.detector}: ${r.verdict} [${codes}]`);
  }
  return lines.join(" | ");
}

export async function runPipeline(
  context: DetectorContext,
): Promise<PipelineResult> {
  // Run all detectors in parallel — they're independent.
  const settled = await Promise.allSettled([
    detectPii(context),
    Promise.resolve(detectInjection(context)),
    detectCrisis(context),
    detectAgeAppropriateness(context),
  ]);

  const detectors: DetectorResult[] = settled.map((s, i) => {
    if (s.status === "fulfilled") return s.value;
    const name = (["pii", "injection", "crisis", "age"] as const)[i];
    // A detector that threw rather than returning errored: treat identically.
    return {
      detector: name,
      verdict: "review",
      evidence: [],
      durationMs: 0,
      errored: true,
      error: (s.reason as Error)?.message ?? "detector threw",
    };
  });

  let verdict = combineVerdicts(detectors);
  let failedClosed = false;

  if (failClosedEnabled() && detectors.some((d) => d.errored)) {
    // Fail closed: at minimum send to human review; if a working detector
    // already says 'block', keep that stronger verdict.
    if (verdict === "allow") {
      verdict = "review";
      failedClosed = true;
    } else if (verdict !== "block") {
      failedClosed = true;
    }
  }

  // Emit metrics — counts per detector and per overall verdict.
  for (const d of detectors) {
    if (d.verdict !== "allow") {
      recordResponsibleAiBlock(d.detector, d.verdict);
    }
  }
  recordResponsibleAiEvaluation(verdict);

  return {
    verdict,
    detectors,
    reasoning: summarise(detectors),
    failedClosed,
  };
}
