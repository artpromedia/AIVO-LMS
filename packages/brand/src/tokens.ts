// AIVO brand tokens. Single source of truth for colors, gradients,
// typography, spacing, radius, and elevation tokens consumed by web,
// marketing, and mobile.
//
// Layering (top-down — apps should consume `SEMANTIC`, never `COLORS`):
//
//   ┌────────────────────────────────────────────────────────────┐
//   │  Role-scoped register                                      │
//   │   ─ Learner surfaces        → @aivo/learner-ui playful-calm │
//   │   ─ Parent / Educator / B2B → packages/brand inclusive-warm │
//   └────────────────────────┬───────────────────────────────────┘
//                            │ both consume
//                            ▼
//   ┌────────────────────────────────────────────────────────────┐
//   │  SEMANTIC (this file) — surface / text / interactive /     │
//   │  feedback / border / subject / radius / space / type /     │
//   │  shadow / motion / breakpoint                              │
//   └────────────────────────┬───────────────────────────────────┘
//                            │
//                            ▼
//   ┌────────────────────────────────────────────────────────────┐
//   │  CORE — raw COLORS / GRADIENTS / TYPOGRAPHY / SPACING /    │
//   │  RADII / SHADOWS (kept for backwards compatibility; new    │
//   │  code should NOT import these directly).                   │
//   └────────────────────────────────────────────────────────────┘

// ============================================================================
// SEMANTIC LAYER  — this is what apps should consume.
// ============================================================================

/**
 * Semantic design tokens. App code should consume these (or the role-scoped
 * Tailwind utilities that resolve to them: `iw-*` for inclusive-warm,
 * `pc-*` for playful-calm). New code should NEVER inline hex values.
 *
 * The lint rule in `eslint.config.mjs` enforces this for `apps/web-v2` and
 * `apps/marketing` by failing on any `#rrggbb` / `#rgb` / `#rrggbbaa` literal
 * in `.ts` / `.tsx`.
 */
