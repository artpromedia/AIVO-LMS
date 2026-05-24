/**
 * Tutor surface response normalizer (Sprint 04).
 *
 * Converts a real, curriculum-backed ``SessionPlan`` (already produced
 * by ``planSession`` from ``@aivo/tutor-runtime``) into the Beat[]
 * shape the web/mobile lesson stage expects. The output is
 * deliberately *not* a demo or fallback: each beat is derived from a
 * real curriculum activity that came through the pedagogy /
 * level-transforms pipeline.
 *
 * Each activity is rendered as:
 *   • a short narration beat introducing the prompt,
 *   • followed by a beat whose ``interaction`` and ``surface`` fields
 *     reflect the activity type (multiple_choice, drag_drop, draw, …).
 *
 * The shape matches ``Beat`` in
 * ``apps/web/src/components/stage/types.ts``. Drift is prevented by
 * the gate test in this package.
 */

import type { Activity } from "@aivo/content-pack";
import type { SessionPlan } from "@aivo/tutor-runtime";

export type TutorBeatType =
  | "narration"
  | "interaction"
  | "demonstration"
  | "celebration"
  | "reflection";

export interface TutorBeatChoice {
  id: string;
  label: string;
  emoji?: string;
  isCorrect: boolean;
}

export interface TutorBeatDragItem {
  id: string;
  label: string;
  emoji?: string;
  targetZone: string;
}

export interface TutorBeatDragZone {
  id: string;
  label: string;
}

export interface TutorBeatSurface {
  id: string;
  type: string;
  prompt: string;
  accessibility: {
    altText: string;
    keyboardAlternative: boolean;
    reduceMotionSafe: boolean;
  };
  scratchpad?: { enabled: boolean };
  capture?: Record<string, unknown>;
}

export interface TutorBeat {
  id: string;
  type: TutorBeatType;
  narration?: string;
  tutorState: "idle" | "speaking" | "encouraging" | "thinking" | "celebrating" | "pointing";
  visuals: Array<{
    id: string;
    type: "card";
    content: string;
    emoji?: string;
    animation?: "fade_in" | "slide_in" | "bounce";
    position: { x: number; y: number };
  }>;
  interaction?: {
    type: "multiple_choice" | "drag_drop" | "voice" | "draw" | "tap" | "match" | "scratchpad";
    prompt?: string;
    choices?: TutorBeatChoice[];
    dragItems?: TutorBeatDragItem[];
    dragZones?: TutorBeatDragZone[];
    correctAnswer?: string;
  };
  surface?: TutorBeatSurface;
}

export interface TutorSurfaceBeatsResponse {
  beats: TutorBeat[];
  meta: {
    tutorId: string;
    learnerId: string;
    functioningLevel: string;
    activityCount: number;
    rationale: Array<{ skillId: string; reason: string }>;
  };
}

const ACTIVITY_TO_SURFACE_TYPE: Record<Activity["type"], string> = {
  narration: "choice_grid",
  multiple_choice: "choice_grid",
  drag_drop: "drag_manipulative",
  voice: "voice_response",
  draw: "scratchpad",
  tap: "choice_grid",
  match: "drag_manipulative",
  video: "video",
  audio: "audio",
};

function buildSurface(activity: Activity, suffix: string): TutorBeatSurface {
  const surfaceType = ACTIVITY_TO_SURFACE_TYPE[activity.type] ?? "choice_grid";
  const surface: TutorBeatSurface = {
    id: `${activity.id}-${suffix}`,
    type: surfaceType,
    prompt: activity.prompt,
    accessibility: {
      altText: activity.prompt,
      keyboardAlternative: true,
      reduceMotionSafe: activity.adaptations?.reducedMotion === true,
    },
  };
  if (surfaceType === "scratchpad") {
    surface.scratchpad = { enabled: true };
    surface.capture = { captureInk: true, captureFinalAnswerField: true };
  }
  return surface;
}

function buildChoices(activity: Activity): TutorBeatChoice[] | undefined {
  if (!activity.choices || activity.choices.length === 0) return undefined;
  return activity.choices.map((c) => ({
    id: c.id,
    label: c.label,
    isCorrect: c.correct === true,
  }));
}

