/**
 * Sprint C-03 — qualitative mastery estimates for parent-facing surfaces.
 *
 * The brain reveal must never show a fabricated grade number (the old
 * `scoreToGradeEquiv` multiplied a normalised score by the enrolled grade,
 * which is not a grade-equivalent by any psychometric standard). Parents see
 * the same four qualitative estimates the rest of the product uses
 * ("Just starting / Growing / Confident / Advanced") instead.
 *
 * The score↔estimate mapping below is the single source of truth shared by
 * the brain-clone-watch page (server) and the cinematic BrainBuildingSequence
 * (client). It mirrors `lib/learner/brain-profile.ts` (`masteryLevelToScore`)
 * so the bar widths in the cinematic line up with how the clone itself scores
 * each estimate.
 */
import type { ComfortLevel } from "@/lib/db/types";

/** i18n keys (relative to the `brain_clone` namespace) for each estimate. */
export const MASTERY_ESTIMATE_LABEL_KEY: Record<ComfortLevel, string> = {
  new: "building_estimate_new",
  growing: "building_estimate_growing",
  confident: "building_estimate_confident",
  advanced: "building_estimate_advanced",
};

/** Representative normalised score for each estimate (drives bar widths). */
export const MASTERY_ESTIMATE_SCORE: Record<ComfortLevel, number> = {
  new: 0.3,
  growing: 0.55,
  confident: 0.8,
  advanced: 0.95,
};

/**
 * Inverse of `MASTERY_ESTIMATE_SCORE` using midpoint thresholds, for the
 * brain-svc `masteryDecisionsDetailed` path where only a normalised score is
 * available. Prefer the authoritative `masteryOverview` estimate when the
 * domain matches a known subject; this is the fallback.
 */
export function estimateForScore(score: number): ComfortLevel {
  if (score >= 0.875) return "advanced";
  if (score >= 0.675) return "confident";
  if (score >= 0.425) return "growing";
  return "new";
}
