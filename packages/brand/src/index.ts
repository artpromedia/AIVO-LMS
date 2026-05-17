export const BRAND = {
  name: "AIVO",
  tagline: "AI-Powered Adaptive Learning for Every Child",
  colors: {
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
    text: "#292F3D",
    textSecondary: "#6B7280",
    border: "#E2E4E9",
    visualMath: "#E91E63",
    visualReading: "#0DA2E7",
    visualScience: "#21C45D",
    visualSel: "#FFB700",
    visualSurfaceSoft: "#F6F7F9",
  },
  fonts: {
    heading: "'Fredoka', sans-serif",
    body: "'Nunito', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  radii: {
    sm: "0.375rem",
    md: "0.5rem",
    lg: "0.75rem",
    xl: "1rem",
    full: "9999px",
  },
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    xxl: "3rem",
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
  nova:    { name: "Nova",    domain: "Mathematics",                      icon: "🔢", color: "#7C3AED", tier: "core",      tiers: ALL_TIERS,       avatar: "/images/tutors/nova.png" },
  sage:    { name: "Sage",    domain: "English Language Arts",            icon: "📚", color: "#10B981", tier: "core",      tiers: ALL_TIERS,       avatar: "/images/tutors/sage.png" },
  spark:   { name: "Spark",   domain: "Science",                          icon: "🔬", color: "#F59E0B", tier: "core",      tiers: ALL_TIERS,       avatar: "/images/tutors/spark.png" },
  chrono:  { name: "Chrono",  domain: "History & Social Studies",         icon: "🏛️", color: "#6366F1", tier: "core",      tiers: SECONDARY_TIERS, avatar: "/images/tutors/chrono.png" },
  pixel:   { name: "Pixel",   domain: "Coding & Computational Thinking",  icon: "💻", color: "#06B6D4", tier: "core",      tiers: ALL_TIERS,       avatar: "/images/tutors/pixel.png" },
  echo:    { name: "Echo",    domain: "Speech & Language Therapy",        icon: "🗣️", color: "#EC4899", tier: "core",      tiers: ALL_TIERS,       avatar: "/images/tutors/echo.png" },
  harmony: { name: "Harmony", domain: "Social-Emotional Learning",        icon: "💜", color: "#8B5CF6", tier: "core",      tiers: ALL_TIERS,       avatar: "/images/tutors/harmony.png" },
  atlas:   { name: "Atlas",   domain: "Geography & World Cultures",       icon: "🌍", color: "#14B8A6", tier: "expansion", tiers: ALL_TIERS,       avatar: "/images/tutors/atlas.png" },
  cadence: { name: "Cadence", domain: "Music & Rhythm",                   icon: "🎵", color: "#D946EF", tier: "expansion", tiers: ALL_TIERS,       avatar: "/images/tutors/cadence.png" },
  vigor:   { name: "Vigor",   domain: "Physical Education & Health",      icon: "🏃", color: "#22C55E", tier: "expansion", tiers: ALL_TIERS,       avatar: "/images/tutors/vigor.png", tracks: ["fitness", "health", "dape"] as const, subDomains: { dape: "Adapted Physical Education (DAPE)" } },
  lingua:  { name: "Lingua",  domain: "World Languages",                  icon: "🌐", color: "#0EA5E9", tier: "expansion", tiers: SECONDARY_TIERS, avatar: "/images/tutors/lingua.png" },
  forge:   { name: "Forge",   domain: "STEM & Engineering",               icon: "⚙️", color: "#EF4444", tier: "expansion", tiers: SECONDARY_TIERS, avatar: "/images/tutors/forge.png" },
  compass: { name: "Compass", domain: "Life Skills & Executive Function", icon: "🧭", color: "#F97316", tier: "expansion", tiers: SECONDARY_TIERS, avatar: "/images/tutors/compass.png" },
  muse:    { name: "Muse",    domain: "Creative Arts & Expression",       icon: "🎨", color: "#A855F7", tier: "expansion", tiers: ALL_TIERS,       avatar: "/images/tutors/muse.png" },
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
): Array<[keyof typeof TUTORS, typeof TUTORS[keyof typeof TUTORS]]> {
  const entries = Object.entries(TUTORS) as Array<
    [keyof typeof TUTORS, typeof TUTORS[keyof typeof TUTORS]]
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