function buildDragItems(activity: Activity): TutorBeatDragItem[] | undefined {
  if (!activity.choices || activity.choices.length === 0) return undefined;
  return activity.choices.map((c) => ({
    id: c.id,
    label: c.label,
    targetZone: c.value ?? c.id,
  }));
}

function buildDragZones(activity: Activity): TutorBeatDragZone[] | undefined {
  if (!activity.choices || activity.choices.length === 0) return undefined;
  const seen = new Map<string, TutorBeatDragZone>();
  for (const c of activity.choices) {
    const zoneId = c.value ?? c.id;
    if (seen.has(zoneId)) continue;
    seen.set(zoneId, { id: zoneId, label: c.label });
  }
  return Array.from(seen.values());
}

function buildInteractionBeat(activity: Activity): TutorBeat {
  const interactionType: TutorBeat["interaction"] = (() => {
    switch (activity.type) {
      case "multiple_choice":
        return {
          type: "multiple_choice",
          prompt: activity.prompt,
          choices: buildChoices(activity),
        };
      case "drag_drop":
        return {
          type: "drag_drop",
          prompt: activity.prompt,
          dragItems: buildDragItems(activity),
          dragZones: buildDragZones(activity),
        };
      case "voice":
        return {
          type: "voice",
          prompt: activity.prompt,
          correctAnswer: activity.expectedAnswer,
        };
      case "draw":
        return { type: "scratchpad", prompt: activity.prompt };
      case "tap":
        return { type: "tap", prompt: activity.prompt, choices: buildChoices(activity) };
      case "match":
        return { type: "match", prompt: activity.prompt, choices: buildChoices(activity) };
      case "narration":
      case "video":
      case "audio":
      default:
        return undefined;
    }
  })();

  return {
    id: `${activity.id}-task`,
    type: interactionType ? "interaction" : "narration",
    tutorState: "encouraging",
    narration: activity.prompt,
    visuals: [
      {
        id: `${activity.id}-card`,
        type: "card",
        content: activity.title,
        animation: "fade_in",
        position: { x: 50, y: 20 },
      },
    ],
    interaction: interactionType,
    surface: buildSurface(activity, "surface"),
  };
}

function buildIntroBeat(activity: Activity, index: number): TutorBeat {
  return {
    id: `${activity.id}-intro`,
    type: "narration",
    tutorState: "speaking",
    narration: `${activity.title}.`,
    visuals: [
      {
        id: `${activity.id}-intro-card`,
        type: "card",
        content: activity.title,
        animation: index === 0 ? "bounce" : "fade_in",
        position: { x: 50, y: 30 },
      },
    ],
  };
}

function buildClosingBeat(plan: SessionPlan): TutorBeat {
  return {
    id: "session-close",
    type: "celebration",
    tutorState: "celebrating",
    narration: "Great work — session complete!",
    visuals: [
      {
        id: "close-card",
        type: "card",
        content: "Session complete",
        animation: "bounce",
        position: { x: 50, y: 30 },
      },
    ],
  };
}

/**
 * Convert a real curriculum-driven ``SessionPlan`` into the Beat[]
 * the web/mobile lesson stage consumes. Throws if the plan has zero
 * activities — callers should treat that as a hard failure (no demo
 * fallback).
 */
export function buildTutorSurfaceBeats(plan: SessionPlan): TutorSurfaceBeatsResponse {
  if (!plan || !Array.isArray(plan.activities) || plan.activities.length === 0) {
    throw new Error("buildTutorSurfaceBeats: session plan must include at least one activity");
  }
  const beats: TutorBeat[] = [];
  plan.activities.forEach((activity, index) => {
    beats.push(buildIntroBeat(activity, index));
    beats.push(buildInteractionBeat(activity));
  });
  beats.push(buildClosingBeat(plan));
  return {
    beats,
    meta: {
      tutorId: plan.tutorId,
      learnerId: plan.learnerId,
      functioningLevel: plan.functioningLevel,
      activityCount: plan.activities.length,
      rationale: plan.rationale,
    },
  };
}
