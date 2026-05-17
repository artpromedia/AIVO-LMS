/**
 * Re-exports from the shared @aivo/scoring package so callers within
 * learning-svc keep working unchanged. Single source of truth lives in
 * packages/scoring; do not add formulas here.
 */
export {
  computeLessonXp,
  computeCompletionQuality,
  computeTutorXp,
  computeTutorQuality,
} from "@aivo/scoring";
export type { LessonSignals, TutorSignals } from "@aivo/scoring";
