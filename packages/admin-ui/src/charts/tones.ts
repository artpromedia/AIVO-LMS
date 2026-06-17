/**
 * Chart color tokens. The CSS custom properties are emitted by @aivo/brand
 * (tokens/semantic/admin.json → dist/css/admin-tokens.css) and imported by
 * apps/web-admin/app/globals.css. The fallbacks here are pulled from the same
 * brand source (ADMIN_CHART_PALETTE) so the package still renders the
 * reference palette outside that stylesheet — and there is exactly one
 * source of truth (no hardcoded hex in this file).
 */
import { ADMIN_CHART_PALETTE } from "@aivo/brand";

export type ChartTone = "primary" | "positive" | "warning" | "danger" | "neutral";

const [SERIES_1, SERIES_2, SERIES_3, SERIES_4, SERIES_5] = ADMIN_CHART_PALETTE.series;

const TONE_COLOR: Record<ChartTone, string> = {
  primary: `var(--admin-chart-1, ${SERIES_1})`,
  positive: `var(--admin-chart-2, ${SERIES_2})`,
  warning: `var(--admin-chart-3, ${SERIES_3})`,
  danger: `var(--admin-chart-4, ${SERIES_4})`,
  neutral: `var(--admin-chart-5, ${SERIES_5})`,
};

const TONE_CYCLE: ChartTone[] = ["primary", "positive", "warning", "danger", "neutral"];

export function toneColor(tone: ChartTone): string {
  return TONE_COLOR[tone];
}

/** Stable tone for the i-th series/slice when the caller didn't pick one. */
export function cycleTone(index: number): ChartTone {
  return TONE_CYCLE[index % TONE_CYCLE.length];
}

export const CHART_GRID = `var(--admin-chart-grid, ${ADMIN_CHART_PALETTE.grid})`;
export const CHART_AXIS = `var(--admin-chart-axis, ${ADMIN_CHART_PALETTE.axis})`;
export const CHART_INK = `var(--admin-chart-ink, ${ADMIN_CHART_PALETTE.ink})`;
