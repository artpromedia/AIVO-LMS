import type { TutorKey } from "@aivo/brand";

/**
 * Per-quest-world tutor identity.
 *
 * The seeded quest worlds map to the tutor whose domain they explore, so each
 * world can carry that tutor's character + WCAG-verified accent (the same
 * `data-tutor` / tutorThemeCSSVars treatment as the subject worlds). This is a
 * static app-layer mapping keyed by the world slug — no DB column or migration
 * — mirroring how SUBJECT_LESSON_TONE maps subjects to accents.
 */
const QUEST_WORLD_TUTOR: Record<string, TutorKey> = {
  "reading-realm": "sage",
  "math-mountain": "nova",
};

export function tutorKeyForWorldSlug(slug: string): TutorKey | null {
  return QUEST_WORLD_TUTOR[slug] ?? null;
}
