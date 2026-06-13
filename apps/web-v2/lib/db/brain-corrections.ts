/**
 * Sprint C-05 — the correction loop: fold parent corrections into the web
 * brain-profile state.
 *
 * Pure functions, no persistence. The fold mirrors the brain-svc approve
 * route (`services/brain-svc/src/brain_svc/routes/brain.py`, prefix rules
 * for `mastery_levels.*` / `accommodation.*` / `tutor.*`) so the two stores
 * stay shape-compatible for C-12, and adds the web-only pieces:
 *
 *   - `accommodation.<slug>` also syncs the matching `supportDefaults` flag
 *     for the five core supports (the lesson pipeline reads BOTH
 *     `activeAccommodations` and `supportDefaults` — see
 *     `buildAccommodationSnapshotFrom` in `repos.ts`).
 *   - `readingComfort` / `mathComfort` map to the qualitative comfort fields.
 *   - Therapist-pinned supports (`xaiExplanation.accommodationDecisionsDetailed`
 *     entries with `removable === false`, parity with
 *     `clone_pipeline.py::_fold_collaborator_insights`) are enforced HERE,
 *     server-side: a forged "turn it off" modification throws
 *     `BrainCorrectionLockedError` — the disabled UI row is a courtesy, not
 *     the defense.
 *
 * Every modification is recorded into `xaiExplanation.parentModifications`
 * with its original + parent values (unknown fields are recorded but not
 * folded — same as the Python route), so the applied record is auditable.
 */
import type { ComfortLevel, LearnerBrainProfileState, ParentModification } from "@/lib/db/types";

/** Core support slugs ↔ `supportDefaults` flags (single source of truth —
 *  mirrors `buildAccommodationSnapshotFrom` in `repos.ts`). */
export const SUPPORT_DEFAULT_BY_SLUG = {
  extended_time: "extendedTime",
  read_aloud: "readAloud",
  speech_to_text: "speechToText",
  visual_schedules: "visualSchedules",
  sensory_breaks: "sensoryBreaks",
} as const satisfies Record<string, keyof LearnerBrainProfileState["supportDefaults"]>;

export type CoreSupportSlug = keyof typeof SUPPORT_DEFAULT_BY_SLUG;

const COMFORT_VALUES: readonly ComfortLevel[] = ["new", "growing", "confident", "advanced"];

/** Thrown when a modification tries to remove a therapist-pinned support.
 *  Surfaces to callers (server actions) as a non-retryable validation
 *  failure — the parent is told to talk to the therapist instead. */
export class BrainCorrectionLockedError extends Error {
  readonly lockedFields: string[];

  constructor(lockedFields: string[]) {
    super(
      `Corrections rejected: ${lockedFields.join(", ")} ${
        lockedFields.length === 1 ? "is" : "are"
      } pinned by a clinician and cannot be removed by the parent`,
    );
    this.name = "BrainCorrectionLockedError";
    this.lockedFields = lockedFields;
  }
}

/**
 * Accommodation slugs the parent may not turn OFF: any
 * `accommodationDecisionsDetailed` entry with `removable === false`
 * (therapist-raised — see the collaborator fold in
 * `lib/learner/brain-profile.ts` and `clone_pipeline.py:187-203`).
 */
export function lockedAccommodationSlugs(state: LearnerBrainProfileState): Set<string> {
  const locked = new Set<string>();
  for (const d of state.xaiExplanation.accommodationDecisionsDetailed ?? []) {
    if (d.removable === false) locked.add(d.accommodation);
  }
  return locked;
}

/**
 * Fields among `modifications` that forge an unlock: `accommodation.<slug>`
 * with `parentValue === false` where `<slug>` is therapist-pinned. Turning a
 * pinned support ON (or leaving it on) is always allowed — the lock pins it
 * on, it does not freeze the row.
 */
export function findLockedViolations(
  state: LearnerBrainProfileState,
  modifications: ParentModification[],
): string[] {
  const locked = lockedAccommodationSlugs(state);
  if (locked.size === 0) return [];
  const violations: string[] = [];
  for (const mod of modifications) {
    if (!mod.field.startsWith("accommodation.")) continue;
    const slug = mod.field.slice("accommodation.".length);
    if (mod.parentValue === false && locked.has(slug)) violations.push(mod.field);
  }
  return violations;
}

