/**
 * @aivo/pedagogy — pedagogical strategy primitives (§9.3 Greenfield 6–8w).
 *
 * The tutor runtime consumes these strategies to decide what to do next
 * given a learner's recent answer history. All strategies are *pure* —
 * inputs in, decision out, no side effects — so a session can be
 * deterministically replayed for QA / regression tests.
 */
export type { MasteryRecord, AnswerOutcome } from "./types.js";
export { scaffold, type ScaffoldDecision, type ScaffoldInput } from "./strategies/scaffolding.js";
export { retrieve, type RetrievalDecision, type RetrievalInput } from "./strategies/retrieval.js";
export {
  schedule,
  initialMasteryRecord,
  type SpacedRepetitionDecision,
  type SpacedRepetitionInput,
} from "./strategies/spacedRepetition.js";
export {
  correctError,
  type ErrorCorrectionDecision,
  type ErrorCorrectionInput,
} from "./strategies/errorCorrection.js";
