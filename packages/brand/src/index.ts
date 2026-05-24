export * from "./tokens.js";
export * from "./assets.js";
export * from "./role-themes.js";
export * from "./playful-calm.js";
export * from "./inclusive-warm.js";
export * from "./subjects.js";

// Re-imports for the `BRAND` summary object below. The `export *` lines
// above expose the same symbols to consumers; these locals only exist so
// `BRAND` can stay in lock-step with `tokens.ts` without duplicating
// values.
import { COLORS, TYPOGRAPHY, RADII, SPACING } from "./tokens.js";

/**
 * Marketing-facing brand summary. Mirrors `SEMANTIC` / `COLORS` in
 * `./tokens.ts` (the canonical source of truth) so consumers like
 * marketing meta tags and press materials don't drift. App UI code
 * should consume `SEMANTIC` from `./tokens.ts`, not this object.
 */
export const BRAND = {
  name: "AIVO",
  tagline: "A calmer, more personal way to learn",
  colors: {
    primary: COLORS.primary,
    primaryLight: COLORS.primaryLight,
    primaryDark: COLORS.primaryDark,
    secondary: COLORS.secondary,
    accent: COLORS.accent,
    success: COLORS.success,
    warning: COLORS.warning,
    error: COLORS.error,
    info: COLORS.info,
    background: COLORS.background,
    surface: COLORS.surface,
    surfaceHover: COLORS.surfaceHover,
    text: COLORS.text,
    textSecondary: COLORS.textSecondary,
    border: COLORS.border,
    visualMath: COLORS.visualMath,
    visualReading: COLORS.visualReading,
    visualScience: COLORS.visualScience,
    visualSel: COLORS.visualSel,
    visualSurfaceSoft: COLORS.visualSurfaceSoft,
  },
  fonts: TYPOGRAPHY.fontFamilies,
  radii: {
    sm: RADII.sm,
    md: RADII.md,
    lg: RADII.lg,
    xl: RADII.xl,
    full: RADII.full,
  },
  spacing: {
    xs: SPACING.xs,
    sm: SPACING.sm,
    md: SPACING.md,
    lg: SPACING.lg,
    xl: SPACING.xl,
    xxl: SPACING.xxl,
  },
  logos: {
    dark: "/images/aivo-logo-dark.png",
    purple: "/images/aivo-logo-purple.png",
    white: "/images/aivo-logo-white.png",
    favicon: "/images/favicon-192.png",
  },
} as const;

/**
 * Age tier identifier — mirrors the canonical definition in
 * `@aivo/learner-ui` (`packages/learner-ui/src/tokens/age-tiers.ts`).
 * Re-declared here so the brand package stays dependency-free.
 *   EARLY  = PK – 5  ("Soft Meadow")
 *   MIDDLE = 6 – 8   ("Study Treehouse")
 *   HIGH   = 9 – 12  ("Focus Studio")
 */
export type AgeTier = "EARLY" | "MIDDLE" | "HIGH";

const ALL_TIERS = ["EARLY", "MIDDLE", "HIGH"] as const;
const SECONDARY_TIERS = ["MIDDLE", "HIGH"] as const;

/**
 * Canonical tutor catalogue.
 *
 * Each tutor declares the age tiers in which it is a curricular fit:
 *   • Nova / Sage / Spark / Pixel / Echo / Harmony /
 *     Atlas / Cadence / Vigor / Muse  → all tiers
 *   • Chrono (formal Social Studies)   → MIDDLE + HIGH only
 *   • Lingua (World Languages)         → MIDDLE + HIGH only
 *   • Forge (STEM & Engineering)       → MIDDLE + HIGH only
 *   • Compass (Life Skills / Exec Fn.) → MIDDLE + HIGH only
 *
 * Use `getTutorsForTier()` (below) to filter the catalogue for a learner's
 * age tier. The full catalogue is still exported as-is for admin / billing
 * surfaces that intentionally list every tutor regardless of grade.
 */
