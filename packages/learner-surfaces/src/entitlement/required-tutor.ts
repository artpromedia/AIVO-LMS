/**
 * Sprint 8/9 — Premium-surface entitlement gating.
 *
 * Some surface types (e.g. `coding_sandbox`, `art_canvas`) are tied to
 * specific add-on tutors. The server already gates session-start at
 * `/api/learning/sessions`, but the renderer also accepts an
 * `entitledTutors` set so the UI can render a clear "locked" state if
 * a session ever surfaces a premium activity to a non-entitled learner
 * (e.g. mid-session downgrade, stale cache). When `entitledTutors` is
 * not supplied, the helper defaults to "entitled" — matching the
 * `useLearnerEntitlements` "default-allow while loading" convention so
 * the surface doesn't flash a locked panel during the entitlement
 * round-trip.
 */

import type { LearnerSurfaceType } from "../types.js";

export type SurfaceTutorKey =
  | "nova"
  | "sage"
  | "spark"
  | "chrono"
  | "pixel"
  | "echo"
  | "harmony"
  | "atlas"
  | "cadence"
  | "vigor"
  | "lingua"
  | "forge"
  | "compass"
  | "muse";

/**
 * Mapping is intentionally explicit (not derived) so it stays a
 * single-grep source-of-truth for product + billing review. Add new
 * premium surfaces here as they ship.
 */
const SURFACE_TO_REQUIRED_TUTOR: Partial<Record<LearnerSurfaceType, SurfaceTutorKey>> = {
  coding_sandbox: "pixel",
  art_canvas: "cadence",
  voice_response: "lingua",
};

export function requiredTutorForSurface(type: LearnerSurfaceType): SurfaceTutorKey | undefined {
  return SURFACE_TO_REQUIRED_TUTOR[type];
}

export function isPremiumSurface(type: LearnerSurfaceType): boolean {
  return SURFACE_TO_REQUIRED_TUTOR[type] !== undefined;
}

/**
 * Decide whether a surface should render its interactive UI.
 *
 * Returns `true` when the surface is free or when `entitledTutors`
 * contains the required tutor key. Returns `true` (default-allow) when
 * `entitledTutors` is `undefined` — the caller hasn't provided
 * entitlement data yet.
 */
export function isSurfaceEntitled(
  type: LearnerSurfaceType,
  entitledTutors?: ReadonlySet<SurfaceTutorKey> | readonly SurfaceTutorKey[],
): boolean {
  const required = SURFACE_TO_REQUIRED_TUTOR[type];
  if (!required) return true;
  if (entitledTutors === undefined) return true;
  if (Array.isArray(entitledTutors)) return entitledTutors.includes(required);
  return (entitledTutors as ReadonlySet<SurfaceTutorKey>).has(required);
}
