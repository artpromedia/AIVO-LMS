/**
 * Remediation Sprint 02 — domain-surface selection for generated lessons.
 *
 * `selectSurfaceForItem` is the ONE place that decides which interactive
 * learning surface a generated practice item rides on, keyed off the
 * subject's brand tutor. Both lesson generators call it (the deterministic
 * generator directly; the AI provider inherits it because the deterministic
 * plan anchors the model's output shape), so a tutor's surface behaviour is
 * defined here once — later remediation sprints extend the switch with
 * reading/science/coding/art/music/voice surfaces.
 *
 * The selector only ever returns a surface whose spec it can DERIVE FROM THE
 * ITEM'S CONTENT. It never invents ranges or payloads: an item that cannot
 * carry its surface honestly (e.g. a number line for a non-numeric answer)
 * gets `undefined` and the player falls back to the generic choice/text
 * surface, exactly as before this sprint.
 */
import { getSubjectBySlug } from "@aivo/brand";
import type { LessonSurface } from "@/lib/validators/lesson";

/** The content fields surface derivation reads off a practice item. */
export type SurfaceSourceItem = {
  prompt: string;
  expectedAnswer?: string;
  choices?: string[];
};

export type NumberLineSpec = { min: number; max: number; step: number };

/** Strict integer parse — "5" / "-3" yes; "0.5", "five", "3 apples" no. */
function parseIntStrict(raw: string | undefined): number | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  const n = Number(trimmed);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * Derive a number-line range from an item's actual answer space, or `null`
 * when the item cannot honestly ride a number line.
 *
 * Rules (pedagogy + component constraints):
 *  - the expected answer must be an integer — the learner answers BY picking
 *    a tick, so a non-numeric answer can never be selected;
 *  - when choices exist, EVERY choice must be an integer too (a line cannot
 *    render "hive" as a tick) and all choices become visible ticks;
 *  - values must sit in [-20, 20] — early-numeracy territory where a unit
 *    number line is the right representation; bigger numbers stay on the
 *    expression surface;
 *  - non-negative content anchors at 0 (count-up convention) and the range
 *    extends 2 past the largest value so the answer is never the last tick.
 */
export function deriveNumberLineSpec(item: SurfaceSourceItem): NumberLineSpec | null {
  const answer = parseIntStrict(item.expectedAnswer);
  if (answer === null) return null;
  const values = [answer];
  if (item.choices && item.choices.length > 0) {
    for (const choice of item.choices) {
      const parsed = parseIntStrict(choice);
      if (parsed === null) return null;
      values.push(parsed);
    }
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo < -20 || hi > 20) return null;
  const min = lo >= 0 ? 0 : lo - 1;
  const max = hi + 2;
  return { min, max, step: 1 };
}

/**
 * Choose the domain surface for one generated practice item, or `undefined`
 * for the generic choice/text surface.
 *
 * Sprint 02 wires the first domain: math (Nova) rides a number line whenever
 * the item's answer space derives one. Sprints 03-04 add the remaining
 * tutors here (sage→reading_annotation, spark→science_diagram/graph,
 * pixel→coding_sandbox, muse→art_canvas, cadence→music_sequencer,
 * echo/lingua→voice_response, …).
 */
export function selectSurfaceForItem(input: {
  subjectSlug: string;
  item: SurfaceSourceItem;
}): LessonSurface | undefined {
  const tutorKey = getSubjectBySlug(input.subjectSlug)?.tutorKey;
  switch (tutorKey) {
    case "nova": {
      const numberLine = deriveNumberLineSpec(input.item);
      if (numberLine) return { surfaceType: "number_line", numberLine };
      return undefined;
    }
    default:
      return undefined;
  }
}

/** Attach the selected surface to a practice item (no-op when none fits). */
export function withSelectedSurface<T extends SurfaceSourceItem>(
  item: T,
  subjectSlug: string,
): T & { surface?: LessonSurface } {
  const surface = selectSurfaceForItem({ subjectSlug, item });
  return surface ? { ...item, surface } : item;
}