export const TUTORS = {
  nova: {
    name: "Nova",
    domain: "Mathematics",
    icon: "🔢",
    color: "#7C3AED",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/nova.png",
  },
  sage: {
    name: "Sage",
    domain: "English Language Arts",
    icon: "📚",
    color: "#10B981",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/sage.png",
  },
  spark: {
    name: "Spark",
    domain: "Science",
    icon: "🔬",
    color: "#F59E0B",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/spark.png",
  },
  chrono: {
    name: "Chrono",
    domain: "History & Social Studies",
    icon: "🏛️",
    color: "#6366F1",
    tier: "core",
    tiers: SECONDARY_TIERS,
    avatar: "/images/tutors/chrono.png",
  },
  pixel: {
    name: "Pixel",
    domain: "Coding & Computational Thinking",
    icon: "💻",
    color: "#06B6D4",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/pixel.png",
  },
  echo: {
    name: "Echo",
    domain: "Speech & Language Therapy",
    icon: "🗣️",
    color: "#EC4899",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/echo.png",
  },
  harmony: {
    name: "Harmony",
    domain: "Social-Emotional Learning",
    icon: "💜",
    color: "#8B5CF6",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/harmony.png",
  },
  atlas: {
    name: "Atlas",
    domain: "Geography & World Cultures",
    icon: "🌍",
    color: "#14B8A6",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/atlas.png",
  },
  cadence: {
    name: "Cadence",
    domain: "Music & Rhythm",
    icon: "🎵",
    color: "#D946EF",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/cadence.png",
  },
  vigor: {
    name: "Vigor",
    domain: "Physical Education & Health",
    icon: "🏃",
    color: "#22C55E",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/vigor.png",
    tracks: ["fitness", "health", "dape"] as const,
    subDomains: { dape: "Adapted Physical Education (DAPE)" },
  },
  lingua: {
    name: "Lingua",
    domain: "World Languages",
    icon: "🌐",
    color: "#0EA5E9",
    tier: "expansion",
    tiers: SECONDARY_TIERS,
    avatar: "/images/tutors/lingua.png",
  },
  forge: {
    name: "Forge",
    domain: "STEM & Engineering",
    icon: "⚙️",
    color: "#EF4444",
    tier: "expansion",
    tiers: SECONDARY_TIERS,
    avatar: "/images/tutors/forge.png",
  },
  compass: {
    name: "Compass",
    domain: "Life Skills & Executive Function",
    icon: "🧭",
    color: "#F97316",
    tier: "expansion",
    tiers: SECONDARY_TIERS,
    avatar: "/images/tutors/compass.png",
  },
  muse: {
    name: "Muse",
    domain: "Creative Arts & Expression",
    icon: "🎨",
    color: "#A855F7",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/muse.png",
  },
} as const;

/**
 * Filter the catalogue down to tutors that fit the given age tier.
 * Returns `[key, tutor]` entries in the catalogue's natural order.
 *
 * If `tier` is `null` / `undefined` (e.g. learner grade not yet loaded),
 * the full catalogue is returned — never hide tutors just because we
 * haven't finished loading a profile.
 */
export function getTutorsForTier(
  tier: AgeTier | null | undefined,
): Array<[keyof typeof TUTORS, (typeof TUTORS)[keyof typeof TUTORS]]> {
  const entries = Object.entries(TUTORS) as Array<
    [keyof typeof TUTORS, (typeof TUTORS)[keyof typeof TUTORS]]
  >;
  if (!tier) return entries;
  return entries.filter(([, t]) => (t.tiers as readonly AgeTier[]).includes(tier));
}

export const FUNCTIONING_LEVELS = {
  STANDARD: {
    label: "Standard",
    description: "Full curriculum with grade-level content",
    assessmentMode: "STANDARD",
  },
  SUPPORTED: {
    label: "Supported",
    description: "Modified curriculum with scaffolding and accommodations",
    assessmentMode: "MODIFIED",
  },
  LOW_VERBAL: {
    label: "Low Verbal",
    description: "Picture-based interactions with reduced text",
    assessmentMode: "PICTURE_BASED",
  },
  NON_VERBAL: {
    label: "Non-Verbal",
    description: "Switch scanning and partner-assisted access",
    assessmentMode: "SWITCH_SCAN",
  },
  PRE_SYMBOLIC: {
    label: "Pre-Symbolic",
    description: "Cause-effect activities with observational assessment",
    assessmentMode: "OBSERVATIONAL",
  },
} as const;