/** Server-side therapist-lock enforcement. Throws on a forged unlock. */
export function assertCorrectionsAllowed(
  state: LearnerBrainProfileState,
  modifications: ParentModification[],
): void {
  const violations = findLockedViolations(state, modifications);
  if (violations.length > 0) throw new BrainCorrectionLockedError(violations);
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/**
 * The CURRENT value of a correctable field, read from server-side state.
 * The review-screen action uses this for `originalValue` so the applied
 * record never trusts a client-supplied "original" (the Python route takes
 * the client's word for `original_value`; web-v2 can do better because the
 * action and the store share a process).
 */
export function originalValueForField(
  state: LearnerBrainProfileState,
  field: string,
): number | string | boolean | null {
  if (field === "readingComfort") return state.readingComfort;
  if (field === "mathComfort") return state.mathComfort;
  if (field.startsWith("accommodation.")) {
    const slug = field.slice("accommodation.".length);
    if (slug in SUPPORT_DEFAULT_BY_SLUG) {
      return state.supportDefaults[SUPPORT_DEFAULT_BY_SLUG[slug as CoreSupportSlug]];
    }
    return state.activeAccommodations.includes(slug);
  }
  if (field.startsWith("tutor.")) {
    return state.activeTutors.includes(field.slice("tutor.".length));
  }
  if (field.startsWith("mastery_levels.")) {
    return state.masteryLevels[field.slice("mastery_levels.".length)] ?? null;
  }
  return null;
}

/**
 * Apply `modifications` to `state` and append the applied record to
 * `xaiExplanation.parentModifications`. Returns a NEW state object (the
 * in-memory store shares references — never mutate in place). Clears any
 * `parentCorrectionsDraft` (the review that staged it is now applied).
 *
 * Fold rules (Python parity + web comfort mapping — see module doc):
 *   mastery_levels.<domain>      numeric → masteryLevels[domain], clamped [0,1];
 *                                ignored when the domain is unknown (Python parity)
 *   accommodation.<slug>         boolean → activeAccommodations membership and,
 *                                for the five core slugs, the supportDefaults flag
 *   tutor.<key>                  boolean → activeTutors membership
 *   readingComfort / mathComfort ComfortLevel string → the comfort field
 *
 * Throws `BrainCorrectionLockedError` before touching anything when a
 * modification forges a therapist-pinned unlock.
 */
export function foldParentModifications(
  state: LearnerBrainProfileState,
  modifications: ParentModification[],
  appliedAtIso: string,
): LearnerBrainProfileState {
  assertCorrectionsAllowed(state, modifications);

  const masteryLevels = { ...state.masteryLevels };
  let activeAccommodations = [...state.activeAccommodations];
  let activeTutors = [...state.activeTutors];
  const supportDefaults = { ...state.supportDefaults };
  let readingComfort = state.readingComfort;
  let mathComfort = state.mathComfort;

  const applied: ParentModification[] = [];
  for (const mod of modifications) {
    applied.push({
      field: mod.field,
      originalValue: mod.originalValue,
      parentValue: mod.parentValue,
      parentNote: mod.parentNote,
      modifiedAt: mod.modifiedAt || appliedAtIso,
    });

    if (mod.field.startsWith("mastery_levels.")) {
      const domain = mod.field.slice("mastery_levels.".length);
      if (domain in masteryLevels && typeof mod.parentValue === "number") {
        masteryLevels[domain] = clamp01(mod.parentValue);
      }
    } else if (mod.field.startsWith("accommodation.")) {
      const slug = mod.field.slice("accommodation.".length);
      if (mod.parentValue === true && !activeAccommodations.includes(slug)) {
        activeAccommodations = [...activeAccommodations, slug];
      } else if (mod.parentValue === false && activeAccommodations.includes(slug)) {
        activeAccommodations = activeAccommodations.filter((a) => a !== slug);
      }
      if (slug in SUPPORT_DEFAULT_BY_SLUG && typeof mod.parentValue === "boolean") {
        supportDefaults[SUPPORT_DEFAULT_BY_SLUG[slug as CoreSupportSlug]] = mod.parentValue;
      }
    } else if (mod.field.startsWith("tutor.")) {
      const key = mod.field.slice("tutor.".length);
      if (mod.parentValue === true && !activeTutors.includes(key)) {
        activeTutors = [...activeTutors, key];
      } else if (mod.parentValue === false && activeTutors.includes(key)) {
        activeTutors = activeTutors.filter((t) => t !== key);
      }
    } else if (mod.field === "readingComfort" || mod.field === "mathComfort") {
      const value = mod.parentValue;
      if (typeof value === "string" && (COMFORT_VALUES as readonly string[]).includes(value)) {
        if (mod.field === "readingComfort") readingComfort = value as ComfortLevel;
        else mathComfort = value as ComfortLevel;
      }
    }
    // Unknown fields: recorded above, not folded — parity with the Python
    // route, which also records every modification but only folds known
    // prefixes.
  }

  const next: LearnerBrainProfileState = {
    ...state,
    masteryLevels,
    activeAccommodations,
    activeTutors,
    supportDefaults,
    readingComfort,
    mathComfort,
    xaiExplanation: {
      ...state.xaiExplanation,
      parentModifications: [...(state.xaiExplanation.parentModifications ?? []), ...applied],
    },
  };
  delete next.parentCorrectionsDraft;
  return next;
}
