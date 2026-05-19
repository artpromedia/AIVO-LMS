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
import { TUTORS } from "@aivo/brand";

export type BaselineTutor = {
  /** Stable id (also the legacy chapter id). */
  id: string;
  /** Tutor first name shown to learners. */
  name: string;
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
  /** Single-sentence scene description for the chapter intro. */
  scene: string;
  /** Tutor's one-line greeting shown to the learner. */
  greeting: string;
};

export const BASELINE_TUTORS: BaselineTutor[] = [
  {
    id: "sage_story_garden",
    name: "Sage",
    subjectSlug: "reading",
    subtitle: "Reading & Language",
    landmark: "Story Garden",
    emoji: "📖",
    color: TUTORS.sage.color,
    scene: "An illustrated garden where words grow on trees and stories hide in magical books.",
    greeting: "I know the best stories — want to read one with me?",
  },
  {
    id: "nova_number_galaxy",
    name: "Nova",
    subjectSlug: "math",
    subtitle: "Math",
    landmark: "Number Galaxy",
    emoji: "✨",
    color: TUTORS.nova.color,
    scene:
      "A cosmic scene with planets, stars, and gently floating asteroids waiting to be counted.",
    greeting: "I love stars and numbers. Let's explore them together.",
  },
  {
    id: "spark_discovery_lab",
    name: "Spark",
    subjectSlug: "science",
    subtitle: "Science",
    landmark: "Discovery Lab",
    emoji: "⚡",
    color: TUTORS.spark.color,
    scene:
      "A colorful laboratory with bubbling beakers, a terrarium with plants, and a microscope.",
    greeting: "Want to see something cool? Science is everywhere.",
  },
  {
    id: "harmony_feelings_treehouse",
    name: "Harmony",
    subjectSlug: "social",
    subtitle: "Social-Emotional",
    landmark: "Feelings Treehouse",
    emoji: "💜",
    color: TUTORS.harmony.color,
    scene: "A warm, cozy treehouse with soft lighting, cushions, and a window to the world.",
    greeting: "I care about how you feel — there are no wrong answers here.",
  },
  {
    id: "echo_sound_studio",
    name: "Echo",
    subjectSlug: "speech",
    subtitle: "Speech & Language",
    landmark: "Sound Studio",
    emoji: "🎵",
    color: TUTORS.echo.color,
    scene: "A friendly recording studio with microphones, sound waves, and musical notes.",
    greeting: "Let's make some sounds and play with words together.",
  },
  {
    id: "pixel_puzzle_palace",
    name: "Pixel",
    subjectSlug: "executive-function",
    subtitle: "Executive Function",
    landmark: "Puzzle Palace",
    emoji: "🧩",
    color: TUTORS.pixel.color,
    scene: "A colorful puzzle room where logic rules and patterns create the environment.",
    greeting: "I have the best puzzles. Ready to try one?",
  },
];

export function tutorForSubjectSlug(slug: string): BaselineTutor | null {
  return BASELINE_TUTORS.find((t) => t.subjectSlug === slug) ?? null;
}
