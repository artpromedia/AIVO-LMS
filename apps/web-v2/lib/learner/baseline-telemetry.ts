/**
 * Adaptive baseline telemetry + recalibration (EPIC 5 + EPIC 2 loop).
 *
 * Phase 0 made difficulty adapt to the learner. This module closes the
 * psychometric loop:
 *
 *   1. `buildRunTelemetry` replays a finished run through the engine and
 *      emits one `BaselineItemResponseLog` per administered item, capturing
 *      the ability estimate *before* and *after* each answer. Those θ
 *      values are exactly what a 1-PL recalibration needs.
 *
 *   2. `aggregateItemPsychometrics` rolls many learners' logs up per
 *      item-key into exposure, p-value, skip-rate, a refined difficulty
 *      estimate, and misfit/defect flags — the data an admin needs to
 *      answer "are these items behaving as calibrated?" and the input to
 *      the authoring-review / auto-retire decision.
 *
 * Pure / deterministic so it is fully unit-testable and a batch job or BFF
 * route can call it directly.
 */
import {
  initBaseline,
  recordResponse,
  type BaselineState,
  type ItemResponse,
} from "@aivo/adaptive-baseline";
import type {
  BaselineAttempt,
  BaselineItemResponseLog,
  BaselineQuestion,
  ItemPsychometrics,
  LearnerProfile,
} from "@/lib/db/types";
import { newId } from "@/lib/db/store";
import {
  difficultyToTheta,
  itemKeyFor,
  learnerHasReadingDifficulty,
  priorThetaForLearner,
  questionToBaselineItem,
  thetaToDifficulty,
  type CalibrationMap,
} from "./baseline-adaptive";

// Re-exported so existing importers (`itemKeyFor`) keep a stable surface
// while the canonical definition lives with the calibration logic.
export { itemKeyFor } from "./baseline-adaptive";

/** Minimum scored administrations before we trust a recalibration. */
export const MIN_RECALIBRATION_EXPOSURE = 5;

/** Refined θ this far from the seed flags the band as miscalibrated. */
const MISCALIBRATION_LOGITS = 1.5;
/** A drift this large (or a near-zero p-value) recommends retirement. */
const SEVERE_DRIFT_LOGITS = 2.5;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BuildRunTelemetryInput {
  baseline: { id: string; learnerId: string; tenantId: string };
  questions: BaselineQuestion[];
  attempts: BaselineAttempt[];
  learner: LearnerProfile | null;
  /**
   * The calibration override in effect during the run. Passing it here
   * keeps the replayed θ trajectory identical to what selection used, so
   * the recorded `thetaBefore` values are the abilities the recalibration
   * fit should be conditioned on.
   */
  calibration?: CalibrationMap;
}

/**
 * Replay a finished baseline run and emit per-item telemetry. The θ
 * trajectory is reconstructed with the same engine + cold-start prior the
 * runner used, so `thetaBefore` is the ability estimate the selector saw
 * when it served the item.
 */
export function buildRunTelemetry(input: BuildRunTelemetryInput): BaselineItemResponseLog[] {
  const { baseline, questions, attempts, learner, calibration } = input;
  const qById = new Map(questions.map((q) => [q.id, q]));
  const ordered = [...attempts].sort((a, b) => a.respondedAt.localeCompare(b.respondedAt));

  let state: BaselineState = initBaseline({
    priorTheta: priorThetaForLearner(learner),
    readingDifficulty: learnerHasReadingDifficulty(learner),
  });

  const logs: BaselineItemResponseLog[] = [];
  for (const attempt of ordered) {
    const q = qById.get(attempt.questionId);
    if (!q) continue;
    const item = questionToBaselineItem(q, calibration);
    const thetaBefore = state.theta;
    let thetaAfter = thetaBefore;

    if (!attempt.skipped) {
      const response: ItemResponse = {
        itemId: item.id,
        correct: attempt.isCorrect,
        // Latency is not yet captured by BaselineAttempt; 0 is benign here
        // (latency feeds the profile, not difficulty estimation).
        responseTimeMs: 0,
        consumedModality: item.modalities[0],
      };
      state = recordResponse({ state, item, response });
      thetaAfter = state.theta;
    }

    logs.push({
      id: newId("brl"),
      tenantId: baseline.tenantId,
      learnerId: baseline.learnerId,
      baselineId: baseline.id,
      questionId: q.id,
      itemKey: itemKeyFor(q),
      skillId: q.skillId,
      subjectId: q.subjectId,
      difficulty: q.difficulty,
      difficultyTheta: difficultyToTheta(q.difficulty),
      correct: attempt.isCorrect,
      skipped: attempt.skipped,
      thetaBefore: round2(thetaBefore),
      thetaAfter: round2(thetaAfter),
      modality: item.modalities[0]!,
      recordedAt: attempt.respondedAt,
    });
  }
  return logs;
}

