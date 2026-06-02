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

/** Median of a numeric list, rounded; null when empty. */
function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
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
        responseTimeMs: attempt.latencyMs ?? 0,
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
      ...(attempt.latencyMs !== undefined ? { latencyMs: attempt.latencyMs } : {}),
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

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

/** Bounds on the recovered 2-PL discrimination (typical IRT range). */
const A_MIN = 0.3;
const A_MAX = 2.5;
/** θ spread below which `a` is not identifiable from the data. */
const MIN_THETA_SPREAD = 0.5;

export interface TwoPlEstimate {
  /** Difficulty (b). */
  b: number;
  /** Discrimination (a); 1 when the data can't identify it. */
  a: number;
  /** True when `a` was actually estimated (enough θ spread). */
  identifiedA: boolean;
}

/**
 * Joint 2-PL difficulty + discrimination estimate from
 * (ability, correct) pairs, by gradient ascent on the 2-PL log-likelihood:
 *
 *   p_i = σ(a·(θ_i − b))
 *   ∂LL/∂a = Σ (y_i − p_i)·(θ_i − b)
 *   ∂LL/∂b = −a·Σ (y_i − p_i)
 *
 * Discrimination is only identifiable when the abilities vary, so with too
 * little θ spread (or too little data) it falls back to a=1 and the 1-PL
 * difficulty estimate.
 */
export function estimate2PL(
  samples: { thetaBefore: number; correct: boolean }[],
  fallbackB = 0,
): TwoPlEstimate {
  const n = samples.length;
  const b0 = estimateDifficultyTheta(samples, fallbackB);
  if (n < 2) return { b: b0, a: 1, identifiedA: false };

  const thetas = samples.map((s) => s.thetaBefore);
  const spread = Math.max(...thetas) - Math.min(...thetas);
  if (spread < MIN_THETA_SPREAD) return { b: b0, a: 1, identifiedA: false };

  let a = 1;
  let b = b0;
  const lr = 0.1;
  for (let iter = 0; iter < 800; iter++) {
    let ga = 0;
    let gb = 0;
    for (const s of samples) {
      const p = 1 / (1 + Math.exp(-a * (s.thetaBefore - b)));
      const err = (s.correct ? 1 : 0) - p;
      ga += err * (s.thetaBefore - b);
      gb += -a * err;
    }
    a = clamp(a + (lr * ga) / n, A_MIN, A_MAX);
    b = clamp(b + (lr * gb) / n, -4, 4);
  }
  return { b: round2(b), a: round2(a), identifiedA: true };
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
    const medianLatencyMs = medianOf(
      scoredLogs
        .map((g) => g.latencyMs)
        .filter((v): v is number => typeof v === "number" && v >= 0),
    );
    const seedTheta = group[0]!.difficultyTheta;
    const sufficientData = scored >= minExposure;

    const fit = sufficientData
      ? estimate2PL(
          scoredLogs.map((g) => ({ thetaBefore: g.thetaBefore, correct: g.correct })),
          seedTheta,
        )
      : { b: seedTheta, a: 1, identifiedA: false };
    const estimatedTheta = fit.b;
    const estimatedDiscrimination = fit.a;
    const thetaDelta = round2(estimatedTheta - seedTheta);

    const defectReasons: string[] = [];
    if (sufficientData) {
      if (Math.abs(thetaDelta) >= MISCALIBRATION_LOGITS) {
        defectReasons.push(thetaDelta > 0 ? "harder_than_calibrated" : "easier_than_calibrated");
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
      medianLatencyMs,
      estimatedTheta,
      thetaDelta,
      estimatedDiscrimination,
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
 * Recalibration map: item-key → refined `{difficulty, discrimination}`,
 * limited to items with enough live data to trust. Consumed by
 * `selectNextAdaptiveQuestion` to serve items at their observed 2-PL
 * parameters. Discrimination is included only when the data identified it
 * (and it differs from the 1-PL default), so 1-PL items stay 1-PL.
 */
export function recalibrationMap(
  logs: BaselineItemResponseLog[],
  opts: AggregateOptions = {},
): CalibrationMap {
  const out: CalibrationMap = {};
  for (const row of aggregateItemPsychometrics(logs, opts)) {
    if (!row.sufficientData) continue;
    out[row.itemKey] = {
      difficulty: row.estimatedTheta,
      ...(row.estimatedDiscrimination !== 1 ? { discrimination: row.estimatedDiscrimination } : {}),
    };
  }
  return out;
}
