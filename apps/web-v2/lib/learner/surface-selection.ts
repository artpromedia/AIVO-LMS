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

/**
 * Attach the automatically-selected surface to a practice item. Items that
 * already carry an authored surface (built by the domain builders below or
 * sourced from an authored content pack) are left untouched — automatic
 * selection is the fallback, never an override.
 */
export function withSelectedSurface<T extends SurfaceSourceItem & { surface?: LessonSurface }>(
  item: T,
  subjectSlug: string,
): T & { surface?: LessonSurface } {
  if (item.surface) return item;
  const surface = selectSurfaceForItem({ subjectSlug, item });
  return surface ? { ...item, surface } : item;
}

// ── Sprint 03 — authored-surface builders ────────────────────────────────────
//
// These construct a domain surface AND the expectedAnswer that scores it,
// in one move, because the two must agree exactly: each surface component
// serializes its response deterministically (reading-annotation submits the
// selected span IDS joined with ","; graph submits JSON.stringify(points);
// science-diagram submits JSON.stringify({ targetId: labelId })) and the
// SurfaceRouter string-compares that serialization against the item's
// expectedAnswer. Building them together makes an unanswerable item
// unrepresentable.

/** A surface plus the expectedAnswer string that scores it. */
export type ScoredSurface = { surface: LessonSurface; expectedAnswer: string };

function splitSentences(passage: string): string[] {
  return passage
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function normalizeText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Build a reading-annotation surface from a prose passage. The passage is
 * split into sentence spans; the span matching `evidenceSentence` becomes the
 * expected evidence, and the expectedAnswer is that span's ID (what the
 * surface submits). Returns null when the evidence sentence is not present
 * in the passage — a question whose answer cannot be highlighted is not an
 * annotation item.
 */
export function buildReadingAnnotationSurface(input: {
  passage: string;
  question: string;
  evidenceSentence: string;
  tools?: Array<"highlight" | "underline">;
}): ScoredSurface | null {
  const sentences = splitSentences(input.passage);
  if (sentences.length < 2 || sentences.length > 12) return null;
  const spans = sentences.map((text, i) => ({ id: `s${i + 1}`, text, selectable: true }));
  const evidence = spans.find(
    (span) => normalizeText(span.text) === normalizeText(input.evidenceSentence),
  );
  if (!evidence) return null;
  return {
    surface: {
      surfaceType: "reading_annotation",
      readingAnnotation: {
        passage: spans,
        tools: input.tools ?? ["highlight"],
        expectedEvidenceIds: [evidence.id],
        question: input.question,
      },
    },
    expectedAnswer: evidence.id,
  };
}

/**
 * Build a single-point plotting task on a small coordinate grid. The
 * expectedAnswer is the exact serialization GraphSurface submits for that
 * one plotted point.
 */
export function buildGraphSurface(input: {
  point: { x: number; y: number };
  xMax?: number;
  yMax?: number;
}): ScoredSurface | null {
  const xMax = input.xMax ?? 6;
  const yMax = input.yMax ?? 6;
  const { x, y } = input.point;
  if (!Number.isInteger(x) || !Number.isInteger(y)) return null;
  if (x < 0 || x > xMax || y < 0 || y > yMax) return null;
  return {
    surface: {
      surfaceType: "graph",
      graph: {
        xMin: 0,
        xMax,
        yMin: 0,
        yMax,
        step: 1,
        mode: "points",
        expectedPoints: [{ x, y }],
        tolerance: 0,
      },
    },
    expectedAnswer: JSON.stringify([{ x, y }]),
  };
}

export type DiagramShapeInput =
  | { id: string; kind: "circle"; cx: number; cy: number; r: number }
  | { id: string; kind: "rectangle"; x: number; y: number; width: number; height: number }
  | {
      id: string;
      kind: "segment";
      start: { x: number; y: number };
      end: { x: number; y: number };
    };

/**
 * Build a SINGLE-target diagram-labelling task. One target keeps the
 * placement serialization order-stable, so the expectedAnswer
 * (JSON.stringify({ targetId: labelId })) is deterministic regardless of
 * learner interaction order. Distractor labels make it a real choice.
 */
export function buildScienceDiagramSurface(input: {
  shapes: DiagramShapeInput[];
  target: { id: string; x: number; y: number; correctLabelId: string };
  labels: Array<{ id: string; text: string }>;
  width?: number;
  height?: number;
}): ScoredSurface | null {
  if (input.labels.length < 2) return null;
  if (!input.labels.some((l) => l.id === input.target.correctLabelId)) return null;
  return {
    surface: {
      surfaceType: "science_diagram",
      scienceDiagram: {
        width: input.width ?? 480,
        height: input.height ?? 320,
        diagram: {
          canvasMode: "svg",
          width: input.width ?? 480,
          height: input.height ?? 320,
          shapes: input.shapes,
        },
        targets: [input.target],
        labels: input.labels,
      },
    },
    expectedAnswer: JSON.stringify({ [input.target.id]: input.target.correctLabelId }),
  };
}
