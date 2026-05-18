/**
 * Lightweight, dependency-free runtime validator for AI-generated
 * discovery activities. The web app does not yet pull in zod, so we
 * keep this as plain TypeScript guards. The backend has a parallel
 * validator (`services/assessment-svc/src/services/discovery-activity-validator.ts`)
 * that catches malformed payloads before they ever leave the API —
 * this layer is the second line of defense for items that slip
 * through (fixture data, cached payloads, replay).
 */
import type { LearnerSurfaceSpec, FeedbackMode } from "@aivo/learner-surfaces";

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

export interface DiscoveryActivityScoring {
  mode: "exact" | "rubric" | "process" | "hybrid";
  correctAnswer?: string | number | boolean;
  rubric?: Array<{ id: string; label: string; points: number; description: string }>;
}

export interface DiscoveryActivityCandidate {
  id?: string;
  domain?: string;
  skillCode?: string;
  standardCode?: string;
  difficulty?: "easy" | "medium" | "hard" | "adaptive";
  estimatedDifficulty?: number;
  interaction?: ActivityInteraction;
  prompt?: string;
  tutorLine?: string;
  sceneEmoji?: string;
  choices?: Array<{
    id: string;
    label: string;
    emoji?: string;
    image?: string;
    isCorrect?: boolean;
  }>;
  surface?: LearnerSurfaceSpec;
  feedbackMode?: FeedbackMode;
  brainMeasures?: string[];
  scoring?: DiscoveryActivityScoring;
}

export interface ValidatedDiscoveryActivity {
  id: string;
  domain: string;
  skillCode?: string;
  standardCode?: string;
  difficulty: "easy" | "medium" | "hard" | "adaptive";
  estimatedDifficulty?: number;
  interaction: ActivityInteraction;
  prompt: string;
  tutorLine?: string;
  sceneEmoji?: string;
  choices?: Array<{
    id: string;
    label: string;
    emoji?: string;
    image?: string;
    isCorrect?: boolean;
  }>;
  surface?: LearnerSurfaceSpec;
  feedbackMode?: FeedbackMode;
  brainMeasures?: string[];
  scoring?: DiscoveryActivityScoring;
}

export interface ActivityValidationResult {
  validActivities: ValidatedDiscoveryActivity[];
  rejectedActivities: Array<{ id?: string; reason: string }>;
}

const SURFACE_REQUIRED: ReadonlySet<ActivityInteraction> = new Set<ActivityInteraction>([
  "draw",
  "scratchpad",
  "geometry_workspace",
  "math_expression",
  "reading_annotation",
  "science_diagram",
]);

const KNOWN_INTERACTIONS: ReadonlySet<ActivityInteraction> = new Set<ActivityInteraction>([
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

export function validateDiscoveryActivity(
  activity: DiscoveryActivityCandidate,
): { ok: true; value: ValidatedDiscoveryActivity } | { ok: false; reason: string } {
  if (!activity || typeof activity !== "object") {
    return { ok: false, reason: "activity is not an object" };
  }
  if (!activity.id || typeof activity.id !== "string") {
    return { ok: false, reason: "missing id" };
  }
  if (!activity.domain || typeof activity.domain !== "string") {
    return { ok: false, reason: "missing domain" };
  }
  if (!activity.interaction || !KNOWN_INTERACTIONS.has(activity.interaction)) {
    return { ok: false, reason: `unsupported interaction: ${String(activity.interaction)}` };
  }
  if (!activity.prompt || typeof activity.prompt !== "string") {
    return { ok: false, reason: "missing prompt" };
  }

  if (SURFACE_REQUIRED.has(activity.interaction)) {
    if (!activity.surface) {
      return { ok: false, reason: `${activity.interaction} requires a surface spec` };
    }
    if (!activity.surface.accessibility?.altText) {
      return { ok: false, reason: "surface accessibility.altText is required" };
    }
    if (activity.interaction === "geometry_workspace") {
      if (activity.surface.type !== "geometry_workspace") {
        return { ok: false, reason: "geometry activity must use geometry_workspace surface" };
      }
      if (!activity.surface.diagram || activity.surface.diagram.shapes.length === 0) {
        return { ok: false, reason: "geometry surface requires at least one shape" };
      }
    }
    if (
      (activity.interaction === "draw" || activity.interaction === "scratchpad") &&
      activity.surface.capture?.inkStrokes !== true
    ) {
      return {
        ok: false,
        reason: "draw/scratchpad surface must enable capture.inkStrokes",
      };
    }
  }

  if (
    activity.scoring &&
    !["exact", "rubric", "process", "hybrid"].includes(activity.scoring.mode)
  ) {
    return { ok: false, reason: `unsupported scoring mode: ${activity.scoring.mode}` };
  }

  return {
    ok: true,
    value: {
      id: activity.id,
      domain: activity.domain,
      skillCode: activity.skillCode,
      standardCode: activity.standardCode,
      difficulty: activity.difficulty ?? "medium",
      estimatedDifficulty: activity.estimatedDifficulty,
      interaction: activity.interaction,
      prompt: activity.prompt,
      tutorLine: activity.tutorLine,
      sceneEmoji: activity.sceneEmoji,
      choices: activity.choices,
      surface: activity.surface,
      feedbackMode: activity.feedbackMode,
      brainMeasures: activity.brainMeasures,
      scoring: activity.scoring,
    },
  };
}

export function validateDiscoveryActivities(
  activities: readonly DiscoveryActivityCandidate[],
): ActivityValidationResult {
  const validActivities: ValidatedDiscoveryActivity[] = [];
  const rejectedActivities: Array<{ id?: string; reason: string }> = [];

  for (const activity of activities) {
    const result = validateDiscoveryActivity(activity);
    if (result.ok) {
      validActivities.push(result.value);
    } else {
      rejectedActivities.push({ id: activity?.id, reason: result.reason });
    }
  }

  return { validActivities, rejectedActivities };
}
