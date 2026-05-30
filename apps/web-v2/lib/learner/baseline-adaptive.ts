/**
 * Adaptive baseline bridge (Phase 0 — EPIC 1 + EPIC 2).
 *
 * The legacy baseline is *fixed-form*: `generateBaselineQuestions` picks a
 * difficulty window once from a static comfort "bias" and the whole set is
 * pre-baked. Difficulty never reacts to how the learner is actually doing.
 *
 * This module wires the question pool into the real, already-owned CAT
 * engine `@aivo/adaptive-baseline` (1-PL Elo-style θ update, Fisher-info
 * confidence, SE-based early stop). The runner serves one question at a
 * time, so by choosing the *next* question from the engine — seeded by the
 * answers so far — item N+1's difficulty genuinely depends on item N's
 * correctness.
 *
 * EPIC 2 calibration lives here too: the product's `BaselineDifficulty`
 * enum is mapped onto the θ-space `b` parameter the engine selects against
 * (`THETA_BY_DIFFICULTY`). This is the seed calibration the blueprint calls
 * for; live-data recalibration is a later epic.
 *
 * Pure / deterministic given its inputs, so it is unit-testable and the
 * server component (`app/learner/baseline/[baselineId]/page.tsx`) can call
 * it directly without new transport.
 */
import {
  initBaseline,
  pickNextItem,
  recordResponse,
  shouldStop,
  type BaselineItem,
  type BaselineState,
  type ItemResponse,
  type Modality,
  type StopDecision,
} from "@aivo/adaptive-baseline";
import type {
  BaselineAttempt,
  BaselineDifficulty,
  BaselineQuestion,
  LearnerProfile,
} from "@/lib/db/types";

/**
 * Seed calibration: the 4-level product enum mapped onto the engine's
 * θ logit scale (`b`). 0 ≈ on-grade for an average learner; negative is
 * easier, positive is harder. Spacing (~0.7 logits) keeps adjacent bands
 * distinguishable without over-separating them.
 */
export const THETA_BY_DIFFICULTY: Record<BaselineDifficulty, number> = {
  foundational: -1.0,
  approaching: -0.3,
  grade_level: 0.4,
  stretch: 1.2,
};

/** Ordered easy → hard; used for nearest-band inversion. */
const DIFFICULTY_ORDER: BaselineDifficulty[] = [
  "foundational",
  "approaching",
  "grade_level",
  "stretch",
];

export function difficultyToTheta(d: BaselineDifficulty): number {
  return THETA_BY_DIFFICULTY[d];
}

/** Inverse of {@link difficultyToTheta}: snap a θ value to the nearest band. */
export function thetaToDifficulty(theta: number): BaselineDifficulty {
  let best = DIFFICULTY_ORDER[0]!;
  let bestGap = Infinity;
  for (const d of DIFFICULTY_ORDER) {
    const gap = Math.abs(THETA_BY_DIFFICULTY[d] - theta);
    if (gap < bestGap) {
      bestGap = gap;
      best = d;
    }
  }
  return best;
}

/**
 * Infer the delivery modalities of a question. Picture-prompted items
 * (scene/choice emoji or an image) are treated as visual + reading-light
 * so the selector can up-weight them for reading-difficulty learners;
 * text-only items are reading.
 */
export function questionModalities(q: BaselineQuestion): {
  modalities: Modality[];
  lightReading: boolean;
} {
  const hasPicture = Boolean(
    q.sceneEmoji || (q.choiceEmojis && q.choiceEmojis.length > 0) || q.imageUrl,
  );
  return hasPicture
    ? { modalities: ["visual"], lightReading: true }
    : { modalities: ["reading"], lightReading: false };
}

/**
 * Calibration override: item-key (`${skillId}|${difficulty}`) → refined θ
 * (`b`) learned from live data. Only confident estimates belong here (the
 * recalibration job gates on exposure), so the mere presence of a key is
 * the confidence gate — absent keys fall back to the seed band θ.
 */
export type CalibrationMap = Record<string, number>;

/** Stable calibration key for a question across baselines. */
export function itemKeyFor(q: { skillId: string; difficulty: BaselineDifficulty }): string {
  return `${q.skillId}|${q.difficulty}`;
}

