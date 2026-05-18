// AIVO brand tokens. Single source of truth for colors, gradients,
// typography, spacing, radius, and elevation tokens consumed by web,
// marketing, and mobile.
//
// Sprint 01 ownership. Apps consume via `@aivo/brand`. Do not introduce
// app-local copies of these values — they will drift.

export const COLORS = {
  primary: "#3B82F6",
  primaryLight: "#DBEAFE",
  primaryDark: "#1D4ED8",
  secondary: "#FB7185",
  accent: "#FBBF24",

  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
  info: "#3B82F6",

  background: "#F9FAFB",
  surface: "#FFFFFF",
  surfaceHover: "#F3F4F6",
  surfaceMuted: "#E5E7EB",

  text: "#111827",
  textSecondary: "#374151",
  textMuted: "#6B7280",
  textOnPrimary: "#FFFFFF",

  border: "#D1D5DB",
  borderStrong: "#9CA3AF",
  borderSubtle: "#E5E7EB",

  visualMath: "#FB7185",
  visualReading: "#3B82F6",
  visualScience: "#34D399",
  visualSel: "#FBBF24",
  visualSurfaceSoft: "#F3F4F6",

  focusRing: "#3B82F6",
  overlay: "rgba(15, 23, 42, 0.45)",
} as const;

export type ColorToken = keyof typeof COLORS;

export const GRADIENTS = {
  brand: `linear-gradient(135deg, ${COLORS.primary} 0%, #A78BFA 100%)`,
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
  sm: "8px",
  md: "12px",
  lg: "16px",
  xl: "24px",
  xxl: "32px",
  full: "9999px",
} as const;

export const SHADOWS = {
  none: "none",
  sm: "0 2px 6px rgba(59, 130, 246, 0.08)",
  md: "0 6px 12px rgba(59, 130, 246, 0.10)",
  lg: "0 10px 22px rgba(59, 130, 246, 0.12)",
  xl: "0 16px 30px rgba(59, 130, 246, 0.14)",
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
