/**
 * Chart color tokens. The CSS custom properties are defined in
 * apps/web-admin/app/globals.css; the hex fallbacks mirror them so the
 * package still renders sensibly outside that stylesheet.
 */
export type ChartTone = "primary" | "positive" | "warning" | "danger" | "neutral";

const TONE_COLOR: Record<ChartTone, string> = {
  primary: "var(--admin-chart-1, #174ea6)",
  positive: "var(--admin-chart-2, #065f46)",
  warning: "var(--admin-chart-3, #b45309)",
  danger: "var(--admin-chart-4, #b91c1c)",
  neutral: "var(--admin-chart-5, #475569)",
};

const TONE_CYCLE: ChartTone[] = ["primary", "positive", "warning", "danger", "neutral"];

export function toneColor(tone: ChartTone): string {
  return TONE_COLOR[tone];
}

/** Stable tone for the i-th series/slice when the caller didn't pick one. */
export function cycleTone(index: number): ChartTone {
  return TONE_CYCLE[index % TONE_CYCLE.length];
}

export const CHART_GRID = "var(--admin-chart-grid, rgba(23, 32, 51, 0.12))";
export const CHART_AXIS = "var(--admin-chart-axis, #475569)";
export const CHART_INK = "#172033";