/**
 * Map a product question onto the engine's item contract. When a
 * `calibration` override carries a refined θ for this item's key, the
 * refined value replaces the seed band θ — this is how live recalibration
 * feeds back into selection.
 */
export function questionToBaselineItem(
  q: BaselineQuestion,
  calibration?: CalibrationMap,
): BaselineItem {
  const { modalities, lightReading } = questionModalities(q);
  const override = calibration?.[itemKeyFor(q)];
  return {
    id: q.id,
    skillId: q.skillId,
    difficulty: override ?? difficultyToTheta(q.difficulty),
    modalities,
    lightReading,
    // 2-PL: carries through to the engine when the question is calibrated
    // with a discrimination; omitted ⇒ engine defaults to a=1 (1-PL).
    ...(q.discrimination !== undefined ? { discrimination: q.discrimination } : {}),
  };
}

const THETA_BY_COMFORT: Record<string, number> = {
  advanced: 0.8,
  confident: 0.2,
  growing: -0.6,
  new: -1.2,
};

function comfortToTheta(comfort: string | null | undefined): number {
  if (!comfort) return 0;
  return THETA_BY_COMFORT[comfort] ?? 0;
}

/**
 * Cold-start prior θ (EPIC 3 seed). Averages reading + math comfort so the
 * first item lands near the learner's likely level instead of always
 * starting at 0 (which wastes items and can spike anxiety). The downstream
 * engine refines this after every answer.
 */
export function priorThetaForLearner(learner: LearnerProfile | null): number {
  if (!learner) return 0;
  const r = comfortToTheta(learner.readingComfort);
  const m = comfortToTheta(learner.mathComfort);
  return Math.round(((r + m) / 2) * 100) / 100;
}

/** Reading-difficulty hint → engine up-weights `lightReading` items. */
export function learnerHasReadingDifficulty(learner: LearnerProfile | null): boolean {
  if (!learner) return false;
  return learner.readingComfort === "new" || Boolean(learner.accessibilityDefaults?.audioFirst);
}

/**
 * Replay the answered (non-skipped) attempts through the engine to rebuild
 * the current θ / Fisher-info state. Skipped items carry no correctness
 * signal so they are excluded from θ but still count as "seen" by the
 * selector (see {@link selectNextAdaptiveQuestion}).
 */
export function reconstructAdaptiveState(
  questions: BaselineQuestion[],
  attempts: BaselineAttempt[],
  opts: { priorTheta?: number; readingDifficulty?: boolean; calibration?: CalibrationMap } = {},
): BaselineState {
  const itemByQid = new Map(
    questions.map((q) => [q.id, questionToBaselineItem(q, opts.calibration)]),
  );
  const ordered = [...attempts].sort((a, b) => a.respondedAt.localeCompare(b.respondedAt));

  let state = initBaseline({
    priorTheta: opts.priorTheta,
    readingDifficulty: opts.readingDifficulty,
  });
  for (const attempt of ordered) {
    if (attempt.skipped) continue;
    const item = itemByQid.get(attempt.questionId);
    if (!item) continue;
    const response: ItemResponse = {
      itemId: item.id,
      correct: attempt.isCorrect,
      // BaselineAttempt does not yet capture response latency; 0 is a
      // benign placeholder (latency feeds the profile, not selection).
      responseTimeMs: 0,
      consumedModality: item.modalities[0],
    };
    state = recordResponse({ state, item, response });
  }
  return state;
}

// --- Kindness guardrails (G5) -------------------------------------------
// The engine homes in on θ, but a struggling learner should never be
// pushed *above* their level — overshooting is what triggers frustration
// and shutdown. We cap the hardest item we'll serve at θ + a ceiling, and
// tighten that ceiling as recent struggle mounts.

/** Base ceiling: never serve an item harder than θ + 1.0 logits. */
export const FRUSTRATION_CEILING_LOGITS = 1.0;
const CEILING_MILD = 0.5;
const CEILING_HIGH = 0.25;
/** Trailing wrong/skip run lengths that escalate the frustration level. */
const STREAK_MILD = 2;
export const STREAK_HIGH = 3;
/** A single very slow answer (ms) nudges the level up one notch. */
const LONG_LATENCY_MS = 45_000;

export type FrustrationLevel = "none" | "mild" | "high";

