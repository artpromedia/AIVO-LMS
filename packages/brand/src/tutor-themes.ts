/**
 * Sprint 15 — per-tutor lesson accent themes.
 *
 * Derives a compliant three-token treatment from each tutor's registry
 * color, verified through the white-label contrast guard at build/test
 * time:
 *
 *   accent     — decorative/non-text accent (progress fill, chips,
 *                borders). Darkened from TUTORS[*].color until it clears
 *                WCAG 1.4.11 non-text contrast (≥ 3.0:1) against BOTH
 *                light surfaces.
 *   accentSoft — a near-white tint of the accent used as a wash behind
 *                accentInk text.
 *   accentInk  — a deep shade usable AS TEXT: ≥ 4.5:1 on the light card,
 *                the light page, and the accentSoft wash.
 *
 * Raw registry hues stay UNTOUCHED in TUTORS (mascots, marketing); only
 * the lesson chrome consumes these derived tokens, always via
 * `tutorThemeCSSVars` — hex never reaches the app layer.
 */
import { TUTORS, type TutorKey } from "./tutors.js";
import {
  CONTRAST_AA_NORMAL,
  CONTRAST_NON_TEXT,
  GUARD_SURFACES,
  contrastRatio,
  hexToRgb,
} from "./contrast-guard.js";

export interface TutorTheme {
  accent: string;
  accentSoft: string;
  accentInk: string;
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Mix `hex` toward `target` by `amount` (0..1). */
function mix(hex: string, target: [number, number, number], amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) throw new Error(`tutor-themes: bad hex ${hex}`);
  return rgbToHex([
    rgb[0] + (target[0] - rgb[0]) * amount,
    rgb[1] + (target[1] - rgb[1]) * amount,
    rgb[2] + (target[2] - rgb[2]) * amount,
  ]);
}

const BLACK: [number, number, number] = [0, 0, 0];
const WHITE: [number, number, number] = [255, 255, 255];

/** Darken `hex` in small steps until `passes` holds (bounded search). */
function darkenUntil(hex: string, passes: (candidate: string) => boolean): string {
  let candidate = hex;
  for (let step = 0; step <= 40; step += 1) {
    candidate = mix(hex, BLACK, step / 40);
    if (passes(candidate)) return candidate;
  }
  return rgbToHex(BLACK);
}

const onLightSurfaces = (hex: string, threshold: number): boolean =>
  (contrastRatio(hex, GUARD_SURFACES.lightCard) ?? 0) >= threshold &&
  (contrastRatio(hex, GUARD_SURFACES.lightPage) ?? 0) >= threshold;

function deriveTheme(base: string): TutorTheme {
  const accent = darkenUntil(base, (c) => onLightSurfaces(c, CONTRAST_NON_TEXT));
  const accentSoft = mix(base, WHITE, 0.88);
  const accentInk = darkenUntil(
    base,
    (c) =>
      onLightSurfaces(c, CONTRAST_AA_NORMAL) &&
      (contrastRatio(c, accentSoft) ?? 0) >= CONTRAST_AA_NORMAL,
  );
  return { accent, accentSoft, accentInk };
}

export const TUTOR_THEMES: Record<TutorKey, TutorTheme> = Object.fromEntries(
  (Object.keys(TUTORS) as TutorKey[]).map((slug) => [slug, deriveTheme(TUTORS[slug].color)]),
) as Record<TutorKey, TutorTheme>;

/**
 * CSS custom properties for one tutor's lesson treatment. The
 * accessibility shell applies these alongside the sensory vars — and
 * suppresses them entirely in high-contrast mode (sensory supremacy).
 */
export function tutorThemeCSSVars(slug: TutorKey): Record<string, string> {
  const theme = TUTOR_THEMES[slug];
  return {
    "--tutor-accent": theme.accent,
    "--tutor-accent-soft": theme.accentSoft,
    "--tutor-accent-ink": theme.accentInk,
  };
}
