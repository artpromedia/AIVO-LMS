/**
 * Canonical mastery scoring math (adaptive-learning E2E Sprint 7).
 *
 * Single source of truth for how a lesson outcome moves a skill's mastery
 * score and how scores bucket into levels. Extracted UNCHANGED from the
 * web pipeline's `applyOutcomeToMastery` (apps/web-v2/lib/db/repos.ts) so
 * web-v2 and learning-svc apply identical math to the same mastery store.
 *
 * Score moves toward 1.0 on correctness and back toward 0.5 on poor
 * performance, with a small penalty per hint/scaffold so we don't
 * over-credit scaffolded work.
 */

export type MasteryLevel =
  | "not_started"
  | "emerging"
  | "approaching"
  | "on_grade_level"
  | "stretching";

/** Canonical level bucketing — matches the web mastery store exactly. */
export function masteryLevelFromScore(score: number): MasteryLevel {
  if (score < 0.15) return "not_started";
  if (score < 0.4) return "emerging";
  if (score < 0.65) return "approaching";
  if (score < 0.9) return "on_grade_level";
  return "stretching";
}

export interface MasteryOutcome {
  checksTotal: number;
  checksCorrect: number;
  hintsUsed: number;
  scaffoldsUsed: number;
  abandoned: boolean;
}

/**
 * The score the EWMA moves toward for a graded outcome:
 * accuracy in [0..1] (default 0.5 when there were no checks — intro-only
 * run), discounted by hint/scaffold support; abandoned runs decay toward
 * min(before, 0.5).
 */
export function masteryTargetFromOutcome(outcome: MasteryOutcome, before: number): number {
  const accuracy =
    outcome.checksTotal > 0 ? outcome.checksCorrect / outcome.checksTotal : 0.5;
  const supportPenalty = Math.min(
    0.15,
    0.04 * outcome.hintsUsed + 0.05 * outcome.scaffoldsUsed,
  );
  const adjusted = Math.max(0, accuracy - supportPenalty);
  return outcome.abandoned ? Math.min(before, 0.5) : adjusted;
}

/** Move 25% of the way from `before` toward `target`, clamped to [0, 1]. */
export function moveMasteryScore(before: number, target: number): number {
  return Math.max(0, Math.min(1, before + (target - before) * 0.25));
}
