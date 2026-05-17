// AIVO brand tokens. Single source of truth for colors, gradients,
// typography, spacing, radius, and elevation tokens consumed by web,
// marketing, and mobile.
//
// Sprint 01 ownership. Apps consume via `@aivo/brand`. Do not introduce
// app-local copies of these values — they will drift.

export const COLORS = {
  primary: "#7C3AED",
  primaryLight: "#EDE3FE",
  primaryDark: "#5B21B6",
  secondary: "#0DA2E7",
  accent: "#FFB700",

  success: "#21C45D",
  warning: "#FFB700",
  error: "#E91E63",
  info: "#0DA2E7",

  background: "#FAFAFA",
  surface: "#FFFFFF",
  surfaceHover: "#F6F7F9",
  surfaceMuted: "#F0F2F5",

  text: "#292F3D",
  textSecondary: "#6B7280",
  textMuted: "#9CA3AF",
  textOnPrimary: "#FFFFFF",

  border: "#E2E4E9",
  borderStrong: "#CBD5E1",
  borderSubtle: "#F1F3F6",

  visualMath: "#E91E63",
  visualReading: "#0DA2E7",
  visualScience: "#21C45D",
  visualSel: "#FFB700",
  visualSurfaceSoft: "#F6F7F9",

  focusRing: "#7C3AED",
  overlay: "rgba(15, 23, 42, 0.45)",
} as const;

export type ColorToken = keyof typeof COLORS;

export const GRADIENTS = {
  brand: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
  brandSoft: `linear-gradient(135deg, ${COLORS.primaryLight} 0%, #FFFFFF 100%)`,
  hero: `linear-gradient(180deg, #FAF5FF 0%, #FFFFFF 60%)`,
  celebrate: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent} 100%)`,
  reading: `linear-gradient(135deg, ${COLORS.visualReading} 0%, #1E40AF 100%)`,
  math: `linear-gradient(135deg, ${COLORS.visualMath} 0%, #9D174D 100%)`,
  science: `linear-gradient(135deg, ${COLORS.visualScience} 0%, #166534 100%)`,
  sel: `linear-gradient(135deg, ${COLORS.visualSel} 0%, #B45309 100%)`,
} as const;

export const TYPOGRAPHY = {
  fontFamilies: {
    heading: "'Fredoka', sans-serif",
    body: "'Nunito', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  fontSizes: {
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
    "6xl": "3.75rem",
  },
  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  lineHeights: {
    tight: 1.15,
    snug: 1.3,
    normal: 1.5,
    relaxed: 1.7,
  },
} as const;

export const SPACING = {
  xxs: "0.125rem",
  xs: "0.25rem",
  sm: "0.5rem",
  md: "1rem",
  lg: "1.5rem",
  xl: "2rem",
  xxl: "3rem",
  xxxl: "4rem",
} as const;

export const RADII = {
  none: "0",
  sm: "0.375rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  xxl: "1.5rem",
  full: "9999px",
} as const;

export const SHADOWS = {
  none: "none",
  sm: "0 1px 2px 0 rgba(15, 23, 42, 0.06)",
  md: "0 2px 8px 0 rgba(15, 23, 42, 0.08)",
  lg: "0 8px 24px 0 rgba(15, 23, 42, 0.12)",
  xl: "0 20px 48px 0 rgba(15, 23, 42, 0.18)",
  focus: `0 0 0 3px ${COLORS.primaryLight}`,
} as const;

export const TOKENS = {
  colors: COLORS,
  gradients: GRADIENTS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  radii: RADII,
  shadows: SHADOWS,
} as const;

export type BrandTokens = typeof TOKENS;
