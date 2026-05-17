/**
 * Learner study-route manifest. Single source of truth for the CI
 * regression crawler. Every entry must:
 *   - render real content from a real backend (mocked in the crawler).
 *   - contain none of the BANNED_PHRASES.
 *
 * If a route appears here, the surface is considered "shipped". Add a
 * route only after you've replaced any stub/coming-soon/placeholder UI.
 */

export interface LearnerStudyRoute {
  /** Pretty name for failure diagnostics. */
  name: string;
  /** URL path under apps/web. */
  path: string;
  /**
   * Strings the surface MUST contain. Empty means the only contract is
   * that no banned phrase appears.
   */
  mustContain?: string[];
}

export const QUEST_WORLD_KEYS = [
  "nova_number_galaxy",
  "sage_story_kingdom",
  "spark_science_lab",
  "chrono_time_tower",
  "pixel_code_forge",
] as const;

export const TUTOR_KEYS = [
  "nova",
  "sage",
  "spark",
  "chrono",
  "pixel",
  "echo",
  "harmony",
  "atlas",
  "cadence",
  "vigor",
  "lingua",
  "forge",
  "compass",
  "muse",
] as const;

export const LEARNER_STUDY_ROUTES: readonly LearnerStudyRoute[] = [
  { name: "Quest Worlds list", path: "/dashboard/learner/quests" },
  ...QUEST_WORLD_KEYS.map<LearnerStudyRoute>((key) => ({
    name: `Quest world: ${key}`,
    path: `/dashboard/learner/quests/${key}`,
  })),
  ...TUTOR_KEYS.slice(0, 5).map<LearnerStudyRoute>((key) => ({
    name: `Tutor: ${key}`,
    path: `/dashboard/learner/tutors/${key}`,
  })),
];

/**
 * Substrings that, if rendered, count as a regression to a stub /
 * coming-soon / mock surface. Case-insensitive. Add carefully — these
 * must never appear in production learner-facing copy.
 */
export const BANNED_PHRASES: readonly string[] = [
  "coming soon",
  "stub surface",
  "placeholder content",
  "demo content",
  "mock content",
  "lorem ipsum",
  "todo:",
  "fixme:",
  "quest world not found",
  "tutor not found",
];
