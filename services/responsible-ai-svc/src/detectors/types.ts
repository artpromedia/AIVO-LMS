/**
 * Sprint 14 — shared detector types.
 *
 * Every detector returns a `DetectorResult` so the pipeline composer can
 * aggregate evidence, decide an overall verdict, and emit metrics with a
 * single label vocabulary.
 *
 * Detectors NEVER throw on routine input. If they cannot make a decision
 * (e.g. an LLM judge timed out), they MUST return an `errored: true`
 * result so the pipeline can fail-closed at the composite layer.
 */
export type DetectorName = "pii" | "injection" | "crisis" | "age";

export type DetectorVerdict = "allow" | "block" | "review";

export type CrisisCategory =
  | "self_harm"
  | "suicidal_ideation"
  | "abuse_disclosure"
  | "violence_to_others";

export interface DetectorEvidence {
  /** Stable taxonomy code, e.g. `pii.ssn`, `injection.role_hijack`. */
  code: string;
  /** Short human-readable summary. Must not contain raw learner content. */
  message: string;
  /** Optional masked snippet (PII redacted). Safe to log. */
  evidence?: string;
  /** Confidence ∈ [0, 1]. 1.0 == deterministic hit. */
  confidence: number;
}

export interface DetectorResult {
  detector: DetectorName;
  verdict: DetectorVerdict;
  /** Empty when verdict==='allow'. */
  evidence: DetectorEvidence[];
  /** Wall-clock for tracing. */
  durationMs: number;
  /**
   * True when the detector failed to complete (timeout, dependency down).
   * The pipeline fails CLOSED on any errored detector when policy is
   * RESPONSIBLE_AI_FAIL_CLOSED=true.
   */
  errored: boolean;
  /** Error message when `errored=true`. Never includes learner content. */
  error?: string;
  /**
   * Optional structured metadata for downstream callers — e.g. the
   * crisis detector attaches the matched category here so the escalator
   * can route to the right runbook.
   */
  meta?: Record<string, unknown>;
}

export interface DetectorContext {
  /** Concatenated prompt + output text the detector should evaluate. */
  text: string;
  /** Learner context — used by the age gate and the crisis escalator. */
  learnerId?: string;
  tenantId?: string;
  /** Age band from family-svc, e.g. "k_2", "3_5", "6_8", "9_12". */
  ageBand?: string;
  /** Free-form context type so detectors can short-circuit. */
  contextType?: string;
  /** Correlation id propagated end-to-end. */
  correlationId?: string;
}
