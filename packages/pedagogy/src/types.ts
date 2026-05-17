export interface AnswerOutcome {
  /** Skill the answer is evidence for. */
  skillId: string;
  /** Was the response correct? */
  correct: boolean;
  /** Time learner took to respond, ms. Used by retrieval-strength scoring. */
  latencyMs?: number;
  /** Number of hints surfaced before the response. Higher = weaker recall. */
  hintsUsed?: number;
  /** Was the response submitted on the first attempt? */
  firstAttempt?: boolean;
  /** ISO-8601 timestamp the response was recorded. */
  recordedAt: string;
}

/**
 * Cumulative mastery state for a single skill. Persisted by the runtime;
 * pedagogy strategies read it to decide what's next.
 */
export interface MasteryRecord {
  skillId: string;
  /** 0–1 mastery score. */
  mastery: number;
  /** SM-2 ease factor (≥ 1.3). */
  easeFactor: number;
  /** Streak of consecutive correct first-attempt answers. */
  streak: number;
  /** Repetition count for spaced-repetition scheduling. */
  reps: number;
  /** Interval before next review, days. */
  intervalDays: number;
  /** ISO-8601 timestamp of the last response. */
  lastReviewedAt: string | null;
  /** ISO-8601 due date for next review. */
  dueAt: string | null;
}
