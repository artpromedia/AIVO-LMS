/**
 * Wave E (S11) — the agent's WRITE tools. Bounded effects only:
 *
 *   file_evidence          → append to the tutor_session_evidence ledger;
 *                            an optional SUPPLEMENTAL mastery nudge is
 *                            hard-clamped to ±0.05 before it can touch the
 *                            gradebook. The ledger row always lands first
 *                            so every mastery movement has its receipt.
 *   propose_recommendation → file ONE candidate with recommendation-svc
 *                            for parent/teacher approval (type policy,
 *                            PENDING dedupe, and the 14-day cooldown are
 *                            enforced SERVER-side there — this adapter
 *                            also pre-checks the type so a disallowed ask
 *                            never leaves the process).
 *
 * Neither tool mutates live session state, lesson content, or the learner
 * profile directly. Per-session call caps live in the orchestrator.
 */
import type { LessonObservation } from "./orchestrator.js";

/** Hard bound for a single supplemental mastery signal. */
export const MAX_SUPPLEMENTAL_MASTERY_DELTA = 0.05;

/** Per-session write caps (enforced by the orchestrator via agent_state). */
export const MAX_EVIDENCE_WRITES_PER_SESSION = 5;
export const MAX_PROPOSALS_PER_SESSION = 1;

export const EVIDENCE_KINDS = [
  "observation",
  "strategy_worked",
  "misconception",
  "mastery_signal",
] as const;
export type EvidenceKind = (typeof EVIDENCE_KINDS)[number];

/** Types a tutor may propose — mirror of recommendation-svc
 *  TUTOR_PROPOSABLE_TYPES (enforced again server-side). */
export const TUTOR_PROPOSABLE_TYPES = [
  "tutor_strategy_change",
  "preferred_surface_change",
  "self_regulation_support_add",
] as const;

export function clampMasteryDelta(raw: unknown): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(-MAX_SUPPLEMENTAL_MASTERY_DELTA, Math.min(MAX_SUPPLEMENTAL_MASTERY_DELTA, n));
}

export interface EvidenceRowInput {
  tenantId: string;
  sessionId: string;
  learnerId: string;
  skillId: string | null;
  kind: EvidenceKind;
  note: string;
  masteryDelta: number;
}

export interface ProposeRecommendationInput {
  tenantId: string;
  learnerId: string;
  tutorKey: string;
  sessionId: string;
  type: string;
  title: string;
  parentSummary: string;
  proposedValue: unknown;
  confidence?: number;
  evidenceSummary?: string;
}

export interface WriteToolDeps {
  insertEvidence(row: EvidenceRowInput): Promise<void>;
  /** Nudge the gradebook mastery score for (learner, skill); the
   *  implementation clamps the resulting score to [0, 1]. */
  applySupplementalMastery(input: {
    tenantId: string;
    learnerId: string;
    skillId: string;
    delta: number;
  }): Promise<void>;
  /** POST recommendation-svc /api/recommendations/propose. Should THROW
   *  on transport trouble; policy refusals (403/409/429) should resolve
   *  with { rejected } so the model learns the rule. */
  proposeRecommendation(
    input: ProposeRecommendationInput,
  ): Promise<{ id?: string; rejected?: string; detail?: string }>;
}

export interface WriteToolContext {
  tenantId: string;
  sessionId: string;
  learnerId: string;
  tutorKey: string;
  observation: LessonObservation;
}

export const WRITE_TOOL_SCHEMAS: Record<
  string,
  { description: string; parameters: Record<string, unknown> }
