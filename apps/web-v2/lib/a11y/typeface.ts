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
