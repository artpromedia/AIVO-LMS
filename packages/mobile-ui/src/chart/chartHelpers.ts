/**
 * Pure calculation helpers for the SVG-based mobile chart kit.
 *
 * All functions are brand-free (no React, no react-native, no theme
 * import) so they can be imported and exercised by vitest in a plain
 * node environment without any native mocking.
 */

/**
 * The subset of the sensory palette fields used by chart primitives.
 * Structurally compatible with `INCLUSIVE_WARM_BY_MODE[SensoryMode]`
 * from `@aivo/brand` so callers can pass the result of
 * `useSensoryPalette()` directly.
 */
export interface SensoryPalette {
  /** Brand primary colour (shifts in high-contrast mode). */
  primary: string;
  /** Soft raised background — used as brand-tone track fill. */
  bgRaised: string;
  /** Primary text — ring centre label, bar labels. */
  ink: string;
  /** Secondary text — bar percentage labels. */
  inkMuted: string;
  /** Divider / empty-state border colour. */
  border: string;
}

/**
 * Default palette — mirrors `INCLUSIVE_WARM_BY_MODE.standard` from
 * `@aivo/brand`. Used when no palette prop is supplied to a chart
 * primitive.
 */
export const DEFAULT_PALETTE: SensoryPalette = {
  primary: "#7c3aed",
  bgRaised: "#f8f9f8",
  ink: "#090909",
  inkMuted: "#6f7275",
  border: "rgba(0,0,0,0.05)",
};

/** Tone names shared by all mobile chart primitives. */
export type ChartTone = "brand" | "success" | "warning" | "danger";

/**
 * Resolve a tone + palette pair to a fill colour string.
 *
 * - `brand` follows the palette so it shifts in high-contrast mode.
 * - Semantic tones (`success`, `warning`, `danger`) use fixed hex values
 *   consistent with the mastery tones in `charts/tones.ts`.
 */
export function toneColor(tone: ChartTone = "brand", palette: SensoryPalette = DEFAULT_PALETTE): string {
  switch (tone) {
    case "brand":
      return palette.primary;
    case "success":
      return "#22c55e";
    case "warning":
      return "#f59e0b";
    case "danger":
      return "#ef4444";
  }
}

/** A subtle fill used for bar tracks and ring backgrounds. */
export function toneSoftColor(tone: ChartTone = "brand", palette: SensoryPalette = DEFAULT_PALETTE): string {
  switch (tone) {
    case "brand":
      return palette.bgRaised;
    case "success":
      return "#dcfce7";
    case "warning":
      return "#fef3c7";
    case "danger":
      return "#fee2e2";
  }
}

// ---------------------------------------------------------------------------
// Sparkline helpers
// ---------------------------------------------------------------------------

/**
 * Map a numeric series onto SVG coordinates inside the given viewBox.
 *
 * Returns a space-separated polyline `points` attribute string, e.g.
 * `"0,40 25,28 50,12 75,20 100,8"`.
 *
 * @param series  Raw data values (any numeric range; can be empty).
 * @param width   SVG viewBox width (default 100).
 * @param height  SVG viewBox height (default 40).
 * @param padding Inset from top/bottom edges (default 4).
 */
export function sparklinePoints(
  series: ReadonlyArray<number>,
  width = 100,
  height = 40,
  padding = 4,
): string {
  if (series.length === 0) return "";
  if (series.length === 1) {
    const mid = height / 2;
    return `0,${mid} ${width},${mid}`;
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min;
  const plotHeight = height - padding * 2;
  const step = width / (series.length - 1);

  return series
    .map((v, i) => {
      const x = i * step;
      const ratio = span === 0 ? 0.5 : (v - min) / span;
      // y = 0 at top in SVG, so invert ratio
      const y = padding + (1 - ratio) * plotHeight;
      return `${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`;
    })
    .join(" ");
}

/**
 * Build the `accessibilityLabel` string for a Sparkline.
 *
 * @param series  Raw data values.
 * @param label   Human-readable subject (e.g. "Sessions over last 7 days").
 */
export function buildSparklineLabel(series: ReadonlyArray<number>, label = "Trend"): string {
  if (series.length === 0) return `${label}: no data`;
  return `${label}: ${series.join(", ")}`;
}

/** Simple prose trend description based on first vs last value. */
export function sparklineTrendText(series: ReadonlyArray<number>): string {
  if (series.length < 2) return "Insufficient data to determine trend";
  const first = series[0];
  const last = series[series.length - 1];
  if (last > first) return "Trend is rising";
  if (last < first) return "Trend is falling";
  return "Trend is flat";
}

// ---------------------------------------------------------------------------
// BarMini helpers
// ---------------------------------------------------------------------------

export interface BarItem {
  label: string;
  value: number;
  maxValue: number;
}

/**
 * Compute a 0..1 fill ratio for each bar, clamped so bars never exceed
 * 100 % width even when `value > maxValue`.
 */
export function barFillRatios(bars: ReadonlyArray<BarItem>): number[] {
  return bars.map(({ value, maxValue }) => {
    if (!Number.isFinite(maxValue) || maxValue <= 0) return 0;
    return Math.min(1, Math.max(0, value / maxValue));
  });
}

/**
 * Build the `accessibilityLabel` string for a BarMini.
 */
export function buildBarMiniLabel(bars: ReadonlyArray<BarItem>, subject = "Subjects"): string {
  if (bars.length === 0) return `${subject}: no data`;
  const parts = bars.map(({ label, value, maxValue }) => {
    const pct = maxValue > 0 ? Math.round((value / maxValue) * 100) : 0;
    return `${label} ${pct}%`;
  });
  return `${subject}: ${parts.join(", ")}`;
}

// ---------------------------------------------------------------------------
// ProgressRing helpers
// ---------------------------------------------------------------------------

/**
 * Compute the SVG `stroke-dasharray` + `stroke-dashoffset` pair for a
 * circular progress ring.
 *
 * @param value      0..1 progress ratio.
 * @param radius     Circle radius in SVG user units.
 */
export function ringDash(value: number, radius: number): { array: number; offset: number } {
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.min(1, Math.max(0, value));
  const offset = circumference * (1 - clamped);
  return { array: circumference, offset };
}

/**
 * Build the `accessibilityLabel` string for a ProgressRing.
 */
export function buildProgressRingLabel(value: number, label = "Progress"): string {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return `${label} ${pct}%`;
}