export interface FrustrationAssessment {
  level: FrustrationLevel;
  /** Logits above θ that selection will not exceed at this level. */
  ceiling: number;
  /** Length of the trailing wrong-or-skipped run. */
  struggleStreak: number;
}

/**
 * Read recent struggle from the answer history. Affect signals aren't
 * captured by this client yet, so we proxy frustration from a trailing run
 * of wrong/skipped answers, escalated by an unusually slow last answer.
 */
export function assessFrustration(attempts: BaselineAttempt[]): FrustrationAssessment {
  const ordered = [...attempts].sort((a, b) => a.respondedAt.localeCompare(b.respondedAt));
  let streak = 0;
  for (let i = ordered.length - 1; i >= 0; i--) {
    const a = ordered[i]!;
    if (a.skipped || !a.isCorrect) streak += 1;
    else break;
  }
  let level: FrustrationLevel = streak >= STREAK_HIGH ? "high" : streak >= STREAK_MILD ? "mild" : "none";

  const last = ordered[ordered.length - 1];
  if (last && typeof last.latencyMs === "number" && last.latencyMs >= LONG_LATENCY_MS) {
    level = level === "none" ? "mild" : "high";
  }

  const ceiling =
    level === "high" ? CEILING_HIGH : level === "mild" ? CEILING_MILD : FRUSTRATION_CEILING_LOGITS;
  return { level, ceiling, struggleStreak: streak };
}

export interface AdaptiveSelection {
  /** The next question to administer, or `null` when the run should end. */
  next: BaselineQuestion | null;
  /** Engine stop decision (max-items / SE / min-items-pending / in-progress). */
  stop: StopDecision;
  /** Current ability estimate after replaying the answers so far. */
  theta: number;
  /** Count of scored (non-skipped) answers replayed into θ. */
  answeredCount: number;
  /** Recent-struggle read used to gate the difficulty ceiling. */
  frustration: FrustrationAssessment;
}

export interface SelectNextInput {
  questions: BaselineQuestion[];
  attempts: BaselineAttempt[];
  priorTheta?: number;
  readingDifficulty?: boolean;
  /** Live recalibration overrides; absent keys use the seed band θ. */
  calibration?: CalibrationMap;
}

/**
 * Choose the next baseline question adaptively. Returns `next: null` when
 * the engine says to stop (SE/min/max caps) or the pool is exhausted — the
 * runner treats that exactly like "every question answered" and shows the
 * finish screen, which is how early-stop surfaces without UI changes.
 */
export function selectNextAdaptiveQuestion(input: SelectNextInput): AdaptiveSelection {
  const { questions, attempts, calibration } = input;
  const state = reconstructAdaptiveState(questions, attempts, {
    priorTheta: input.priorTheta,
    readingDifficulty: input.readingDifficulty,
    calibration,
  });

  const stop = shouldStop(state);
  const answeredCount = state.administered.length;
  const frustration = assessFrustration(attempts);
  if (stop.stop) {
    return { next: null, stop, theta: state.theta, answeredCount, frustration };
  }

  // Exclude every already-seen question (answered AND skipped) so a skipped
  // item is never re-shown.
  const seen = new Set(attempts.map((a) => a.questionId));
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const candidateBank: BaselineItem[] = questions
    .filter((q) => !seen.has(q.id))
    .map((q) => questionToBaselineItem(q, calibration));

  if (candidateBank.length === 0) {
    return { next: null, stop, theta: state.theta, answeredCount, frustration };
  }

  // Kindness ceiling: never serve an item harder than θ + ceiling. When
  // the whole remaining pool is above the ceiling, serve the *easiest*
  // item (undershoot) rather than the nearest, so a struggling learner is
  // never pushed further past their level.
  const ceiling = state.theta + frustration.ceiling;
  const withinCeiling = candidateBank.filter((it) => it.difficulty <= ceiling);
  const pick =
    withinCeiling.length > 0
      ? pickNextItem(state, withinCeiling)
      : candidateBank.reduce((easiest, it) => (it.difficulty < easiest.difficulty ? it : easiest));

  const next = pick ? (questionById.get(pick.id) ?? null) : null;
  return { next, stop, theta: state.theta, answeredCount, frustration };
}