> = {
  file_evidence: {
    description:
      "Record a noteworthy observation in the learner's evidence ledger (visible to the care team). Optionally attach a SMALL supplemental mastery signal (clamped to ±0.05).",
    parameters: {
      type: "object",
      properties: {
        kind: { type: "string", enum: [...EVIDENCE_KINDS] },
        note: { type: "string", description: "3–400 chars, plain language, no PII." },
        skill_id: { type: "string", description: "Defaults to the current item's skill." },
        mastery_delta: {
          type: "number",
          description: "Supplemental nudge in [-0.05, 0.05]; omit for none.",
        },
      },
      required: ["kind", "note"],
      additionalProperties: false,
    },
  },
  propose_recommendation: {
    description:
      "Propose ONE profile recommendation for parent/teacher approval (instructional types only). Server enforces dedupe and a 14-day per-type cooldown.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string", enum: [...TUTOR_PROPOSABLE_TYPES] },
        title: { type: "string", description: "≥8 chars." },
        parent_summary: {
          type: "string",
          description: "≥20 chars — what the parent reads to decide.",
        },
        proposed_value: {
          description: "The structured change being proposed (object or string).",
        },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        evidence_summary: { type: "string" },
      },
      required: ["type", "title", "parent_summary", "proposed_value"],
      additionalProperties: false,
    },
  },
};

export const WRITE_TOOL_NAMES = ["file_evidence", "propose_recommendation"] as const;

export async function executeWriteTool(
  name: string,
  args: Record<string, unknown>,
  ctx: WriteToolContext,
  deps: WriteToolDeps,
): Promise<Record<string, unknown>> {
  try {
    switch (name) {
      case "file_evidence": {
        const kind = String(args.kind ?? "");
        if (!EVIDENCE_KINDS.includes(kind as EvidenceKind)) {
          return { error: `kind must be one of ${EVIDENCE_KINDS.join(", ")}` };
        }
        const note = typeof args.note === "string" ? args.note.trim() : "";
        if (note.length < 3) return { error: "note is required (3–400 chars)" };
        const skillId =
          (typeof args.skill_id === "string" && args.skill_id.trim()) ||
          ctx.observation.skillId ||
          null;
        const requested = args.mastery_delta;
        const delta = clampMasteryDelta(requested);
        await deps.insertEvidence({
          tenantId: ctx.tenantId,
          sessionId: ctx.sessionId,
          learnerId: ctx.learnerId,
          skillId,
          kind: kind as EvidenceKind,
          note: note.slice(0, 400),
          masteryDelta: delta,
        });
        if (delta !== 0 && skillId) {
          await deps.applySupplementalMastery({
            tenantId: ctx.tenantId,
            learnerId: ctx.learnerId,
            skillId,
            delta,
          });
        }
        const clampedNote =
          requested !== undefined && Number(requested) !== delta
            ? ` (requested ${String(requested)} was clamped to ${delta})`
            : "";
        return {
          filed: true,
          kind,
          skill_id: skillId,
          applied_mastery_delta: delta,
          note: `evidence recorded${clampedNote}`,
        };
      }
      case "propose_recommendation": {
        const type = String(args.type ?? "");
        if (!(TUTOR_PROPOSABLE_TYPES as readonly string[]).includes(type)) {
          return {
            error: `type "${type}" is not tutor-proposable; allowed: ${TUTOR_PROPOSABLE_TYPES.join(", ")}`,
          };
        }
        const title = typeof args.title === "string" ? args.title.trim() : "";
        const parentSummary =
          typeof args.parent_summary === "string" ? args.parent_summary.trim() : "";
        if (title.length < 8 || parentSummary.length < 20) {
          return { error: "title (≥8 chars) and parent_summary (≥20 chars) are required" };
        }
        if (args.proposed_value === undefined || args.proposed_value === null) {
          return { error: "proposed_value is required" };
        }
        const result = await deps.proposeRecommendation({
          tenantId: ctx.tenantId,
          learnerId: ctx.learnerId,
          tutorKey: ctx.tutorKey,
          sessionId: ctx.sessionId,
          type,
          title: title.slice(0, 160),
          parentSummary: parentSummary.slice(0, 600),
          proposedValue: args.proposed_value,
          confidence:
            typeof args.confidence === "number" && args.confidence >= 0 && args.confidence <= 1
              ? args.confidence
              : undefined,
          evidenceSummary:
            typeof args.evidence_summary === "string"
              ? args.evidence_summary.slice(0, 400)
              : undefined,
        });
        if (result.rejected) {
          return { proposed: false, rejected: result.rejected, detail: result.detail ?? "" };
        }
        return { proposed: true, recommendation_id: result.id ?? null, status: "PENDING" };
      }
      default:
        return { error: `unknown write tool "${name}"` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
