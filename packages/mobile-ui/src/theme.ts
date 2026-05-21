import { INCLUSIVE_WARM_PALETTE } from "@aivo/brand";

/**
 * Mobile theme rebased on `INCLUSIVE_WARM_PALETTE` (Sprint 3).
 *
 * Every color flows through the brand package so React Native screens stay
 * in lockstep with web (`apps/web*` `--aivo-sensory-*` CSS vars). The legacy
 * `BRAND.colors.*` palette has been superseded; do not reintroduce it.
 *
 * `navy` / `shadowColor` are React-Native-specific chrome (status-bar dark
 * surface, drop-shadow source) sourced from the palette's `darkSurface`
 * (intentionally stable across sensory modes).
 */
const P = INCLUSIVE_WARM_PALETTE;

export const theme = {
  colors: {
    primary: P.primary,
    primaryLight: P.primarySoft,
    primaryDark: P.primaryDeep,
    secondary: P.accent,
    accent: P.accentDeep,
    success: P.success,
    warning: P.warning,
    error: P.danger,
    info: P.info,
    navy: P.darkSurface,
    background: P.bgPage,
    card: P.bgRaised,
    surface: P.bgRaised,
    surfaceSoft: P.bgCard,
    text: P.ink,
    textSecondary: P.inkMuted,
    border: P.border,
    visualMath: P.visualMath,
    visualReading: P.visualReading,
    visualScience: P.visualScience,
    visualSel: P.visualSel,
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    xxl: 24,
    full: 9999,
  },
  shadows: {
    sm: {
      shadowColor: P.darkSurface,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 2,
      elevation: 1,
    },
    md: {
      shadowColor: P.darkSurface,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    lg: {
      shadowColor: P.darkSurface,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 5,
    },
  },
  fonts: {
    heading: "Nunito-ExtraBold",
    headingSemiBold: "Nunito-SemiBold",
    body: "Nunito-Regular",
    bodyBold: "Nunito-Bold",
    mono: "JetBrainsMono-Regular",
  },
  /**
   * Tablet-aware breakpoints — kept here so every package and screen
   * agrees on the same compact/medium/expanded boundaries. Match
   * Material 3 / iPadOS size classes.
   */
  breakpoints: {
    compact: 0,
    medium: 600,
    expanded: 840,
    xlarge: 1200,
  },
  /**
   * Recommended content-width caps so cards and forms don't stretch
   * edge-to-edge on tablet hardware.
   */
  contentMaxWidth: {
    auth: 520,
    reading: 720,
    dashboard: 1080,
    workspace: 1280,
  },
} as const;

export type SizeClass = "compact" | "medium" | "expanded";

export function classifySizeClass(width: number): SizeClass {
  if (width >= theme.breakpoints.expanded) return "expanded";
  if (width >= theme.breakpoints.medium) return "medium";
  return "compact";
}

export function isTabletWidth(width: number): boolean {
  return width >= theme.breakpoints.medium;
}
