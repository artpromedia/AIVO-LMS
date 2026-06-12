/**
 * Typeface preference.
 *
 * Two values today:
 *   - "standard" — Satoshi (display) / Inter (body)
 *   - "dyslexia" — Atkinson Hyperlegible / OpenDyslexic
 *
 * The choice is persisted to the `aivo.typeface` cookie and stamped on
 * `<html data-typeface>` server-side in `app/layout.tsx` so the very
 * first paint already shows the right family — no flash of wrong font
 * on navigation.
 */

export const TYPEFACES = ["standard", "dyslexia"] as const;
export type Typeface = (typeof TYPEFACES)[number];
export const TYPEFACE_COOKIE = "aivo.typeface";
export const TYPEFACE_DEFAULT: Typeface = "standard";

export function resolveTypeface(v: string | undefined | null): Typeface {
  return v === "dyslexia" ? "dyslexia" : "standard";
}

/* ----------------------------- reduced motion ---------------------------- */

export const REDUCED_MOTION_COOKIE = "aivo.reducedMotion";
export type ReducedMotion = "auto" | "reduce";
export const REDUCED_MOTION_DEFAULT: ReducedMotion = "auto";

export function resolveReducedMotion(v: string | undefined | null): ReducedMotion {
  return v === "reduce" ? "reduce" : "auto";
}

/* -------------------------------- spacing -------------------------------- */
/* Workspace density. Stamped on `<html data-spacing>`; consumed by the
 * `--lx-density` token in app/learner-experience.css. */

export const SPACINGS = ["compact", "comfortable", "spacious"] as const;
export type Spacing = (typeof SPACINGS)[number];
export const SPACING_COOKIE = "aivo.spacing";
export const SPACING_DEFAULT: Spacing = "comfortable";

export function resolveSpacing(v: string | undefined | null): Spacing {
  return v === "compact" || v === "spacious" ? v : "comfortable";
}

/* --------------------------------- sound --------------------------------- */
/* Audio level for celebration chimes / read-aloud cues. Stamped on
 * `<html data-sound>`; "off" must mean true silence everywhere. */

export const SOUND_LEVELS = ["off", "soft", "on"] as const;
export type SoundLevel = (typeof SOUND_LEVELS)[number];
export const SOUND_COOKIE = "aivo.sound";
export const SOUND_DEFAULT: SoundLevel = "soft";

export function resolveSound(v: string | undefined | null): SoundLevel {
  return v === "off" || v === "on" ? v : "soft";
}
