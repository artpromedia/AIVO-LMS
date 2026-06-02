/**
 * Parity gate (G10) — decide whether the adaptive baseline is safe to make
 * the default.
 *
 * Before flipping `baselineAdaptiveEnabled` on by default we want evidence
 * that the adaptive path doesn't regress against the fixed-form baseline on
 * a pilot cohort:
 *
 *   - **Completion**: adaptive runs finish at least as often.
 *   - **Placement agreement**: the adaptive θ-derived band lands within one
 *     band of the simple accuracy-derived band (they shouldn't disagree
 *     wildly on where to start a learner).
 *
 * Pure functions over completed runs, so a shadow/monitoring job can score
 * the cohort and an operator can read a pass/fail with reasons.
 */
import type {
  BaselineAttempt,
  BaselineDifficulty,
  BaselineQuestion,
  LearnerProfile,
} from "@/lib/db/types";
import {
  reconstructAdaptiveState,
  thetaToDifficulty,
  priorThetaForLearner,
  learnerHasReadingDifficulty,
  type CalibrationMap,
} from "./baseline-adaptive";

const BAND_ORDER: BaselineDifficulty[] = ["foundational", "approaching", "grade_level", "stretch"];

function bandIndex(b: BaselineDifficulty): number {
  return BAND_ORDER.indexOf(b);
}

/** Coarse fixed-form placement: accuracy → band. */
export function accuracyToBand(accuracy: number): BaselineDifficulty {
  if (accuracy < 0.4) return "foundational";
  if (accuracy < 0.6) return "approaching";
  if (accuracy < 0.8) return "grade_level";
  return "stretch";
}

export interface RunForParity {
  questions: BaselineQuestion[];
  attempts: BaselineAttempt[];
  learner: LearnerProfile | null;
  completed: boolean;
  calibration?: CalibrationMap;
}

export interface PlacementComparison {
  adaptiveTheta: number;
  adaptiveBand: BaselineDifficulty;
  fixedFormAccuracy: number;
  fixedFormBand: BaselineDifficulty;
  /** Bands within one step of each other. */
  agree: boolean;
  itemsAnswered: number;
}

export function comparePlacement(run: RunForParity): PlacementComparison {
  const state = reconstructAdaptiveState(run.questions, run.attempts, {
    priorTheta: priorThetaForLearner(run.learner),
    readingDifficulty: learnerHasReadingDifficulty(run.learner),
    calibration: run.calibration,
  });
  const adaptiveBand = thetaToDifficulty(state.theta);

  const scored = run.attempts.filter((a) => !a.skipped);
  const correct = scored.filter((a) => a.isCorrect).length;
  const accuracy = scored.length > 0 ? correct / scored.length : 0;
  const fixedFormBand = accuracyToBand(accuracy);

  return {
    adaptiveTheta: state.theta,
    adaptiveBand,
    fixedFormAccuracy: Math.round(accuracy * 100) / 100,
    fixedFormBand,
    agree: Math.abs(bandIndex(adaptiveBand) - bandIndex(fixedFormBand)) <= 1,
    itemsAnswered: scored.length,
  };
}

export interface ParitySummary {
  runs: number;
  completionRate: number;
  medianItemsAnswered: number;
  placementAgreementRate: number;
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[m]! : Math.round((s[m - 1]! + s[m]!) / 2);
}

export function summarizeParity(runs: RunForParity[]): ParitySummary {
  if (runs.length === 0) {
    return { runs: 0, completionRate: 0, medianItemsAnswered: 0, placementAgreementRate: 0 };
  }
  const comparisons = runs.map(comparePlacement);
  const completed = runs.filter((r) => r.completed).length;
  const agreed = comparisons.filter((c) => c.agree).length;
  return {
    runs: runs.length,
    completionRate: Math.round((completed / runs.length) * 100) / 100,
    medianItemsAnswered: median(comparisons.map((c) => c.itemsAnswered)),
    placementAgreementRate: Math.round((agreed / runs.length) * 100) / 100,
  };
}

export interface ParityThresholds {
  minCompletionRate: number;
  minAgreementRate: number;
}

export const DEFAULT_PARITY_THRESHOLDS: ParityThresholds = {
  minCompletionRate: 0.9,
  minAgreementRate: 0.8,
};

export interface ParityGateResult {
  pass: boolean;
  reasons: string[];
  summary: ParitySummary;
}

/**
 * Evaluate the gate. Empty cohorts never pass (no evidence yet). Returns the
 * blocking reasons so an operator knows what's short of the bar.
 */
export function evaluateParityGate(
  runs: RunForParity[],
  thresholds: ParityThresholds = DEFAULT_PARITY_THRESHOLDS,
): ParityGateResult {
  const summary = summarizeParity(runs);
  const reasons: string[] = [];
  if (summary.runs === 0) {
    reasons.push("no_runs");
  } else {
    if (summary.completionRate < thresholds.minCompletionRate) {
      reasons.push(`completion_rate ${summary.completionRate} < ${thresholds.minCompletionRate}`);
    }
    if (summary.placementAgreementRate < thresholds.minAgreementRate) {
      reasons.push(
        `placement_agreement ${summary.placementAgreementRate} < ${thresholds.minAgreementRate}`,
      );
    }
  }
  return { pass: reasons.length === 0, reasons, summary };
}
