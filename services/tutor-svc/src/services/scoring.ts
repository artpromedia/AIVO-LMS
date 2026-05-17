/**
 * Re-exports from the shared @aivo/scoring package. Single source of truth
 * lives in packages/scoring.
 */
export {
  computeTutorXp,
  computeTutorQuality,
  computeLessonXp,
  computeCompletionQuality,
} from "@aivo/scoring";
export type { LessonSignals, TutorSignals } from "@aivo/scoring";
