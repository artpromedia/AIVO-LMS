/**
 * Sprint 12 — Canonical learner subject registry.
 *
 * Aligns the three independent subject vocabularies that grew up across
 * the system:
 *
 *   1. The web learner DB seed (`apps/web-v2/lib/db/seed.ts`) — slug
 *      strings like "reading", "math", "executive-function", used by
 *      every `/api/bff/subjects` consumer.
 *   2. The subject-brain service union (`services/subject-brain-svc`
 *      `Subject` = "math" | "science" | "ela" | "world_language" |
 *      "coding" | "social_studies") — used by adaptive engines.
 *   3. The brand tutor catalogue (`TUTORS` in this package) — used
 *      everywhere we surface a tutor avatar.
 *
 * Keeping three drifting lists in sync caused real bugs (e.g. the
 * "reading" slug had no `brainSubject` link, so the BFF couldn't ask
 * the subject-brain for ELA misconceptions). This registry is the
 * single source of truth: each row pins a learner-visible slug to its
 * subject-brain id (when one exists), to its primary tutor key, and
 * to the display metadata both web + mobile need to render the
 * subject card.
 *
 * Notes:
 *   - `brainSubject: null` means "no adaptive subject-brain ships for
 *     this domain yet" (e.g. art, speech). The tutor still works; only
 *     the brain-driven mastery overlays are skipped. Sprint 5 added
 *     brains for social-emotional, executive-function, life-skills, and
 *     social-studies, leaving art and speech as the remaining null rows.
 *   - This module is intentionally dependency-free so every package
 *     can import it (BFF, mobile, subject-brain client, marketing).
 */

import type { TutorKey } from "./index.js";

/** Identifiers shipped by `services/subject-brain-svc`. */
export type BrainSubject =
  | "math"
  | "science"
  | "ela"
  | "world_language"
  | "coding"
  | "social_studies"
  | "social_emotional"
  | "executive_function"
  | "life_skills";

/**
 * A single learner-facing subject row. `slug` is the URL/database
 * identifier; `name`, `description`, `iconKey` drive the UI; the rest
 * pin the row to other vocabularies.
 */
export interface LearnerSubject {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
  /** Subject-brain identifier, or `null` if no brain is implemented. */
  brainSubject: BrainSubject | null;
  /** Tutor that owns first-line conversations in this subject. */
  tutorKey: TutorKey;
  /** When `true`, the subject appears in the Discovery baseline flow. */
  baselineDomain: boolean;
}

/**
 * Canonical list. Order is the order subjects appear on the learner's
 * subjects grid. The first six rows are the "Discovery Adventure"
 * baseline domains.
 */
export const LEARNER_SUBJECTS = [
  {
    slug: "reading",
    name: "Reading & Language",
    description: "Decoding, comprehension, vocabulary.",
    iconKey: "book",
    brainSubject: "ela",
    tutorKey: "sage",
    baselineDomain: true,
  },
  {
    slug: "math",
    name: "Math",
    description: "Number sense, operations, problem solving.",
    iconKey: "calculator",
    brainSubject: "math",
    tutorKey: "nova",
    baselineDomain: true,
  },
  {
    slug: "science",
    name: "Science",
    description: "Observation, experimentation, nature.",
    iconKey: "flask",
    brainSubject: "science",
    tutorKey: "spark",
    baselineDomain: true,
  },
  {
    slug: "social",
    name: "Social-Emotional",
    description: "Feelings, friendships, self-regulation.",
    iconKey: "people",
    brainSubject: "social_emotional",
    tutorKey: "harmony",
    baselineDomain: true,
  },
  {
    slug: "speech",
    name: "Speech & Language",
    description: "Sounds, rhyming, syllables, articulation.",
    iconKey: "music",
    brainSubject: null,
    tutorKey: "echo",
    baselineDomain: true,
  },
  {
    slug: "executive-function",
    name: "Executive Function",
    description: "Patterns, memory, logic, multi-step thinking.",
    iconKey: "puzzle",
    brainSubject: "executive_function",
    tutorKey: "compass",
    baselineDomain: true,
  },
  {
    slug: "writing",
    name: "Writing",
    description: "Sentence building, narrative, expression.",
    iconKey: "pencil",
    brainSubject: "ela",
    tutorKey: "sage",
    baselineDomain: false,
  },
  {
    slug: "life",
    name: "Life skills",
    description: "Daily routines, self-care, organization.",
    iconKey: "home",
    brainSubject: "life_skills",
    tutorKey: "compass",
    baselineDomain: false,
  },
  {
    slug: "art",
    name: "Art",
    description: "Drawing, color, creative expression.",
    iconKey: "palette",
    brainSubject: null,
    tutorKey: "muse",
    baselineDomain: false,
  },
  {
    slug: "social-studies",
    name: "Social Studies",
    description: "History, geography, civics, world cultures.",
    iconKey: "globe",
    brainSubject: "social_studies",
    tutorKey: "chrono",
    baselineDomain: false,
  },
  {
    slug: "world-languages",
    name: "World Languages",
    description: "Vocabulary, listening, conversation.",
    iconKey: "translate",
    brainSubject: "world_language",
    tutorKey: "lingua",
    baselineDomain: false,
  },
  {
    slug: "coding",
    name: "Coding",
    description: "Logic, sequences, computational thinking.",
    iconKey: "code",
    brainSubject: "coding",
    tutorKey: "pixel",
    baselineDomain: false,
  },
] as const satisfies readonly LearnerSubject[];

export type LearnerSubjectSlug = (typeof LEARNER_SUBJECTS)[number]["slug"];

const BY_SLUG = new Map<string, LearnerSubject>(
  LEARNER_SUBJECTS.map((s) => [s.slug, s as LearnerSubject]),
);
const BY_BRAIN = new Map<BrainSubject, LearnerSubject[]>();
for (const s of LEARNER_SUBJECTS) {
  if (s.brainSubject) {
    const list = BY_BRAIN.get(s.brainSubject) ?? [];
    list.push(s as LearnerSubject);
    BY_BRAIN.set(s.brainSubject, list);
  }
}

export function getSubjectBySlug(slug: string): LearnerSubject | undefined {
  return BY_SLUG.get(slug);
}

/**
 * Returns every learner-facing subject row backed by a given
 * subject-brain. Most brains map to one subject; ELA maps to both
 * "reading" and "writing".
 */
export function getSubjectsByBrain(brain: BrainSubject): readonly LearnerSubject[] {
  return BY_BRAIN.get(brain) ?? [];
}

export function getBaselineSubjects(): readonly LearnerSubject[] {
  return LEARNER_SUBJECTS.filter((s) => s.baselineDomain);
}
