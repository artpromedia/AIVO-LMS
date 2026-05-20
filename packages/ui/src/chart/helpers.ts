/**
 * Shared helpers for chart primitives. Keeps SVG math local and avoids
 * a runtime dependency on a charting library — every visual decision
 * still resolves through the @aivo/brand tokens.
 */

export type ChartPoint = {
  /** Human-readable label for the x slot (e.g. week, lesson, day). */
  label: string;
  /** Numeric value plotted on the y axis. */
  value: number;
};

/** Clamp a value into the inclusive [min, max] range. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Compute min / max with a small headroom so points never touch the edge. */
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

/** Convert a list of points into pixel coordinates within a given box. */
export function pointsToCoords(
  points: ReadonlyArray<ChartPoint>,
  width: number,
  height: number,
  padding = 12,
): Array<{ x: number; y: number; value: number; label: string }> {
  if (points.length === 0) return [];
  const { min, max } = chartBounds(points);
  const w = Math.max(0, width - padding * 2);
  const h = Math.max(0, height - padding * 2);
  const step = points.length === 1 ? 0 : w / (points.length - 1);
  return points.map((p, i) => {
    const x = padding + step * i;
    const ratio = max === min ? 0.5 : (p.value - min) / (max - min);
    const y = padding + (1 - ratio) * h;
    return { x, y, value: p.value, label: p.label };
  });
}

/** Build a smooth Catmull-Rom path through the given coords. */
export function smoothPath(coords: ReadonlyArray<{ x: number; y: number }>): string {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0].x} ${coords[0].y}`;
  const d: string[] = [`M ${coords[0].x} ${coords[0].y}`];
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)];
    const p1 = coords[i];
    const p2 = coords[i + 1];
    const p3 = coords[Math.min(coords.length - 1, i + 2)];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }
  return d.join(" ");
}

/**
 * Mastery levels recognized across the chart primitives. Aligned with
 * the semantic.domain.mastery scale from @aivo/brand.
 */
export type MasteryLevel = "emerging" | "developing" | "proficient" | "mastered";

export const MASTERY_TONE_CLASS: Record<MasteryLevel, string> = {
  emerging: "iw-mastery-emerging",
  developing: "iw-mastery-developing",
  proficient: "iw-mastery-proficient",
  mastered: "iw-mastery-mastered",
};

/** Risk levels mirroring semantic.domain.risk. */
export type RiskLevel = "low" | "watch" | "elevated" | "high";

export const RISK_TONE_CLASS: Record<RiskLevel, string> = {
  low: "iw-risk-low",
  watch: "iw-risk-watch",
  elevated: "iw-risk-elevated",
  high: "iw-risk-high",
};
