/**
 * Pure scoring + selection helpers for the Sprint 4/5 activity surfaces
 * (reading annotation, graph, drag-manipulative, multi-step workspace).
 *
 * Kept free of React so the logic is unit-testable and shared by the web and
 * mobile renderers. Components stay thin: they capture interaction state and
 * call these to produce the response / correctness signal.
 */
import type {
  DragManipulativeResponse,
  DragManipulativeSpec,
  GraphSpec,
  MultiStepSpec,
  Point,
  ReadingAnnotationTool,
  ScienceDiagramResponse,
  ScienceDiagramSpec,
} from "../types.js";

/* ---------------------------------------------------------------- *
 * Reading annotation (Sprint 4)                                     *
 * ---------------------------------------------------------------- */

/** Toggle a span id in the current selection (returns a new array). */
export function toggleSpanSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id];
}

export interface ReadingAnnotationScore {
  correct: boolean;
  precision: number;
  recall: number;
  f1: number;
}

/**
 * Score highlighted evidence against the expected evidence spans using
 * set precision/recall. `correct` means every expected span was selected and
 * nothing extra was (exact set match). When no expected evidence is declared
 * the surface is process-only and any non-empty selection counts as complete.
 */
export function scoreReadingAnnotation(
  selectedIds: readonly string[],
  expectedIds: readonly string[] | undefined,
): ReadingAnnotationScore {
  const selected = new Set(selectedIds);
  if (!expectedIds || expectedIds.length === 0) {
    const any = selected.size > 0;
    return { correct: any, precision: any ? 1 : 0, recall: any ? 1 : 0, f1: any ? 1 : 0 };
  }
  const expected = new Set(expectedIds);
  let hit = 0;
  for (const id of selected) if (expected.has(id)) hit++;
  const precision = selected.size === 0 ? 0 : hit / selected.size;
  const recall = expected.size === 0 ? 0 : hit / expected.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  const correct = hit === expected.size && selected.size === expected.size;
  return { correct, precision, recall, f1 };
}

export function defaultReadingTool(
  tools: readonly ReadingAnnotationTool[] | undefined,
): ReadingAnnotationTool {
  return tools && tools.length > 0 ? tools[0]! : "highlight";
}

/* ---------------------------------------------------------------- *
 * Graph (Sprint 5)                                                  *
 * ---------------------------------------------------------------- */

export function pointsMatch(a: Point, b: Point, tolerance = 0): boolean {
  return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
}

/** Snap a raw coordinate to the spec's grid (step + bounds). */
export function snapToGrid(value: number, min: number, max: number, step: number): number {
  const stepped = Math.round((value - min) / step) * step + min;
  return Math.max(min, Math.min(max, stepped));
}

export interface GraphScore {
  correct: boolean;
  matched: number;
  missing: number;
  extra: number;
}

/**
 * Order-independent comparison of plotted points against the expected set,
 * within `tolerance` grid units. `correct` requires every expected point to be
 * matched with no extra points.
 */
export function scoreGraph(plotted: readonly Point[], spec: GraphSpec): GraphScore {
  const expected = spec.expectedPoints ?? [];
  const tol = spec.tolerance ?? 0;
  if (expected.length === 0) {
    return { correct: plotted.length > 0, matched: plotted.length, missing: 0, extra: 0 };
  }
  const usedPlotted = new Set<number>();
  let matched = 0;
  for (const exp of expected) {
    const idx = plotted.findIndex((p, i) => !usedPlotted.has(i) && pointsMatch(p, exp, tol));
    if (idx >= 0) {
      usedPlotted.add(idx);
      matched++;
    }
  }
  const missing = expected.length - matched;
  const extra = plotted.length - matched;
  return { correct: missing === 0 && extra === 0, matched, missing, extra };
}

/* ---------------------------------------------------------------- *
 * Drag manipulative (Sprint 5)                                      *
 * ---------------------------------------------------------------- */

export interface DragManipulativeScore {
  correct: boolean;
  correctCount: number;
  total: number;
}

/** Count how many items landed in their correct target. */
export function scoreDragManipulative(
  response: DragManipulativeResponse,
  spec: DragManipulativeSpec,
): DragManipulativeScore {
  const correctMap = spec.correctPlacement ?? {};
  const total = Object.keys(correctMap).length;
  if (total === 0) {
    const placed = Object.keys(response.placement).length;
    return {
      correct: placed === spec.items.length,
      correctCount: placed,
      total: spec.items.length,
    };
  }
  let correctCount = 0;
  for (const [itemId, targetId] of Object.entries(correctMap)) {
    if (response.placement[itemId] === targetId) correctCount++;
  }
  return { correct: correctCount === total, correctCount, total };
}

/** True when adding a token to `targetId` would exceed its capacity. */
export function targetIsFull(
  placement: Record<string, string>,
  spec: DragManipulativeSpec,
  targetId: string,
): boolean {
  const target = spec.targets.find((t) => t.id === targetId);
  if (!target || target.capacity == null) return false;
  const count = Object.values(placement).filter((t) => t === targetId).length;
  return count >= target.capacity;
}

/* ---------------------------------------------------------------- *
 * Multi-step workspace (Sprint 5)                                   *
 * ---------------------------------------------------------------- */

/** Normalize a free-text math/short answer for tolerant comparison. */
export function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, "").replace(/[$,]/g, "");
}

export interface MultiStepScore {
  correct: boolean;
  perStep: Record<string, boolean>;
  completed: number;
  total: number;
}

/** Validate each step independently; `correct` requires every checkable step
 *  to match. Steps without an `expectedAnswer` are process-only (any non-empty
 *  entry counts as complete). */
export function scoreMultiStep(
  entries: Record<string, string>,
  spec: MultiStepSpec,
): MultiStepScore {
  const perStep: Record<string, boolean> = {};
  let completed = 0;
  let allCheckableCorrect = true;
  for (const step of spec.steps) {
    const raw = entries[step.id] ?? "";
    const filled = raw.trim().length > 0;
    if (filled) completed++;
    let ok: boolean;
    if (step.expectedAnswer != null) {
      ok = filled && normalizeAnswer(raw) === normalizeAnswer(step.expectedAnswer);
      if (!ok) allCheckableCorrect = false;
    } else {
      ok = filled;
    }
    perStep[step.id] = ok;
  }
  return {
    correct: allCheckableCorrect && completed === spec.steps.length,
    perStep,
    completed,
    total: spec.steps.length,
  };
}

/* ---------------------------------------------------------------- *
 * Science diagram labelling (Sprint 6)                              *
 * ---------------------------------------------------------------- */

export interface ScienceDiagramScore {
  correct: boolean;
  correctCount: number;
  total: number;
}

/** Score labelled diagram targets against their expected label ids. Targets
 *  without a `correctLabelId` are observational (any placement counts). */
export function scoreScienceDiagram(
  response: ScienceDiagramResponse,
  spec: ScienceDiagramSpec,
): ScienceDiagramScore {
  const graded = spec.targets.filter((t) => t.correctLabelId != null);
  if (graded.length === 0) {
    const placed = Object.keys(response.placement).length;
    return {
      correct: placed === spec.targets.length,
      correctCount: placed,
      total: spec.targets.length,
    };
  }
  let correctCount = 0;
  for (const t of graded) {
    if (response.placement[t.id] === t.correctLabelId) correctCount++;
  }
  return { correct: correctCount === graded.length, correctCount, total: graded.length };
}
