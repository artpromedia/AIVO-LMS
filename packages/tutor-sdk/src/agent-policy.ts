/**
 * Wave E (S8) — agent action policies + toolsets for tutor definitions.
 *
 * The agent loop (ai-svc `ai_svc/agent/actions.py`) speaks a CLOSED action
 * vocabulary; this module is the TypeScript side of that lockstep — the two
 * lists must match or the agent can propose moves the runtime rejects.
 *
 * A tutor's `actionPolicy` narrows the vocabulary PER FUNCTIONING LEVEL:
 * the action space contracts as support needs grow. The floor everyone
 * shares: free-text `say` is excluded at LOW_VERBAL and below — those
 * learners get pre-approved surfaces, scaffolds, and regulation moves,
 * never improvised prose (enforced again by the SDK validator and by the
 * SessionMachine guard, so a mis-authored policy cannot widen it).
 */
import type { TutorFunctioningLevel } from "./types.js";

/** MUST stay in lockstep with ai-svc `ACTION_KINDS` (agent/actions.py). */
export const AGENT_ACTION_KINDS = [
  "advance",
  "remediate",
  "switch_modality",
  "insert_scaffold",
  "offer_break",
  "end_early",
  "present_surface",
  "say",
] as const;

export type AgentActionKind = (typeof AGENT_ACTION_KINDS)[number];

/**
 * Tool ids the orchestrator (tutor-svc) can execute. Read tools are safe
 * everywhere; domain tools are declared only by tutors whose backing
 * service exists (no tutor ships "agentic" with a tool it cannot call).
 */
export const AGENT_TOOL_IDS = [
  // Core read belt
  "get_learner_snapshot",
  "get_skill_position",
  "get_curriculum_context",
  // Domain tools (backed by real services)
  "read_math_work", // math-recognizer-svc
  "score_pronunciation", // speech-eval-svc
  "evaluate_science_answer", // science-solver-svc
  "break_down_task", // tutor-svc EF breakdown
  // Write tools (Wave E S11) — bounded effects, never direct state edits:
  // file_evidence appends to the evidence ledger (mastery nudge clamped
  // to ±0.05); propose_recommendation creates a PENDING recommendation
  // that a parent/teacher must approve (cooldown + dedupe server-side).
  "file_evidence",
  "propose_recommendation",
] as const;

export type AgentToolId = (typeof AGENT_TOOL_IDS)[number];

export type TutorActionPolicy = Readonly<
  Partial<Record<TutorFunctioningLevel, readonly AgentActionKind[]>>
>;

export interface TutorMemoryPolicy {
  /** Whether the tutor may write episodic learner memories (Wave E S12). */
  canRemember: boolean;
  /** Memory kinds the tutor may write; must be empty when canRemember=false. */
  kinds: readonly string[];
}

/** Until the memory store ships (S12), every tutor declares no-memory. */
export const NO_MEMORY: TutorMemoryPolicy = Object.freeze({
  canRemember: false,
  kinds: Object.freeze([]) as readonly string[],
});

const ALL_ACTIONS: readonly AgentActionKind[] = AGENT_ACTION_KINDS;
const NO_FREE_TEXT: readonly AgentActionKind[] = [
  "advance",
  "remediate",
  "switch_modality",
  "insert_scaffold",
  "offer_break",
  "end_early",
  "present_surface",
];
const SURFACES_AND_REGULATION: readonly AgentActionKind[] = [
  "advance",
  "switch_modality",
  "offer_break",
  "end_early",
  "present_surface",
];

/**
 * The canonical per-level policy every tutor starts from:
 *   STANDARD / SUPPORTED → the full vocabulary,
 *   LOW_VERBAL           → no free-text `say`,
 *   NON_VERBAL / PRE_SYMBOLIC → surfaces + regulation only.
 * Pass `overrides` to narrow specific levels further (a tutor can only
 * ever SHRINK a level's set relative to the standard — widening past the
 * standard floor is a validator error).
 */
export function standardActionPolicy(
  overrides: Partial<Record<TutorFunctioningLevel, readonly AgentActionKind[]>> = {},
): TutorActionPolicy {
  return Object.freeze({
    STANDARD: overrides.STANDARD ?? ALL_ACTIONS,
    SUPPORTED: overrides.SUPPORTED ?? ALL_ACTIONS,
    LOW_VERBAL: overrides.LOW_VERBAL ?? NO_FREE_TEXT,
    NON_VERBAL: overrides.NON_VERBAL ?? SURFACES_AND_REGULATION,
    PRE_SYMBOLIC: overrides.PRE_SYMBOLIC ?? SURFACES_AND_REGULATION,
  });
}

/** Levels at which free-text `say` is NEVER allowed, regardless of policy. */
export const NO_SAY_LEVELS: readonly TutorFunctioningLevel[] = [
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
];
