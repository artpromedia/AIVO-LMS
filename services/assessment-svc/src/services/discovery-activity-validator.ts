/**
 * Backend validator for AI-generated discovery activities. Mirrors the
 * surface contract defined in `@aivo/learner-surfaces` and the web
 * runtime validator in `apps/web/src/components/discovery/activity-schema.ts`.
 *
 * Used by `/api/assessments/learner/discovery/:learnerId/chapter` to
 * partition AI output into valid + rejected items before returning to
 * the client. Geometry items missing accessibility metadata or shapes
 * never reach the learner.
 */

export type ActivityInteraction =
  | "choice_grid"
  | "tap_image"
  | "tap_word"
  | "drag_sort"
  | "drag_place"
  | "sequence"
  | "pattern_fill"
  | "memory"
  | "memory_sequence"
  | "observation"
  | "emotion_pick"
  | "draw"
  | "scratchpad"
  | "geometry_workspace"
  | "math_expression"
  | "voice_response"
  | "reading_annotation"
  | "science_diagram";

export type FeedbackMode =
  | "immediate_supportive"
  | "delayed_after_item"
  | "delayed_after_block"
  | "no_correctness_feedback_diagnostic";

export interface ValidationOutcome {
  validActivities: any[];
  rejectedActivities: Array<{ id?: string; reason: string }>;
}

const SURFACE_REQUIRED = new Set<string>([
  "draw",
  "scratchpad",
  "geometry_workspace",
  "math_expression",
  "reading_annotation",
  "science_diagram",
]);

const KNOWN_INTERACTIONS = new Set<string>([
  "choice_grid",
  "tap_image",
  "tap_word",
  "drag_sort",
  "drag_place",
  "sequence",
  "pattern_fill",
  "memory",
  "memory_sequence",
  "observation",
  "emotion_pick",
  "draw",
  "scratchpad",
  "geometry_workspace",
  "math_expression",
  "voice_response",
  "reading_annotation",
  "science_diagram",
]);

const KNOWN_FEEDBACK_MODES = new Set<string>([
  "immediate_supportive",
  "delayed_after_item",
  "delayed_after_block",
  "no_correctness_feedback_diagnostic",
]);

const KNOWN_SCORING_MODES = new Set<string>(["exact", "rubric", "process", "hybrid"]);

export function validateDiscoveryActivity(activity: any): { ok: true } | { ok: false; reason: string } {
  if (!activity || typeof activity !== "object") return { ok: false, reason: "not_object" };
  if (!activity.id || typeof activity.id !== "string") return { ok: false, reason: "missing_id" };
  if (!activity.domain || typeof activity.domain !== "string") return { ok: false, reason: "missing_domain" };
  if (!activity.difficulty) return { ok: false, reason: "missing_difficulty" };
  if (!activity.interaction || !KNOWN_INTERACTIONS.has(activity.interaction)) {
    return { ok: false, reason: `unsupported_interaction:${activity.interaction}` };
  }
  if (!activity.prompt || typeof activity.prompt !== "string") return { ok: false, reason: "missing_prompt" };
  if (activity.feedbackMode && !KNOWN_FEEDBACK_MODES.has(activity.feedbackMode)) {
    return { ok: false, reason: `unsupported_feedback_mode:${activity.feedbackMode}` };
  }
  if (!Array.isArray(activity.brainMeasures)) {
    return { ok: false, reason: "missing_brain_measures" };
  }
  if (!activity.scoring || typeof activity.scoring !== "object") {
    return { ok: false, reason: "missing_scoring" };
  }
  if (!KNOWN_SCORING_MODES.has(activity.scoring.mode)) {
    return { ok: false, reason: `unsupported_scoring_mode:${activity.scoring.mode}` };
  }

  if (SURFACE_REQUIRED.has(activity.interaction)) {
    const surface = activity.surface;
    if (!surface || typeof surface !== "object") {
      return { ok: false, reason: `${activity.interaction}_requires_surface` };
    }
    if (!surface.accessibility?.altText) {
      return { ok: false, reason: "surface_missing_alt_text" };
    }
    if (activity.interaction === "geometry_workspace") {
      if (surface.type !== "geometry_workspace") return { ok: false, reason: "wrong_surface_type" };
      if (!surface.diagram || !Array.isArray(surface.diagram.shapes) || surface.diagram.shapes.length === 0) {
        return { ok: false, reason: "geometry_missing_shapes" };
      }
    }
    if (
      (activity.interaction === "draw" || activity.interaction === "scratchpad") &&
      surface.capture?.inkStrokes !== true
    ) {
      return { ok: false, reason: "surface_missing_ink_capture" };
    }
    if (!surface.scoring || !KNOWN_SCORING_MODES.has(surface.scoring.mode)) {
      return { ok: false, reason: "surface_missing_scoring_mode" };
    }
  }

  return { ok: true };
}

export function partitionDiscoveryActivities(activities: readonly any[]): ValidationOutcome {
  const validActivities: any[] = [];
  const rejectedActivities: Array<{ id?: string; reason: string }> = [];
  for (const activity of activities) {
    const result = validateDiscoveryActivity(activity);
    if (result.ok) {
      validActivities.push(activity);
    } else {
      rejectedActivities.push({ id: activity?.id, reason: result.reason });
    }
  }
  return { validActivities, rejectedActivities };
}

export function partitionChapterActivitiesPayload(payload: any): {
  activities: any;
  rejectedActivities: Array<{ id?: string; reason: string }>;
  totalValid: number;
} {
  if (!payload || typeof payload !== "object") {
    return { activities: { easy: [], medium: [], hard: [] }, rejectedActivities: [], totalValid: 0 };
  }
  const tiers = ["easy", "medium", "hard"] as const;
  const out: any = { easy: [], medium: [], hard: [] };
  const rejected: Array<{ id?: string; reason: string }> = [];
  for (const tier of tiers) {
    const items = Array.isArray(payload[tier]) ? payload[tier] : [];
    const result = partitionDiscoveryActivities(items);
    out[tier] = result.validActivities;
    rejected.push(...result.rejectedActivities.map((r) => ({ ...r, reason: `${tier}:${r.reason}` })));
  }
  const totalValid = out.easy.length + out.medium.length + out.hard.length;
  return { activities: out, rejectedActivities: rejected, totalValid };
}
