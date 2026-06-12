/**
 * Wave E (S9) — agent action → lesson-player directive mapping.
 *
 * Pure + isomorphic (imported by both the BFF agent-turn route and the
 * client lesson player), so the translation from the tutor agent's
 * validated wire action to a renderable directive is tested once and
 * applied identically on both sides of the network seam.
 *
 * The action vocabulary is CLOSED (ai-svc validates against it, tutor-svc
 * re-validates via the SessionMachine guard); anything unrecognised here
 * maps to `none` — the deterministic no-op — never to a crash.
 */

/** Validated agent action as returned by tutor-svc (snake_case wire). */
export type AgentWireAction = { kind: string } & Record<string, unknown>;

/**
 * Identity of the agent tutor watching a lesson (brand tutor fields the
 * panel renders). Present only when agentic mode is on for the lesson.
 */
export type LessonAgentConfig = {
  tutorKey: string;
  name: string;
  icon: string;
  color: string;
};

/** Decision envelope from POST /api/tutor/agent/session/:id/turn. */
export type AgentTurnDecision = {
  kind: "action" | "deterministic";
  action: AgentWireAction | null;
  effect: "advance" | "insert_beat" | "non_structural" | "end" | null;
  reason: string | null;
  rung: "full" | "checkpoint" | "deterministic";
  seq: number;
  latencyMs: number;
};

export type RemediationApproach =
  | "worked_example"
  | "simpler_item"
  | "manipulative"
  | "re_explain";

export type AgentModality = "visual" | "auditory" | "kinesthetic" | "reading";

/** What the lesson player should do with one agent decision. */
export type LessonAgentDirective =
  | { type: "none" }
  | { type: "advance"; encouragement: string | null }
  | { type: "show_scaffold"; text: string }
  | { type: "insert_remediation"; focus: string; approach: RemediationApproach }
  | { type: "offer_break"; reason: string; durationSeconds: number }
  | { type: "switch_modality"; modality: AgentModality }
  | { type: "present_surface"; surfaceType: string }
  | { type: "say"; text: string }
  | { type: "end_early"; reason: string };

const REMEDIATION_APPROACHES: ReadonlySet<string> = new Set([
  "worked_example",
  "simpler_item",
  "manipulative",
  "re_explain",
]);

const MODALITIES: ReadonlySet<string> = new Set([
  "visual",
  "auditory",
  "kinesthetic",
  "reading",
]);

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim().length > 0 ? v : null;
}

export function directiveFromDecision(
  decision: Pick<AgentTurnDecision, "kind" | "action">,
): LessonAgentDirective {
  if (decision.kind !== "action" || !decision.action) return { type: "none" };
  const a = decision.action;
  switch (a.kind) {
    case "advance":
      return { type: "advance", encouragement: str(a.encouragement) };
    case "insert_scaffold": {
      const text = str(a.scaffold);
      return text ? { type: "show_scaffold", text } : { type: "none" };
    }
    case "remediate": {
      const focus = str(a.focus);
      if (!focus) return { type: "none" };
      const approach = REMEDIATION_APPROACHES.has(String(a.approach))
        ? (a.approach as RemediationApproach)
        : "re_explain";
      return { type: "insert_remediation", focus, approach };
    }
    case "offer_break": {
      const seconds = Number(a.duration_seconds);
      return {
        type: "offer_break",
        reason: str(a.reason) ?? "pacing",
        durationSeconds:
          Number.isFinite(seconds) && seconds >= 15 && seconds <= 600 ? seconds : 60,
      };
    }
    case "switch_modality": {
      const modality = String(a.modality);
      return MODALITIES.has(modality)
        ? { type: "switch_modality", modality: modality as AgentModality }
        : { type: "none" };
    }
    case "present_surface": {
      const surfaceType = str(a.surface_type);
      return surfaceType ? { type: "present_surface", surfaceType } : { type: "none" };
    }
    case "say": {
      const text = str(a.text);
      return text ? { type: "say", text } : { type: "none" };
    }
    case "end_early":
      return { type: "end_early", reason: str(a.reason) ?? "agent_ended" };
    default:
      return { type: "none" };
  }
}

/**
 * Surface types the lesson player can re-present an item on without
 * authored specs. A `present_surface` outside this set degrades to a panel
 * message. Remediation Sprint 02: `number_line` no longer has a hardcoded
 * fixture — the player derives its range from the item's own answer space
 * (deriveNumberLineSpec) and keeps the source surface when underivable;
 * the remaining entries still use toSurfaceItem's coherent defaults.
 */
export const PRESENTABLE_SURFACES: ReadonlySet<string> = new Set([
  "choice_grid",
  "math_expression",
  "number_line",
  "scratchpad",
  "drag_manipulative",
]);
