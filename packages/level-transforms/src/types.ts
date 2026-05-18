/**
 * Functioning-level content transforms (§9.3 Extract 4–6w).
 *
 * The "functioning level" ladder in `@aivo/brand` (STANDARD → SUPPORTED →
 * LOW_VERBAL → NON_VERBAL → PRE_SYMBOLIC) describes how a learner is
 * expected to access content. Authoring teams produce a *single* pack at
 * STANDARD (§5 Content infrastructure) and the runtime transforms each
 * activity down the ladder for learners who need scaffolding, picture
 * support, switch-scan, or pre-symbolic cause-and-effect substitutes.
 *
 * Each transform is a pure function `Activity → Activity` so transforms
 * are deterministic, composable, and trivially testable.
 *
 * The five canonical levels are:
 *
 *   STANDARD     — render the activity as authored
 *   SUPPORTED    — add scaffolding cues + reduce simultaneous choices
 *   LOW_VERBAL   — replace prose with picture choices, reduce text
 *   NON_VERBAL   — switch-scannable, no expressive-speech requirement
 *   PRE_SYMBOLIC — cause-and-effect tap with observational scoring
 */
export type FunctioningLevel =
  | "STANDARD"
  | "SUPPORTED"
  | "LOW_VERBAL"
  | "NON_VERBAL"
  | "PRE_SYMBOLIC";

export const FUNCTIONING_LEVEL_ORDER: readonly FunctioningLevel[] = [
  "STANDARD",
  "SUPPORTED",
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
] as const;

/**
 * Returns true if `from` is "stronger / more demanding" than `to` — i.e.
 * `transformDown(from, to, …)` makes sense. STANDARD is the strongest;
 * PRE_SYMBOLIC is the most accessible. Transforms only run downhill.
 */
export function isDownhill(from: FunctioningLevel, to: FunctioningLevel): boolean {
  return FUNCTIONING_LEVEL_ORDER.indexOf(from) < FUNCTIONING_LEVEL_ORDER.indexOf(to);
}