export const SEMANTIC = {
  color: {
    /** Backgrounds — page chrome, raised cards, overlays. */
    surface: {
      page: "#FAF7F4",
      card: "#FFFFFF",
      raised: "#FFFFFF",
      muted: "#F5F2EE",
      sunken: "#EFEAE2",
      inverse: "#1A1614",
      overlay: "rgba(26, 22, 20, 0.55)",
    },
    /** Ink — primary content and chrome text. */
    text: {
      primary: "#1F1B16",
      secondary: "#5E5750",
      muted: "#8A847C",
      inverse: "#FFFFFF",
      accent: "#7C3AED",
      link: "#6D28D9",
    },
    /**
     * Interactive — buttons, inputs, focus states. The primary color is
     * violet (`#7C3AED`) and matches the on-screen reality of every
     * shipping AIVO surface. The legacy `COLORS.primary` blue was an
     * undocumented contradiction with what users actually see and is no
     * longer the source of truth.
     */
    interactive: {
      primary: "#7C3AED",
      primaryHover: "#6D28D9",
      primaryActive: "#5B21B6",
      primaryFg: "#FFFFFF",
      primarySoft: "#EDE9FE",
      primarySoftFg: "#5B21B6",
      secondary: "#FFFFFF",
      secondaryFg: "#1F1B16",
      secondaryBorder: "#E0D9CF",
      ghostHover: "#F5F2EE",
      disabled: "#E0D9CF",
      disabledFg: "#8A847C",
    },
    /** Feedback — success / warning / danger / info, paired with soft surfaces. */
    feedback: {
      success: "#15803D",
      successSurface: "#DCFCE7",
      warning: "#B45309",
      warningSurface: "#FEF3C7",
      danger: "#B91C1C",
      dangerSurface: "#FEE2E2",
      info: "#1D4ED8",
      infoSurface: "#DBEAFE",
    },
    /** Borders & dividers. */
    border: {
      subtle: "#EDE7DF",
      default: "#E0D9CF",
      strong: "#C9C0B3",
      inverse: "rgba(255, 255, 255, 0.18)",
      focus: "#7C3AED",
    },
    /**
     * Subject / content-domain accents. Use for chips, progress rings,
     * illustrations, and category badges ONLY. Never use as the color of
     * a primary CTA — that would compete with `interactive.primary`.
     */
    subject: {
      math: "#E11D48",
      reading: "#2563EB",
      science: "#15803D",
      sel: "#D97706",
      art: "#A855F7",
      pe: "#22C55E",
    },
  },
  radius: {
    none: "0",
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.5rem",
    "2xl": "2rem",
    pill: "9999px",
  },
  /** 4-px base spacing scale. Multiples of 4 only. */
  space: {
    "0": "0",
    "1": "0.25rem",
    "2": "0.5rem",
    "3": "0.75rem",
    "4": "1rem",
    "5": "1.25rem",
    "6": "1.5rem",
    "8": "2rem",
    "10": "2.5rem",
    "12": "3rem",
    "16": "4rem",
    "20": "5rem",
    "24": "6rem",
    "32": "8rem",
  },
  type: {
    family: {
      /** Friendly stack — learner & parent-facing surfaces. */
      display: "'Fredoka', 'Inter', system-ui, sans-serif",
      body: "'Nunito', 'Inter', system-ui, sans-serif",
      /** Institutional stack — educator / admin / B2B marketing. */
      displayInstitutional: "'Inter', system-ui, sans-serif",
      bodyInstitutional: "'Inter', system-ui, sans-serif",
      mono: "'JetBrains Mono', ui-monospace, monospace",
    },
    /** Locked 10-step type ramp. */
    size: {
      "2xs": "0.6875rem",
      xs: "0.75rem",
      sm: "0.875rem",
      md: "1rem",
      lg: "1.125rem",
      xl: "1.375rem",
      "2xl": "1.75rem",
      "3xl": "2.25rem",
      "4xl": "3rem",
      "5xl": "3.75rem",
    },
    weight: { regular: 400, medium: 500, semibold: 600, bold: 700 },
    leading: { tight: 1.1, snug: 1.25, normal: 1.5, relaxed: 1.65 },
    tracking: { tight: "-0.02em", normal: "0", wide: "0.04em" },
  },
  shadow: {
    none: "none",
    sm: "0 1px 2px rgba(31, 27, 22, 0.06)",
    md: "0 4px 12px rgba(31, 27, 22, 0.08)",
    lg: "0 12px 28px rgba(31, 27, 22, 0.12)",
    xl: "0 24px 48px rgba(31, 27, 22, 0.16)",
    focus: "0 0 0 3px rgba(124, 58, 237, 0.35)",
  },
  motion: {
    duration: {
      instant: "60ms",
      fast: "120ms",
      base: "180ms",
      slow: "260ms",
      slower: "400ms",
    },
    ease: {
      standard: "cubic-bezier(0.2, 0, 0, 1)",
      decelerate: "cubic-bezier(0, 0, 0, 1)",
      accelerate: "cubic-bezier(0.3, 0, 1, 1)",
      emphasized: "cubic-bezier(0.2, 0, 0, 1.2)",
    },
  },
  breakpoint: {
    sm: "640px",
    md: "768px",
    lg: "1024px",
    xl: "1280px",
    "2xl": "1440px",
  },
  /**
   * Per-role registers — apps should switch the document register, not
   * mix tokens from two registers on the same surface.
   */
  register: {
    learner: "playful-calm",
    parent: "inclusive-warm",
    educator: "inclusive-warm",
    admin: "inclusive-warm",
    marketing: "inclusive-warm",
  },
} as const;

export type SemanticTokens = typeof SEMANTIC;

// ============================================================================
// LEGACY CORE TOKENS  — kept for backwards compatibility.
//
// New code should not import from here. Existing consumers continue to work
// while the rest of the codebase migrates to `SEMANTIC` and the role-scoped
// Tailwind utilities.
//
// `primary` is intentionally aligned with `SEMANTIC.color.interactive.primary`
// (violet `#7C3AED`) — the previous value `#3B82F6` was a documented but
// unused brand blue that did not match any shipping surface.
// ============================================================================

