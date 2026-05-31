/**
 * Pure math + scale helpers for the mobile chart kit.
 *
 * Mirrors `@aivo/ui/chart/helpers` (web) so progress / gradebook
 * analytics read the same on both surfaces. Deliberately **brand-free**
 * (no `theme` import) so these helpers stay importable from the vitest
 * node env — the app-side mirror lives at
 * `apps/mobile/src/design/chart-scale.ts` and is the one the unit
 * tests exercise. Keep the two in lockstep.
 */

export type ChartPoint = {
  /** Human-readable label for the x slot (e.g. day, week, lesson). */
  label: string;
  /** Numeric value plotted on the y axis. */
  value: number;
};

/** Mastery scale, aligned with `semantic.domain.mastery` from @aivo/brand. */
export type MasteryLevel = "emerging" | "developing" | "proficient" | "mastered";

/** Clamp a value into the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Accepts a mastery score in either 0..1 or 0..100 and normalises to
 * 0..1. Mirrors the tolerance used by `deriveDomains` in
 * `apps/mobile/hooks/useBrain.ts`.
 */
export function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const s = score > 1 ? score / 100 : score;
  return clamp(s, 0, 1);
}

/** Map a normalised-or-raw mastery score to a mastery level. */
export function masteryLevelFromScore(score: number): MasteryLevel {
  const s = normalizeScore(score);
  if (s < 0.35) return "emerging";
  if (s < 0.6) return "developing";
  if (s < 0.85) return "proficient";
  return "mastered";
}

/** Map the web string mastery levels onto the chart scale. */
export function masteryLevelFromLabel(level: string): MasteryLevel {
  switch (level) {
    case "stretching":
    case "mastered":
      return "mastered";
    case "on_grade_level":
    case "proficient":
      return "proficient";
    case "approaching":
    case "developing":
      return "developing";
    default:
      return "emerging";
  }
}

/** Compute min / max with a little headroom so points never touch the edge. */
export function chartBounds(points: ReadonlyArray<ChartPoint>): { min: number; max: number } {
  if (points.length === 0) return { min: 0, max: 1 };
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    const pad = Math.max(1, Math.abs(min) * 0.1);
    return { min: min - pad, max: max + pad };
  }
  const headroom = (max - min) * 0.08;
  return { min: min - headroom, max: max + headroom };
}

/**
 * Per-point vertical ratios in 0..1 (0 = bottom, 1 = top) using
 * `chartBounds`. Used to position dots in `DotChart`.
 */
export function valueRatios(points: ReadonlyArray<ChartPoint>): number[] {
  if (points.length === 0) return [];
  const { min, max } = chartBounds(points);
  const span = max - min;
  return points.map((p) => (span === 0 ? 0.5 : clamp((p.value - min) / span, 0, 1)));
}

/**
 * Per-point ratios in 0..1 relative to the largest value, anchored at
 * zero. Used for "lessons per day" style bars that grow from the floor.
 */
export function barRatios(points: ReadonlyArray<ChartPoint>): number[] {
  if (points.length === 0) return [];
  const max = Math.max(...points.map((p) => p.value), 0);
  return points.map((p) => (max <= 0 ? 0 : clamp(p.value / max, 0, 1)));
}

/**
 * Keep a chart readable on a phone by collapsing a long series down to
 * `limit` slots, preserving the most recent ones (charts read left→
 * right oldest→newest, so we keep the tail).
 */
export function takeRecent<T>(series: ReadonlyArray<T>, limit: number): T[] {
  if (limit <= 0 || series.length <= limit) return series.slice();
  return series.slice(series.length - limit);
}
