/**
 * Sprint 3 (subject/tutor UX) — the single source of truth for which learner
 * activity surfaces each client can actually render.
 *
 * The web (`@aivo/learner-surfaces` SurfaceRouter/SurfaceHost) and the mobile
 * app (`apps/mobile` MobileSurfaceRenderer) historically drifted: web declared
 * 15 `LearnerSurfaceType`s but only implemented 10, while mobile reimplemented
 * its own narrower vocabulary and silently downgraded a few surfaces to a blank
 * scratchpad. This registry pins, per surface type, the real support level on
 * each platform so:
 *   - the experience gate (`pnpm ux:matrix`) reports surface coverage from data
 *     instead of guessing, and
 *   - both clients can decide between a real renderer and an explicit,
 *     telemetry-emitting "not available here yet" fallback (never a silent
 *     downgrade).
 *
 * Keep this in lock-step with the renderers. The `Record<LearnerSurfaceType, …>`
 * typing makes TypeScript fail the build if a new surface type is added without
 * a capability entry.
 */
import type { LearnerSurfaceType } from "../types.js";

/**
 * - `full`     — a dedicated interactive renderer ships on this platform.
 * - `fallback` — no dedicated renderer; the client shows a labelled fallback
 *                (web: SurfaceHost unsupported panel; mobile: scratchpad /
 *                "open on the web app" card) and emits `unsupported_surface`.
 * - `none`     — not handled at all yet (treated like `fallback` by clients,
 *                tracked separately so the gate can flag it as a hard gap).
 */
export type SurfaceSupportLevel = "full" | "fallback" | "none";

export interface SurfaceCapability {
  web: SurfaceSupportLevel;
  mobile: SurfaceSupportLevel;
  /** Primary subject/tutor this surface serves (for the gate's report). */
  note: string;
}

/** Every learner surface type, with its real per-platform support level. */
export const SURFACE_CAPABILITY_REGISTRY: Record<LearnerSurfaceType, SurfaceCapability> = {
  choice_grid: { web: "full", mobile: "full", note: "universal — multiple choice" },
  scratchpad: { web: "full", mobile: "full", note: "universal — ink workspace" },
  math_expression: { web: "full", mobile: "full", note: "math (nova)" },
  number_line: { web: "full", mobile: "full", note: "math (nova)" },
  coding_sandbox: { web: "full", mobile: "full", note: "coding (pixel)" },
  art_canvas: { web: "full", mobile: "full", note: "art (muse)" },
  // Sprint 7 — spoken response ships full on web and mobile (mobile records via
  // useSpeechInput → ai-svc transcribe).
  voice_response: { web: "full", mobile: "full", note: "speech (echo) / languages (lingua)" },
  video: { web: "full", mobile: "none", note: "media-rich lessons (all)" },
  audio: { web: "full", mobile: "none", note: "media-rich lessons (all)" },
  geometry_workspace: { web: "full", mobile: "fallback", note: "math/geometry (nova)" },
  // Sprint 4 — reading annotation ships on both web and mobile.
  reading_annotation: { web: "full", mobile: "full", note: "reading/ELA (sage)" },
  // Sprint 5 — graph / manipulatives / multi-step ship full on web; mobile uses
  // the labelled fallback (+ telemetry) until bespoke RN renderers land.
  graph: { web: "full", mobile: "fallback", note: "math/science (nova/spark)" },
  drag_manipulative: {
    web: "full",
    mobile: "fallback",
    note: "math manipulatives (nova) / exec-fn (compass)",
  },
  multi_step_workspace: { web: "full", mobile: "fallback", note: "math/science (nova/spark)" },
  // Sprint 6 — science diagram labelling ships full on web; mobile uses the
  // labelled fallback until a bespoke RN renderer lands.
  science_diagram: { web: "full", mobile: "fallback", note: "science (spark)" },
};

/** Runtime list of every surface type (keys of the registry). */
export const ALL_SURFACE_TYPES = Object.keys(SURFACE_CAPABILITY_REGISTRY) as LearnerSurfaceType[];

/** Support level for a surface on a given platform. */
export function surfaceSupport(
  type: LearnerSurfaceType,
  platform: "web" | "mobile",
): SurfaceSupportLevel {
  return SURFACE_CAPABILITY_REGISTRY[type][platform];
}

/** True when the platform should render a labelled fallback (not a real UI). */
export function isSurfaceFallback(type: LearnerSurfaceType, platform: "web" | "mobile"): boolean {
  return surfaceSupport(type, platform) !== "full";
}