export const COLORS = {
  primary: "#7C3AED",
  primaryLight: "#EDE9FE",
  primaryDark: "#5B21B6",
  secondary: "#FB7185",
  accent: "#FBBF24",

  success: SEMANTIC.color.feedback.success,
  warning: SEMANTIC.color.feedback.warning,
  error: SEMANTIC.color.feedback.danger,
  info: SEMANTIC.color.feedback.info,

  background: SEMANTIC.color.surface.page,
  surface: SEMANTIC.color.surface.card,
  surfaceHover: SEMANTIC.color.surface.muted,
  surfaceMuted: SEMANTIC.color.surface.sunken,

  text: SEMANTIC.color.text.primary,
  textSecondary: SEMANTIC.color.text.secondary,
  textMuted: SEMANTIC.color.text.muted,
  textOnPrimary: SEMANTIC.color.text.inverse,

  border: SEMANTIC.color.border.default,
  borderStrong: SEMANTIC.color.border.strong,
  borderSubtle: SEMANTIC.color.border.subtle,

  visualMath: SEMANTIC.color.subject.math,
  visualReading: SEMANTIC.color.subject.reading,
  visualScience: SEMANTIC.color.subject.science,
  visualSel: SEMANTIC.color.subject.sel,
  visualSurfaceSoft: SEMANTIC.color.surface.muted,

  focusRing: SEMANTIC.color.border.focus,
  overlay: SEMANTIC.color.surface.overlay,
} as const;

export type ColorToken = keyof typeof COLORS;

export const GRADIENTS = {
  brand: `linear-gradient(135deg, ${COLORS.primary} 0%, #A78BFA 100%)`,
  brandSoft: `linear-gradient(135deg, ${COLORS.primaryLight} 0%, #FFFFFF 100%)`,
  hero: `linear-gradient(180deg, #FAF7F4 0%, #FFFFFF 60%)`,
  celebrate: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.accent} 100%)`,
  reading: `linear-gradient(135deg, ${COLORS.visualReading} 0%, #1E40AF 100%)`,
  math: `linear-gradient(135deg, ${COLORS.visualMath} 0%, #9D174D 100%)`,
  science: `linear-gradient(135deg, ${COLORS.visualScience} 0%, #166534 100%)`,
  sel: `linear-gradient(135deg, ${COLORS.visualSel} 0%, #B45309 100%)`,
} as const;

export const TYPOGRAPHY = {
  fontFamilies: {
    heading: SEMANTIC.type.family.display,
    body: SEMANTIC.type.family.body,
    mono: SEMANTIC.type.family.mono,
  },
  fontSizes: SEMANTIC.type.size,
  fontWeights: SEMANTIC.type.weight,
  lineHeights: {
    tight: SEMANTIC.type.leading.tight,
    snug: SEMANTIC.type.leading.snug,
    normal: SEMANTIC.type.leading.normal,
    relaxed: SEMANTIC.type.leading.relaxed,
  },
} as const;

export const SPACING = {
  xxs: SEMANTIC.space["1"],
  xs: SEMANTIC.space["1"],
  sm: SEMANTIC.space["2"],
  md: SEMANTIC.space["4"],
  lg: SEMANTIC.space["6"],
  xl: SEMANTIC.space["8"],
  xxl: SEMANTIC.space["12"],
  xxxl: SEMANTIC.space["16"],
} as const;

export const RADII = {
  none: SEMANTIC.radius.none,
  sm: SEMANTIC.radius.sm,
  md: SEMANTIC.radius.md,
  lg: SEMANTIC.radius.lg,
  xl: SEMANTIC.radius.xl,
  xxl: SEMANTIC.radius["2xl"],
  full: SEMANTIC.radius.pill,
} as const;

export const SHADOWS = {
  none: SEMANTIC.shadow.none,
  sm: SEMANTIC.shadow.sm,
  md: SEMANTIC.shadow.md,
  lg: SEMANTIC.shadow.lg,
  xl: SEMANTIC.shadow.xl,
  focus: SEMANTIC.shadow.focus,
} as const;

export const TOKENS = {
  semantic: SEMANTIC,
  colors: COLORS,
  gradients: GRADIENTS,
  typography: TYPOGRAPHY,
  spacing: SPACING,
  radii: RADII,
  shadows: SHADOWS,
} as const;

export type BrandTokens = typeof TOKENS;
