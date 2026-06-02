/**
 * Pure chart scale helpers — app-side mirror of
 * `@aivo/mobile-ui/charts/helpers`.
 *
 * Why mirrored: the vitest node env cannot resolve `@aivo/brand`
 * (transitively pulled in by `mobile-ui`'s `theme`), so the unit tests
 * import this brand-free copy instead. Keep this file in lockstep with
 * `packages/mobile-ui/src/charts/helpers.ts` — `__tests__/chart-scale.test.ts`
 * pins the behaviour.
 */

export type ChartPoint = { label: string; value: number };
export type MasteryLevel = "emerging" | "developing" | "proficient" | "mastered";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function normalizeScore(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const s = score > 1 ? score / 100 : score;
  return clamp(s, 0, 1);
}

export function masteryLevelFromScore(score: number): MasteryLevel {
  const s = normalizeScore(score);
  if (s < 0.35) return "emerging";
  if (s < 0.6) return "developing";
  if (s < 0.85) return "proficient";
  return "mastered";
}

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

export function chartBounds(points: readonly ChartPoint[]): { min: number; max: number } {
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

export function valueRatios(points: readonly ChartPoint[]): number[] {
  if (points.length === 0) return [];
  const { min, max } = chartBounds(points);
  const span = max - min;
  return points.map((p) => (span === 0 ? 0.5 : clamp((p.value - min) / span, 0, 1)));
}

export function barRatios(points: readonly ChartPoint[]): number[] {
  if (points.length === 0) return [];
  const max = Math.max(...points.map((p) => p.value), 0);
  return points.map((p) => (max <= 0 ? 0 : clamp(p.value / max, 0, 1)));
}

export function takeRecent<T>(series: readonly T[], limit: number): T[] {
  if (limit <= 0 || series.length <= limit) return series.slice();
  return series.slice(series.length - limit);
}
