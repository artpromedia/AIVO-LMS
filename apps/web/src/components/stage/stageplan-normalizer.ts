/**
 * Normalises generated StagePlan payloads into the legacy `Beat[]`
 * shape consumed by `useSessionFlow`. Resolves `surfaceId` references
 * against the StagePlan-level `surfaces` dictionary so downstream
 * code can treat every surface-driven beat as if it had inline
 * `beat.surface`.
 *
 * If the payload is missing critical fields the normaliser returns
 * `valid: false` with an explanation — the caller renders a
 * recoverable error instead of silently swapping in demo content.
 */
import type { LearnerSurfaceSpec } from "@aivo/learner-surfaces";
import type { Beat } from "./types";
import { attachSurfacesToBeats } from "./surface-normalizer";

export type NormalizationSource = "generated" | "legacy_normalized";

export interface NormalizedStagePlan {
  valid: boolean;
  reason?: string;
  source: NormalizationSource;
  title: string;
  objective: string;
  beats: Beat[];
  surfaces: Record<string, LearnerSurfaceSpec>;
}

export interface RawStagePlan {
  id?: string;
  title?: string;
  objective?: string;
  beats?: any[];
  surfaces?: Record<string, LearnerSurfaceSpec>;
  // Legacy "lesson content" payload that pre-dates the StagePlan schema.
  contentMarkdown?: string;
  lessonText?: string;
}

function looksLikeBeat(value: any): value is Beat {
  return value && typeof value === "object" && typeof value.id === "string" && typeof value.type === "string";
}

export function normalizeStagePlan(raw: RawStagePlan | null | undefined): NormalizedStagePlan {
  if (!raw || typeof raw !== "object") {
    return {
      valid: false,
      reason: "missing_payload",
      source: "generated",
      title: "",
      objective: "",
      beats: [],
      surfaces: {},
    };
  }

  if (Array.isArray(raw.beats) && raw.beats.length > 0 && raw.beats.every(looksLikeBeat)) {
    const surfaces = raw.surfaces ?? {};
    const beats = attachSurfacesToBeats(raw.beats as Beat[], surfaces);
    return {
      valid: true,
      source: "generated",
      title: raw.title ?? "",
      objective: raw.objective ?? "",
      beats,
      surfaces,
    };
  }

  // Legacy lesson text fallback — wrap into a single narration beat
  // so existing tutors don't crash on cached pre-StagePlan content.
  const legacyText = raw.contentMarkdown ?? raw.lessonText;
  if (typeof legacyText === "string" && legacyText.trim().length > 0) {
    return {
      valid: true,
      source: "legacy_normalized",
      title: raw.title ?? "Lesson",
      objective: raw.objective ?? "",
      beats: [
        {
          id: "narration-legacy",
          type: "narration",
          tutorState: "speaking",
          narration: legacyText.trim().slice(0, 1200),
          visuals: [],
        },
      ],
      surfaces: {},
    };
  }

  return {
    valid: false,
    reason: "no_beats_or_lesson_text",
    source: "generated",
    title: raw.title ?? "",
    objective: raw.objective ?? "",
    beats: [],
    surfaces: raw.surfaces ?? {},
  };
}
