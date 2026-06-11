/**
 * Age-tier theme tokens — aesthetic layer that sits alongside the FL
 * (functioning-level) and sensory token layers. The tier is derived from
 * the learner's gradeLevel; promoting a learner from 5th to 6th grade
 * automatically switches the EARLY palette to MIDDLE on next render.
 *
 * Three tiers, mapped to the showcase directions:
 *   EARLY  (PK / K / 1–5) — "Soft Meadow"     — picture-book daylight
 *   MIDDLE (6–8)          — "Study Treehouse" — Ghibli twilight discovery
 *   HIGH   (9–12)         — "Focus Studio"    — editorial calm
 *
 * All three sit on top of the AIVO brand (violet #7C3AED + gold #FFB700,
 * Fredoka display + Nunito body), so the brand identity is constant — only
 * the surrounding mood changes.
 */

import { TIER_THEME_DATA, type AgeTierId } from "@aivo/brand";

export type AgeTier = AgeTierId;

export interface TierTheme {
  id: AgeTier;
  name: string;
  /** Short tagline used by previews and analytics */
  tagline: string;
  /** i18n key under the `tier` namespace for the localised display name. */
  nameKey: string;
  /** i18n key under the `tier` namespace for the localised tagline. */
  taglineKey: string;
  colors: {
    /** Page background */
    bg: string;
    /** Default card / panel surface */
    surface: string;
    /** Secondary surface (slight contrast against `surface`) */
    surfaceAlt: string;
    /** Brand primary in this tier's context */
    primary: string;
    /** Soft tint of primary for hover/focus rings */
    primarySoft: string;
    /** Brand accent (gold) */
    accent: string;
    /** Default body text colour (warm dark, never pure black) */
    text: string;
    /** De-emphasised text */
    textSoft: string;
    /** Tier-specific atmospheric tone — sky in EARLY, night in MIDDLE,
     *  paper in HIGH. Used for hero gradients & ambient orbs. */
    sky: string;
    /** Warm character/illustration accent — peach, moss, or gold-soft */
    warm: string;
  };
  radius: { sm: number; md: number; lg: number; pill: number };
  /** CSS font-family stacks. Brand-aligned across all tiers. */
  font: { display: string; body: string };
  /** Multiplier on motion duration: 1.5 = slower (EARLY), 1 = MIDDLE, 0.8 = HIGH */
  paceMultiplier: number;
}

const FONT_DISPLAY = "'Fredoka', 'Nunito', system-ui, sans-serif";
const FONT_BODY = "'Nunito', 'Lexend', system-ui, sans-serif";

// Palettes come from the SINGLE token source (Sprint B7):
// packages/brand/tokens/modes/tier-themes.json → generated TS. Only the
// web font stacks are attached here — mobile-ui consumes the same data.
export const TIER_THEMES: Record<AgeTier, TierTheme> = Object.fromEntries(
  (Object.keys(TIER_THEME_DATA) as AgeTier[]).map((tier) => {
    const data = TIER_THEME_DATA[tier];
    return [
      tier,
      {
        id: data.id,
        name: data.name,
        tagline: data.tagline,
        nameKey: data.nameKey,
        taglineKey: data.taglineKey,
        colors: { ...data.colors },
        radius: { ...data.radius },
        font: { display: FONT_DISPLAY, body: FONT_BODY },
        paceMultiplier: data.paceMultiplier,
      } satisfies TierTheme,
    ];
  }),
) as Record<AgeTier, TierTheme>;

/**
 * Map a learner's gradeLevel string to its age tier.
 *
 * Accepts the values the platform actually stores: "PK", "K", "1".."12",
 * plus loose forms like "Kindergarten", "1st", "10th grade", or numbers.
 * Defaults to EARLY when the input is missing or unrecognised — the safest,
 * brightest, lowest-cognitive-load fallback.
 */
export function gradeToTier(gradeLevel: string | number | null | undefined): AgeTier {
  if (gradeLevel === null || gradeLevel === undefined) return "EARLY";
  const raw = String(gradeLevel).trim().toLowerCase();
  if (!raw) return "EARLY";

  // Pre-K and Kindergarten → EARLY
  if (raw === "pk" || raw === "pre-k" || raw === "prek" || raw.startsWith("pre")) return "EARLY";
  if (raw === "k" || raw.startsWith("kinder")) return "EARLY";

  // Pull the first integer out of the string ("10th", "grade 7", "7" → 10/7/7)
  const match = raw.match(/-?\d+/);
  if (!match) return "EARLY";
  const n = parseInt(match[0], 10);
  if (Number.isNaN(n)) return "EARLY";

  if (n <= 5) return "EARLY";
  if (n <= 8) return "MIDDLE";
  return "HIGH"; // 9–12 (and anything higher, e.g. transition programmes)
}

/** Convenience: get the full theme object for a grade. */
export function gradeToTheme(gradeLevel: string | number | null | undefined): TierTheme {
  return TIER_THEMES[gradeToTier(gradeLevel)];
}

/**
 * Render a TierTheme as the `--tier-*` CSS-variable map written to the DOM
 * by `TierThemeProvider`. Kept in this file so the variable contract is in
 * one place — components reading the variables and the provider writing
 * them stay in sync.
 */
export function tierThemeToCssVars(theme: TierTheme): Record<string, string> {
  return {
    "--tier-id": theme.id,
    "--tier-bg": theme.colors.bg,
    "--tier-surface": theme.colors.surface,
    "--tier-surface-alt": theme.colors.surfaceAlt,
    "--tier-primary": theme.colors.primary,
    "--tier-primary-soft": theme.colors.primarySoft,
    "--tier-accent": theme.colors.accent,
    "--tier-text": theme.colors.text,
    "--tier-text-soft": theme.colors.textSoft,
    "--tier-sky": theme.colors.sky,
    "--tier-warm": theme.colors.warm,
    "--tier-radius-sm": `${theme.radius.sm}px`,
    "--tier-radius-md": `${theme.radius.md}px`,
    "--tier-radius-lg": `${theme.radius.lg}px`,
    "--tier-radius-pill": `${theme.radius.pill}px`,
    "--tier-font-display": theme.font.display,
    "--tier-font-body": theme.font.body,
    "--tier-pace": String(theme.paceMultiplier),
  };
}
