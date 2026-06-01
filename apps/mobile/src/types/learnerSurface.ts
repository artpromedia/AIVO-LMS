/**
 * Learner surface specs — minimal mobile-side mirror of
 * packages/learner-surfaces. Sprints 03–05 expand these.
 */

export type LearnerSurfaceKind =
  | "geometry_workspace"
  | "scratchpad"
  | "number_line"
  | "fraction_bar"
  | "chart"
  | "text_response"
  | "coding_sandbox"
  | "art_canvas"
  // Sprint 4 — reading comprehension annotation (sage / ELA).
  | "reading_annotation"
  // Sprint 7 — spoken response (echo / lingua).
  | "voice_response";

export interface LearnerSurfaceSpec {
  kind: LearnerSurfaceKind;
  /** Free-form, surface-specific config bag. */
  config?: Record<string, unknown>;
}
