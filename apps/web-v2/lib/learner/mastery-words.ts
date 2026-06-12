/**
 * Learner-facing mastery stage-words. Children never see raw percentages —
 * mastery reads as a friendly stage ("Building", "Strong"), the same scale
 * on every learner surface. Returns i18n keys in the `learner.progress`
 * namespace (where the catalog entries already live).
 */
export function masteryStageKey(score: number): string {
  if (score >= 0.85) return "mastery_strong";
  if (score >= 0.65) return "mastery_on_grade";
  if (score >= 0.4) return "mastery_building";
  if (score > 0) return "mastery_just_starting";
  return "mastery_not_started";
}

export function masteryStageLabel(score: number, t: (key: string) => string): string {
  return t(masteryStageKey(score));
}
