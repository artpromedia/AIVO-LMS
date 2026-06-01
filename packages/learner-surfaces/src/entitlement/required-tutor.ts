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
// A surface may be owned by more than one tutor (e.g. spoken responses are
// delivered by both the Speech tutor and the World-Languages tutor). The value
// is normalised to a list by `requiredTutorsForSurface`; entitlement passes if
// the learner holds ANY of the listed tutors.
const SURFACE_TO_REQUIRED_TUTOR: Partial<
  Record<LearnerSurfaceType, SurfaceTutorKey | readonly SurfaceTutorKey[]>
> = {
  coding_sandbox: "pixel",
  // Sprint 1 fix: the art canvas belongs to the art/creative-arts tutor (muse),
  // not the music tutor (cadence) it was previously mis-mapped to.
  art_canvas: "muse",
  // Sprint 1 fix: spoken responses power Speech therapy (echo) first and World
  // Languages (lingua) second; echo was previously omitted, locking speech
  // learners out of their core activity.
  voice_response: ["echo", "lingua"],
};

/** Every tutor that unlocks a surface (empty when the surface is free). */
export function requiredTutorsForSurface(type: LearnerSurfaceType): readonly SurfaceTutorKey[] {
  const v = SURFACE_TO_REQUIRED_TUTOR[type];
  if (!v) return [];
  return Array.isArray(v) ? v : [v as SurfaceTutorKey];
}

/** Primary tutor for a surface (used for the "needs the X add-on" copy). */
export function requiredTutorForSurface(type: LearnerSurfaceType): SurfaceTutorKey | undefined {
  return requiredTutorsForSurface(type)[0];
}

export function isPremiumSurface(type: LearnerSurfaceType): boolean {
  return SURFACE_TO_REQUIRED_TUTOR[type] !== undefined;
}

/**
 * Decide whether a surface should render its interactive UI.
 *
 * Returns `true` when the surface is free or when `entitledTutors`
 * contains ANY of the required tutor keys. Returns `true` (default-allow)
 * when `entitledTutors` is `undefined` — the caller hasn't provided
 * entitlement data yet.
 */
export function isSurfaceEntitled(
  type: LearnerSurfaceType,
  entitledTutors?: ReadonlySet<SurfaceTutorKey> | readonly SurfaceTutorKey[],
): boolean {
  const required = requiredTutorsForSurface(type);
  if (required.length === 0) return true;
  if (entitledTutors === undefined) return true;
  const has = Array.isArray(entitledTutors)
    ? (k: SurfaceTutorKey) => entitledTutors.includes(k)
    : (k: SurfaceTutorKey) => (entitledTutors as ReadonlySet<SurfaceTutorKey>).has(k);
  return required.some(has);
}
