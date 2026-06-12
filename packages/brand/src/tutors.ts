/**
 * Canonical tutor catalogue + age tiers.
 *
 * Lives in its own module (not the barrel) so theme derivation
 * (tutor-themes.ts) can import it without a circular evaluation through
 * index.ts. Everything here is still re-exported from "@aivo/brand".
 */
export type AgeTier = "EARLY" | "MIDDLE" | "HIGH";

export const ALL_TIERS = ["EARLY", "MIDDLE", "HIGH"] as const;
/**
 * Canonical tutor catalogue.
 *
 * Current policy: every domain tutor supports agentic guidance across the
 * EARLY, MIDDLE, and HIGH tiers, covering PRE-K through grade 12.
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
    avatarReduced: "/images/tutors/nova-reduced.svg",
  },
  sage: {
    name: "Sage",
    domain: "English Language Arts",
    icon: "📚",
    color: "#10B981",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/sage.png",
    avatarReduced: "/images/tutors/sage-reduced.svg",
  },
  spark: {
    name: "Spark",
    domain: "Science",
    icon: "🔬",
    color: "#F59E0B",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/spark.png",
    avatarReduced: "/images/tutors/spark-reduced.svg",
  },
  chrono: {
    name: "Chrono",
    domain: "History & Social Studies",
    icon: "🏛️",
    color: "#6366F1",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/chrono.png",
    avatarReduced: "/images/tutors/chrono-reduced.svg",
  },
  pixel: {
    name: "Pixel",
    domain: "Coding & Computational Thinking",
    icon: "💻",
    color: "#06B6D4",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/pixel.png",
    avatarReduced: "/images/tutors/pixel-reduced.svg",
  },
  echo: {
    name: "Echo",
    domain: "Speech & Language Therapy",
    icon: "🗣️",
    color: "#EC4899",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/echo.png",
    avatarReduced: "/images/tutors/echo-reduced.svg",
  },
  harmony: {
    name: "Harmony",
    domain: "Social-Emotional Learning",
    icon: "💜",
    color: "#8B5CF6",
    tier: "core",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/harmony.png",
    avatarReduced: "/images/tutors/harmony-reduced.svg",
  },
  atlas: {
    name: "Atlas",
    domain: "Geography & World Cultures",
    icon: "🌍",
    color: "#14B8A6",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/atlas.png",
    avatarReduced: "/images/tutors/atlas-reduced.svg",
  },
  cadence: {
    name: "Cadence",
    domain: "Music & Rhythm",
    icon: "🎵",
    color: "#D946EF",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/cadence.png",
    avatarReduced: "/images/tutors/cadence-reduced.svg",
  },
  vigor: {
    name: "Vigor",
    domain: "Physical Education & Health",
    icon: "🏃",
    color: "#22C55E",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/vigor.png",
    avatarReduced: "/images/tutors/vigor-reduced.svg",
    tracks: ["fitness", "health", "dape"] as const,
    subDomains: { dape: "Adapted Physical Education (DAPE)" },
  },
  lingua: {
    name: "Lingua",
    domain: "World Languages",
    icon: "🌐",
    color: "#0EA5E9",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/lingua.png",
    avatarReduced: "/images/tutors/lingua-reduced.svg",
  },
  forge: {
    name: "Forge",
    domain: "STEM & Engineering",
    icon: "⚙️",
    color: "#EF4444",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/forge.png",
    avatarReduced: "/images/tutors/forge-reduced.svg",
  },
  compass: {
    name: "Compass",
    domain: "Life Skills & Executive Function",
    icon: "🧭",
    color: "#F97316",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/compass.png",
    avatarReduced: "/images/tutors/compass-reduced.svg",
  },
  muse: {
    name: "Muse",
    domain: "Creative Arts & Expression",
    icon: "🎨",
    color: "#A855F7",
    tier: "expansion",
    tiers: ALL_TIERS,
    avatar: "/images/tutors/muse.png",
    avatarReduced: "/images/tutors/muse-reduced.svg",
  },
} as const;

export type TutorKey = keyof typeof TUTORS;
