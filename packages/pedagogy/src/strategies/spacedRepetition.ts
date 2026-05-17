/**
 * Spaced-repetition scheduler — SM-2 (SuperMemo 2) variant adapted for
 * a 0–5 quality grade derived from a binary correct/incorrect signal plus
 * latency and hint-count modifiers.
 *
 * Quality mapping:
 *   correct, no hints, fast latency  → 5 (perfect)
 *   correct, no hints                → 4
 *   correct, with hint(s)            → 3
 *   incorrect, but recovered         → 2
 *   incorrect                        → 1
 *   complete blackout (no response)  → 0
 *
 * Per SM-2: quality < 3 resets the repetition counter.
 */
import type { AnswerOutcome, MasteryRecord } from "../types.js";

export interface SpacedRepetitionInput {
  current: MasteryRecord;
  outcome: AnswerOutcome;
  /** Now, ISO-8601 — default new Date(). Useful in tests. */
  now?: string;
}

export interface SpacedRepetitionDecision {
  next: MasteryRecord;
  /** Quality 0–5 used for the SM-2 update. */
  quality: number;
}

const FAST_LATENCY_MS = 4_000;
const MIN_EASE = 1.3;

function gradeQuality(out: AnswerOutcome): number {
  if (out.correct) {
    if ((out.hintsUsed ?? 0) > 0) return 3;
    if ((out.latencyMs ?? Number.POSITIVE_INFINITY) <= FAST_LATENCY_MS) return 5;
    return 4;
  }
  // The first attempt being correct is meaningful even if subsequent
  // attempts on the same item went wrong; treat that as "still learning".
  if (out.firstAttempt) return 1;
  return 2;
}

export function initialMasteryRecord(skillId: string): MasteryRecord {
  return {
    skillId,
    mastery: 0,
    easeFactor: 2.5,
    streak: 0,
    reps: 0,
    intervalDays: 0,
    lastReviewedAt: null,
    dueAt: null,
  };
}

export function schedule(input: SpacedRepetitionInput): SpacedRepetitionDecision {
  const q = gradeQuality(input.outcome);
  const cur = input.current;
  const now = input.now ? new Date(input.now) : new Date();

  // SM-2 ease-factor update.
  const easeNext = Math.max(
    MIN_EASE,
    cur.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)),
  );

  let reps: number;
  let intervalDays: number;
  if (q < 3) {
    reps = 0;
    intervalDays = 1;
  } else {
    reps = cur.reps + 1;
    if (reps === 1) intervalDays = 1;
    else if (reps === 2) intervalDays = 6;
    else intervalDays = Math.round(cur.intervalDays * easeNext);
  }

  const dueAt = new Date(now.getTime() + intervalDays * 86_400_000).toISOString();

  // Mastery delta — same direction the existing stage uses for parity
  // with the v2.0 mastery-rollup expectation.
  const masteryDelta = input.outcome.correct ? 0.05 : -0.02;
  const mastery = Math.max(0, Math.min(1, cur.mastery + masteryDelta));
  const streak = input.outcome.correct && input.outcome.firstAttempt !== false ? cur.streak + 1 : 0;

  return {
    quality: q,
    next: {
      skillId: cur.skillId,
      mastery,
      easeFactor: easeNext,
      streak,
      reps,
      intervalDays,
      lastReviewedAt: now.toISOString(),
      dueAt,
    },
  };
}
