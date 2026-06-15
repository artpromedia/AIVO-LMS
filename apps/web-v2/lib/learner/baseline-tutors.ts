/**
 * Discovery Adventure tutor metadata for the baseline assessment.
 *
 * Mirrors the legacy `ADVENTURE_CHAPTERS` / `TUTOR_INTROS` constants from
 * `apps/web/src/components/discovery/types.ts` — six named tutors, one per
 * baseline domain. Subject slug is the join key with `Subject.slug` so the
 * baseline pages can render a per-chapter card without hardcoding subject ids.
 *
 * Brand colors are imported from the canonical `TUTORS` catalogue in
 * `@aivo/brand` rather than re-declared, so the baseline UI stays in lockstep
 * with the rest of the platform (tutor avatars, tier copy, marketing).
 */
import { TUTORS, getSubjectBySlug, type TutorKey } from "@aivo/brand";

export type BaselineTutor = {
  /** Stable id (also the legacy chapter id). */
  id: string;
  /** Tutor first name shown to learners. */
  name: string;
  /**
   * Canonical `@aivo/brand` tutor key (sage, nova, …). Join key for the
   * shared robot host (`TutorFace`) so the baseline never renders a bare
   * emoji avatar.
   */
  tutorKey: TutorKey;
  /** Subject.slug this tutor owns. */
  subjectSlug: string;
  /** Short subtitle, e.g. "Reading & Language". */
  subtitle: string;
  /** Adventure landmark name, e.g. "Story Garden". */
  landmark: string;
  /** Emoji used as a lightweight tutor avatar. */
  emoji: string;
  /** Brand color sourced from `@aivo/brand` TUTORS catalogue. */
  color: string;
  /** Portrait art (256px PNG) + sensory-reduced SVG, from @aivo/brand TUTORS. */
  avatar?: string;
  avatarReduced?: string;
  /** Single-sentence scene description for the chapter intro. */
  scene: string;
  /** Tutor's one-line greeting shown to the learner. */
  greeting: string;
};

export const BASELINE_TUTORS: BaselineTutor[] = [
  {
    id: "sage_story_garden",
    name: "Sage",
    tutorKey: "sage",
    subjectSlug: "reading",
    subtitle: "Reading & Language",
    landmark: "Story Garden",
    emoji: TUTORS.sage.icon,
    color: TUTORS.sage.color,
    scene: "An illustrated garden where words grow on trees and stories hide in magical books.",
    greeting: "I know the best stories — want to read one with me?",
  },
  {
    id: "nova_number_galaxy",
    name: "Nova",
    tutorKey: "nova",
    subjectSlug: "math",
    subtitle: "Math",
    landmark: "Number Galaxy",
    emoji: TUTORS.nova.icon,
    color: TUTORS.nova.color,
    scene:
      "A cosmic scene with planets, stars, and gently floating asteroids waiting to be counted.",
    greeting: "I love stars and numbers. Let's explore them together.",
  },
  {
    id: "spark_discovery_lab",
    name: "Spark",
    tutorKey: "spark",
    subjectSlug: "science",
    subtitle: "Science",
    landmark: "Discovery Lab",
    emoji: TUTORS.spark.icon,
    color: TUTORS.spark.color,
    scene:
      "A colorful laboratory with bubbling beakers, a terrarium with plants, and a microscope.",
    greeting: "Want to see something cool? Science is everywhere.",
  },
  {
    id: "harmony_feelings_treehouse",
    name: "Harmony",
    tutorKey: "harmony",
    subjectSlug: "social",
    subtitle: "Social-Emotional",
    landmark: "Feelings Treehouse",
    emoji: TUTORS.harmony.icon,
    color: TUTORS.harmony.color,
    scene: "A warm, cozy treehouse with soft lighting, cushions, and a window to the world.",
    greeting: "I care about how you feel — every answer here is a good one.",
  },
  {
    id: "echo_sound_studio",
    name: "Echo",
    tutorKey: "echo",
    subjectSlug: "speech",
    subtitle: "Speech & Language",
    landmark: "Sound Studio",
    emoji: TUTORS.echo.icon,
    color: TUTORS.echo.color,
    scene: "A friendly recording studio with microphones, sound waves, and musical notes.",
    greeting: "Let's make some sounds and play with words together.",
  },
  {
    id: "compass_puzzle_palace",
    name: TUTORS.compass.name,
    tutorKey: "compass",
    subjectSlug: "executive-function",
    subtitle: "Executive Function",
    landmark: "Puzzle Palace",
    emoji: TUTORS.compass.icon,
    color: TUTORS.compass.color,
    scene: "A colorful puzzle room where logic rules and patterns create the environment.",
    greeting: "I have the best puzzles. Ready to try one?",
  },
];

function artForTutorName(name: string): { avatar?: string; avatarReduced?: string } {
  const entry = Object.values(TUTORS).find((t) => t.name === name);
  return entry ? { avatar: entry.avatar, avatarReduced: entry.avatarReduced } : {};
}

export function tutorForSubjectSlug(slug: string): BaselineTutor | null {
  const explicit = BASELINE_TUTORS.find((t) => t.subjectSlug === slug);
  if (explicit) return { ...explicit, ...artForTutorName(explicit.name) };
  // Sprint 2 (subject/tutor UX): every subject — not just the six baseline
  // Discovery domains — now resolves to a tutor descriptor derived from the
  // canonical `@aivo/brand` catalog, so the subjects grid and lesson flow show
  // the real tutor (name / emoji / brand color) for all subjects.
  const subject = getSubjectBySlug(slug);
  if (!subject) return null;
  const tutor = TUTORS[subject.tutorKey];
  return {
    id: `${subject.tutorKey}_${slug}`,
    name: tutor.name,
    tutorKey: subject.tutorKey,
    subjectSlug: slug,
    subtitle: subject.name,
    landmark: tutor.domain,
    emoji: tutor.icon,
    color: tutor.color,
    avatar: tutor.avatar,
    avatarReduced: tutor.avatarReduced,
    scene: subject.description,
    greeting: `Hi! I'm ${tutor.name}. Let's explore ${subject.name} together.`,
  };
}
