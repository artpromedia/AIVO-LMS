// AIVO mobile color tokens — fully derived from the platform-wide
// "Inclusive Lab — Warm" palette in `@aivo/brand`.
//
// React Native cannot read CSS variables, so we resolve `standard`-mode
// values at module load and expose them through the legacy `colors.*`
// keys that 40+ existing screens already consume. Every value below
// must trace back to `INCLUSIVE_WARM_PALETTE` or `INCLUSIVE_WARM_BY_MODE`
// — no local hex constants. For values that need to flip in calm /
// high-contrast modes, components should read from `useSensoryPalette()`
// in `@/context/SensoryModeProvider` instead of these static tokens.

import {
  INCLUSIVE_WARM_PALETTE,
  INCLUSIVE_WARM_BY_MODE,
  INCLUSIVE_WARM_RADII,
} from "@aivo/brand";

const STANDARD = INCLUSIVE_WARM_BY_MODE.standard;
const P = INCLUSIVE_WARM_PALETTE;

export const colors = {
  // Brand primary (calm sky)
  primary: P.primary,
  primaryLight: P.primarySoft,
  primaryDark: P.primaryDeep,

  // Secondary — warm gold from the inclusive-warm sunshine ramp
  secondary: P.warm,

  // Accent — lavender
  accent: P.accent,

  // Semantic status — same hex across all sensory modes (status
  // meaning shouldn't shift with mode), sourced from the brand
  // package's named palette.
  success: P.success,
  warning: P.warning,
  error: P.danger,
  info: P.info,

  // Dark capsule chrome (bottom nav, modal overlay, brand wordmark
  // dark variant). Sourced from the brand palette so the recipe in
  // `INCLUSIVE_WARM_RECIPES.navCapsuleDark` and the RN equivalent
  // stay in lockstep.
  navy: P.darkSurface,

  // Surfaces
  background: STANDARD.bgPage,
  card: STANDARD.bgRaised,
  surface: STANDARD.bgCard,
  surfaceSoft: P.accentSoft,

  // Type
  text: STANDARD.ink,
  textSecondary: STANDARD.inkMuted,
  border: STANDARD.border,

  // Domain accents — sourced from the inclusive-warm anchor colors so
  // the tutor world icons stay coherent with the new look.
  visualMath: P.visualMath,
  visualReading: P.visualReading,
  visualScience: P.visualScience,
  visualSel: P.visualSel,

  white: P.primaryFg,
  black: STANDARD.ink,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Inclusive-warm leans on much rounder corners — 1.5rem / 2rem / 2.5rem.
// Existing screens that use `radius.md` for chips keep their look, but
// `xl`/`xxl` now produce the soft-card silhouette from the mockup.
export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  xxl: 32,
  hero: 40,
  full: 9999,
};

// Re-exports for screens that want the full mode-resolved palette
// without depending on @aivo/brand directly.
export { INCLUSIVE_WARM_BY_MODE, INCLUSIVE_WARM_PALETTE, INCLUSIVE_WARM_RADII };