export const ROLES = {
  PARENT: { label: "Parent / Guardian", canManageLearners: true, internal: false },
  LEARNER: { label: "Learner", canManageLearners: false, internal: false },
  TEACHER: { label: "Teacher", canManageLearners: false, internal: false },
  CAREGIVER: { label: "Caregiver", canManageLearners: false, internal: false },
  THERAPIST: { label: "Therapist", canManageLearners: false, internal: false },
  DISTRICT_ADMIN: { label: "District Admin", canManageLearners: false, internal: false },
  PLATFORM_ADMIN: { label: "Platform Admin", canManageLearners: false, internal: true },
  SALES: { label: "Sales", canManageLearners: false, internal: true },
  MARKETING: { label: "Marketing", canManageLearners: false, internal: true },
  CUSTOMER_CARE: { label: "Customer Care", canManageLearners: false, internal: true },
  SUPPORT: { label: "Support", canManageLearners: false, internal: true },
  FINANCE: { label: "Finance", canManageLearners: false, internal: true },
  DEVOPS: { label: "DevOps", canManageLearners: false, internal: true },
} as const;

export type TutorKey = keyof typeof TUTORS;
export type FunctioningLevel = keyof typeof FUNCTIONING_LEVELS;
export type UserRole = keyof typeof ROLES;

/**
 * Brain-clone visualization palette, keyed by functioning level.
 *
 * The brain-clone canvas (Sprint 7+ `LearnerBrainProfileState.visualIdentity`)
 * paints these hex values directly — they are deliberately concrete data
 * shipped to the client renderer, not Tailwind classes. Centralizing them here
 * keeps `apps/web-v2` from re-declaring the literal palette and gives future
 * sensory-mode reskins (calm / focus / sensory-friendly) a single source of
 * truth to swap.
 *
 * Each entry provides:
 *   • `primary`     — dominant hue painted on the brain silhouette
 *   • `secondaries` — two complementary hues for accents / particles
 */
export const BRAIN_VISUAL_IDENTITY_PALETTE = {
  STANDARD: {
    primary: "#E63946",
    secondaries: ["#F1FAEE", "#A8DADC"] as const,
  },
  SUPPORTED: {
    primary: "#6A4C93",
    secondaries: ["#B392D8", "#F1FAEE"] as const,
  },
  LOW_VERBAL: {
    primary: "#1D3557",
    secondaries: ["#457B9D", "#A8DADC"] as const,
  },
  NON_VERBAL: {
    primary: "#457B9D",
    secondaries: ["#A8DADC", "#F1FAEE"] as const,
  },
  PRE_SYMBOLIC: {
    primary: "#A8DADC",
    secondaries: ["#E6F0F2", "#F1FAEE"] as const,
  },
} as const satisfies Record<
  FunctioningLevel,
  { primary: string; secondaries: readonly [string, string] }
>;

/**
 * Marketing-site accent palette.
 *
 * `apps/marketing` decorates principle cards, tutor avatars, blog
 * categories, audience badges and legal-page headers with concrete
 * accent hex values. Several of those are composed at runtime with an
 * 8-bit alpha suffix (`` `${color}15` ``) for tinted backgrounds, so they
 * must remain plain hex strings rather than CSS variables.
 *
 * The `no-restricted-syntax` lint rule in `eslint.config.mjs` forbids
 * hex literals inside `apps/marketing`, so the literal values live here
 * in `@aivo/brand` (the documented source of truth) — mirroring how
 * `BRAIN_VISUAL_IDENTITY_PALETTE` centralizes the brain-clone palette
 * for `apps/web-v2`.
 */
export const MARKETING_ACCENTS = {
  purple: "#7C3AED",
  purpleDeep: "#6D28D9",
  violet: "#8B5CF6",
  orchid: "#A855F7",
  indigo: "#6366F1",
  blue: "#2563EB",
  blueDeep: "#1E40AF",
  cyan: "#06B6D4",
  cyanDeep: "#0891B2",
  teal: "#14B8A6",
  tealDeep: "#0D9488",
  emerald: "#10B981",
  emeraldDeep: "#059669",
  green: "#22C55E",
  amber: "#F59E0B",
  amberDeep: "#D97706",
  amberDark: "#92400E",
  orange: "#EA580C",
  pink: "#EC4899",
  pinkDeep: "#DB2777",
  fuchsia: "#D946EF",
  red: "#EF4444",
  slate: "#0F172A",
} as const;

export type MarketingAccent = keyof typeof MARKETING_ACCENTS;
