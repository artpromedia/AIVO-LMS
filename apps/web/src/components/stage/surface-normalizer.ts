/**
 * Helpers that resolve `Beat.surfaceId` references against a
 * StagePlan-level surfaces dictionary, and detect whether a beat is
 * surface-driven without crashing on legacy beats.
 */
import type { LearnerSurfaceSpec } from "@aivo/learner-surfaces";
import type { Beat, InteractionType } from "./types";

const SURFACE_INTERACTIONS: ReadonlySet<InteractionType> = new Set<InteractionType>([
  "draw",
  "scratchpad",
  "geometry_workspace",
  "math_expression",
]);

export function isSurfaceBeat(beat: Beat): boolean {
  if (beat.surface) return true;
  if (beat.surfaceId) return true;
  if (beat.interaction && SURFACE_INTERACTIONS.has(beat.interaction.type)) return true;
  return false;
}

export function resolveBeatSurface(
  beat: Beat,
  surfaces: Record<string, LearnerSurfaceSpec> | undefined,
): LearnerSurfaceSpec | undefined {
  if (beat.surface) return beat.surface;
  if (beat.surfaceId && surfaces) return surfaces[beat.surfaceId];
  return undefined;
}

export function attachSurfacesToBeats(
  beats: Beat[],
  surfaces: Record<string, LearnerSurfaceSpec> | undefined,
): Beat[] {
  if (!surfaces || Object.keys(surfaces).length === 0) return beats;
  return beats.map((beat) => {
    if (beat.surface || !beat.surfaceId) return beat;
    const surface = surfaces[beat.surfaceId];
    return surface ? { ...beat, surface } : beat;
  });
}