/**
 * 1-PL conditional MLE for item difficulty given known learner abilities:
 * find `b` such that Σ P(correct | θᵢ, b) equals the observed correct
 * count, where P = sigmoid(θ − b). Expected-correct is strictly decreasing
 * in `b`, so a bisection converges. Returns the seed when there is nothing
 * to fit.
 */
export function estimateDifficultyTheta(
  samples: { thetaBefore: number; correct: boolean }[],
  fallback = 0,
): number {
  if (samples.length === 0) return fallback;
  const observed = samples.reduce((acc, s) => acc + (s.correct ? 1 : 0), 0);
  const expectedAt = (b: number): number =>
    samples.reduce((acc, s) => acc + 1 / (1 + Math.exp(-(s.thetaBefore - b))), 0);

  let lo = -6;
  let hi = 6;
  // All correct → can't get easier than lo; all wrong → can't get harder.
  if (expectedAt(lo) <= observed) return lo;
  if (expectedAt(hi) >= observed) return hi;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (expectedAt(mid) > observed) lo = mid;
    else hi = mid;
  }
  return round2((lo + hi) / 2);
}

export interface AggregateOptions {
  minExposure?: number;
}

/**
 * Roll per-item logs up into psychometrics + recalibration suggestions,
 * one row per item-key, sorted most-exposed first.
 */
export function aggregateItemPsychometrics(
  logs: BaselineItemResponseLog[],
  opts: AggregateOptions = {},
): ItemPsychometrics[] {
  const minExposure = opts.minExposure ?? MIN_RECALIBRATION_EXPOSURE;
  const byKey = new Map<string, BaselineItemResponseLog[]>();
  for (const log of logs) {
    const list = byKey.get(log.itemKey) ?? [];
    list.push(log);
    byKey.set(log.itemKey, list);
  }

  const rows: ItemPsychometrics[] = [];
  for (const [itemKey, group] of byKey) {
    const exposure = group.length;
    const scoredLogs = group.filter((g) => !g.skipped);
    const scored = scoredLogs.length;
    const correct = scoredLogs.reduce((acc, g) => acc + (g.correct ? 1 : 0), 0);
    const pValue = scored > 0 ? round2(correct / scored) : 0;
    const skipRate = exposure > 0 ? round2((exposure - scored) / exposure) : 0;
    const seedTheta = group[0]!.difficultyTheta;
    const sufficientData = scored >= minExposure;

    const estimatedTheta = sufficientData
      ? estimateDifficultyTheta(
          scoredLogs.map((g) => ({ thetaBefore: g.thetaBefore, correct: g.correct })),
          seedTheta,
        )
      : seedTheta;
    const thetaDelta = round2(estimatedTheta - seedTheta);

    const defectReasons: string[] = [];
    if (sufficientData) {
      if (Math.abs(thetaDelta) >= MISCALIBRATION_LOGITS) {
        defectReasons.push(
          thetaDelta > 0 ? "harder_than_calibrated" : "easier_than_calibrated",
        );
      }
      if (pValue <= 0.05) defectReasons.push("near_zero_pvalue");
      if (pValue >= 0.98 && seedTheta > 0) defectReasons.push("trivial_for_band");
    }
    if (skipRate >= 0.5 && exposure >= minExposure) defectReasons.push("high_skip_rate");

    const recommendRetire =
      sufficientData &&
      (Math.abs(thetaDelta) >= SEVERE_DRIFT_LOGITS || (pValue <= 0.02 && scored >= minExposure));

    rows.push({
      itemKey,
      skillId: group[0]!.skillId,
      difficulty: group[0]!.difficulty,
      seedTheta,
      exposure,
      scored,
      correct,
      pValue,
      skipRate,
      estimatedTheta,
      thetaDelta,
      suggestedDifficulty: thetaToDifficulty(estimatedTheta),
      sufficientData,
      defectReasons,
      recommendRetire,
    });
  }

  rows.sort((a, b) => b.exposure - a.exposure || a.itemKey.localeCompare(b.itemKey));
  return rows;
}

/**
 * Recalibration map: item-key → refined θ (`b`), limited to items with
 * enough live data to trust. This is what a future selection-time override
 * would consume to replace the seed band θ.
 */
export function recalibrationMap(
  logs: BaselineItemResponseLog[],
  opts: AggregateOptions = {},
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const row of aggregateItemPsychometrics(logs, opts)) {
    if (row.sufficientData) out[row.itemKey] = row.estimatedTheta;
  }
  return out;
}
