/**
 * Central mapping from the `@aivo/item-bank` `ItemSurfaceType` enum to
 * the concrete component the SurfaceRouter renders. This is the single
 * source of truth consumed by both `SurfaceRouter` (item-based) and
 * `SurfaceHost` (spec-based) so the two cannot drift.
 *
 * The item-bank enum and the runtime `LearnerSurfaceSpec.type` enum are
 * different by design: authors think in terms of question formats
 * (multiple_choice, short_response, ink_canvas), while the runtime
 * thinks in terms of interactive surfaces (choice_grid, math_expression,
 * scratchpad). The map below normalises every authored surface type to a
 * runtime surface so any well-formed item from the bank renders without
 * hitting an "unsupported" fallback.
 */
import type { LearnerSurfaceType } from "../types.js";

/** Mirrors `packages/item-bank/src/schema.ts:ItemSurfaceType`. */
export type ItemAuthoredSurfaceType =
  | "multiple_choice"
  | "short_response"
  | "fill_in_blank"
  | "drag_drop"
  | "geometry"
  | "math_expression"
  | "coding_sandbox"
  | "art_canvas"
  | "voice_response"
  | "ink_canvas"
  | "scratchpad";

/**
 * Every surface type the item-based `SurfaceRouter` can route, in
 * addition to the authored ones above. `choice_grid`, `geometry_workspace`,
 * `number_line`, `video`, and `audio` are runtime-internal aliases the
 * lesson player emits directly from `GeneratedLessonPlan` beats.
 */
export type RouterSurfaceType =
  | ItemAuthoredSurfaceType
  | "choice_grid"
  | "geometry_workspace"
  | "number_line"
  | "video"
  | "audio";

/**
 * Maps authored item-bank surface types onto the runtime
 * `LearnerSurfaceSpec.type` enum. Pure data, safe to import in tests.
 */
export const ITEM_TYPE_TO_RUNTIME: Record<ItemAuthoredSurfaceType, LearnerSurfaceType> = {
  multiple_choice: "choice_grid",
  short_response: "math_expression",
  fill_in_blank: "math_expression",
  drag_drop: "choice_grid",
  geometry: "geometry_workspace",
  math_expression: "math_expression",
  coding_sandbox: "coding_sandbox",
  art_canvas: "art_canvas",
  voice_response: "voice_response",
  ink_canvas: "scratchpad",
  scratchpad: "scratchpad",
};

/**
 * Every router surface type the host can render. Used by `SurfaceHost`
 * to decide whether to dispatch to `SurfaceRouter` or render the
 * unsupported-surface fallback.
 */
export const SUPPORTED_RUNTIME_TYPES: ReadonlySet<LearnerSurfaceType> = new Set<LearnerSurfaceType>([
  "choice_grid",
  "scratchpad",
  "geometry_workspace",
  "math_expression",
  "coding_sandbox",
  "art_canvas",
  "voice_response",
  "video",
  "audio",
  "number_line",
]);

/** Normalise either an authored or runtime surface type to a runtime one. */
export function toRuntimeSurfaceType(t: RouterSurfaceType): LearnerSurfaceType {
  if (t in ITEM_TYPE_TO_RUNTIME) {
    return ITEM_TYPE_TO_RUNTIME[t as ItemAuthoredSurfaceType];
  }
  return t as LearnerSurfaceType;
}
