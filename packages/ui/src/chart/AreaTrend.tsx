"use client";
import { forwardRef } from "react";
import { cn } from "../utils/cn";

// ─── Layout constants (matches the billing chart's proven proportions) ───────
const CHART_W = 600;
const PAD_L = 48;
const PAD_R = 16;
const PAD_T = 16;
const PAD_B = 40;
const INNER_W = CHART_W - PAD_L - PAD_R;

// ─── Tone maps ───────────────────────────────────────────────────────────────
type AreaTrendTone = "brand" | "info" | "success" | "warning";

const STROKE_CLS: Record<AreaTrendTone, string> = {
  brand: "stroke-iw-purple-500",
  info: "stroke-iw-info",
  success: "stroke-iw-success",
  warning: "stroke-iw-risk-watch-strong",
};

const FILL_CLS: Record<AreaTrendTone, string> = {
  brand: "fill-iw-purple-200/40",
  info: "fill-iw-info/15",
  success: "fill-iw-success/15",
  warning: "fill-iw-risk-watch-subtle/50",
};

/** Swatch color used in the legend (CSS variables from @aivo/brand). */
const SWATCH_VAR: Record<AreaTrendTone, string> = {
  brand: "var(--color-iw-purple-500, #7c3aed)",
  info: "var(--color-iw-info, #0284c7)",
  success: "var(--color-iw-success, #16a34a)",
  warning: "var(--color-iw-risk-watch-strong, #d97706)",
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type AreaTrendPoint = {
  /** Human-readable x-axis label (e.g. "Jan", "W3", "2024-03"). */
  label: string;
  /** Numeric y value. */
  value: number;
};

export type AreaTrendSeriesEntry = {
  /** Legend label for this series (e.g. "Used", "Allocated"). */
  name: string;
  /** Ordered data points. */
  points: ReadonlyArray<AreaTrendPoint>;
  /** Visual tone — defaults to "brand" for the first, "info" for subsequent. */
  tone?: AreaTrendTone;
  /** Render the line as dashed (e.g. for a secondary / target series). */
  dashed?: boolean;
  /** Render a semi-transparent area fill under the line. */
  filled?: boolean;
};

export type AreaTrendRefLine = {
  /** Y value for the horizontal reference line (e.g. hard cap). */
  value: number;
  /** Short label shown at the right end of the line. */
  label: string;
};

export type AreaTrendProps = {
  /** One or two data series to render. */
  series: ReadonlyArray<AreaTrendSeriesEntry>;
  /** Optional horizontal reference line (e.g. hard cap, target). */
  refLine?: AreaTrendRefLine;
  /** Total SVG height in pixels. Defaults to 200. */
  height?: number;
  /** Render y-axis labels and x-axis labels. Defaults to true. */
  showAxes?: boolean;
  /** Render the series legend below the chart. Defaults to true. */
  showLegend?: boolean;
  className?: string;
  ariaLabel?: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toSvgPts(
  values: ReadonlyArray<number>,
  maxVal: number,
  innerH: number,
): Array<{ x: number; y: number }> {
  const count = values.length;
  if (count === 0) return [];
  return values.map((v, i) => ({
    x: PAD_L + (i / Math.max(count - 1, 1)) * INNER_W,
    y: PAD_T + innerH - (v / Math.max(maxVal, 1)) * innerH,
  }));
}

function closedAreaPath(
  pts: ReadonlyArray<{ x: number; y: number }>,
  baseY: number,
): string {
  if (pts.length === 0) return "";
  const by = baseY.toFixed(1);
  const start = `M ${pts[0].x.toFixed(1)},${by}`;
  const lines = pts.map((p) => `L ${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const close = `L ${pts[pts.length - 1].x.toFixed(1)},${by} Z`;
  return `${start} ${lines} ${close}`;
}

function polylinePts(pts: ReadonlyArray<{ x: number; y: number }>): string {
  return pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * AreaTrend — responsive area/line chart for time-series comparisons.
 *
 * Supports up to two series with optional filled areas, dashed lines, and
 * a horizontal reference line (e.g. hard cap). Built in the same SVG-viewBox
 * style as `SoftLine` — no chart-library dependency.
 *
 * Accessibility: the SVG is `aria-hidden`; a visually-hidden `<table>`
 * provides screen-reader-accessible data for every series.
 */
export const AreaTrend = forwardRef<HTMLDivElement, AreaTrendProps>(function AreaTrend(
  {
    series,
    refLine,
    height = 200,
    showAxes = true,
    showLegend = true,
    className,
    ariaLabel = "Area trend chart",
    loading,
    error,
    empty,
  },
  ref,
) {
  if (loading) {
    return (
      <div
        ref={ref}
        className={cn(
          "aivo-motion-baseline-gen rounded-iw-card bg-iw-card border border-iw-border",
          className,
        )}
        style={{ height }}
        aria-busy="true"
        aria-label={`${ariaLabel} loading`}
      />
    );
  }

  if (error) {
    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          "rounded-iw-card border border-iw-error/40 bg-iw-error/5 text-iw-error text-sm flex items-center justify-center px-3",
          className,
        )}
        style={{ height }}
      >
        {error}
      </div>
    );
  }

  const hasData = series.some((s) => s.points.length > 0);
  if (empty || !hasData) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-iw-card border border-dashed border-iw-border text-iw-text-muted text-sm flex items-center justify-center",
          className,
        )}
        style={{ height }}
      >
        No data yet
      </div>
    );
  }

  const INNER_H = height - PAD_T - PAD_B;
  const baseY = PAD_T + INNER_H;

  // Compute global max across all series + optional refLine
  const allValues = series.flatMap((s) => s.points.map((p) => p.value));
  if (refLine != null) allValues.push(refLine.value);
  const maxVal = Math.max(...allValues, 1);

  // Y-axis ticks at 0, 25, 50, 75, 100% of maxVal
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((pct) => ({
    label: String(Math.round(pct * maxVal)),
    y: PAD_T + INNER_H - pct * INNER_H,
  }));

  // X-axis labels — at most 6, evenly spaced from the first (longest) series
  const longestSeries = series.reduce((a, b) => (a.points.length >= b.points.length ? a : b));
  const pts0 = longestSeries.points;
  const labelCount = Math.min(pts0.length, 6);
  const xLabels =
    pts0.length === 0
      ? []
      : Array.from({ length: labelCount }, (_, i) => {
          const step = Math.max(1, Math.floor((pts0.length - 1) / Math.max(labelCount - 1, 1)));
          const idx = Math.min(i * step, pts0.length - 1);
          const svgX = PAD_L + (idx / Math.max(pts0.length - 1, 1)) * INNER_W;
          return { label: pts0[idx].label, x: svgX };
        });

  // Reference line Y
  const refLineY =
    refLine != null ? PAD_T + INNER_H - (refLine.value / Math.max(maxVal, 1)) * INNER_H : null;

  // Series point sets
  const DEFAULT_TONES: AreaTrendTone[] = ["brand", "info", "success", "warning"];
  const seriesPts = series.map((s, idx) => {
    const tone: AreaTrendTone = s.tone ?? DEFAULT_TONES[idx % DEFAULT_TONES.length];
    const pts = toSvgPts(s.points.map((p) => p.value), maxVal, INNER_H);
    return { ...s, tone, pts };
  });

  return (
    <div ref={ref} className={cn("flex flex-col gap-2", className)}>
      {/* Visually hidden data table for screen readers */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {longestSeries.points.map((pt, rowIdx) => (
            <tr key={`${pt.label}-${rowIdx}`}>
              <td>{pt.label}</td>
              {series.map((s) => (
                <td key={s.name}>{s.points[rowIdx]?.value ?? ""}</td>
              ))}
            </tr>
          ))}
          {refLine != null && (
            <tr>
              <td>{refLine.label}</td>
              {series.map((s) => (
                <td key={s.name}>{refLine.value}</td>
              ))}
            </tr>
          )}
        </tbody>
      </table>

      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-4 text-xs text-iw-text-muted" aria-hidden="true">
          {seriesPts.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5">
              {s.dashed ? (
                <span
                  className="inline-block h-0.5 w-6"
                  style={{ background: SWATCH_VAR[s.tone] }}
                />
              ) : (
                <span
                  className="inline-block h-2 w-6 rounded-full"
                  style={{ background: SWATCH_VAR[s.tone] }}
                />
              )}
              {s.name}
            </span>
          ))}
          {refLine != null && (
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-0.5 w-6 stroke-iw-risk-elevated-strong bg-[var(--color-iw-risk-elevated-strong,_#dc2626)]" />
              {refLine.label}
            </span>
          )}
        </div>
      )}

      {/* SVG chart — aria-hidden; the data table above serves screen readers */}
      <svg
        viewBox={`0 0 ${CHART_W} ${height}`}
        className="w-full block aivo-motion-lesson-reveal"
        aria-hidden="true"
      >
        {/* Horizontal grid lines */}
        {yTicks.map((tick) => (
          <line
            key={tick.label}
            x1={PAD_L}
            y1={tick.y}
            x2={PAD_L + INNER_W}
            y2={tick.y}
            className="stroke-iw-border"
            strokeWidth={1}
          />
        ))}

        {/* Filled areas (rendered first so lines sit on top) */}
        {seriesPts.map((s) =>
          s.filled !== false ? (
            <path
              key={`area-${s.name}`}
              d={closedAreaPath(s.pts, baseY)}
              className={cn(FILL_CLS[s.tone])}
            />
          ) : null,
        )}

        {/* Series lines */}
        {seriesPts.map((s) => (
          <polyline
            key={`line-${s.name}`}
            points={polylinePts(s.pts)}
            fill="none"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(STROKE_CLS[s.tone])}
            {...(s.dashed ? { strokeDasharray: "5 3" } : {})}
          />
        ))}

        {/* Reference line (e.g. hard cap) */}
        {refLineY != null && (
          <line
            x1={PAD_L}
            y1={refLineY}
            x2={PAD_L + INNER_W}
            y2={refLineY}
            className="stroke-iw-risk-elevated-strong"
            strokeWidth={1.5}
            strokeDasharray="6 3"
          />
        )}

        {/* Y-axis labels */}
        {showAxes &&
          yTicks.map((tick) => (
            <text
              key={`y-${tick.label}`}
              x={PAD_L - 6}
              y={tick.y + 4}
              textAnchor="end"
              fontSize={10}
              className="fill-iw-text-muted"
            >
              {tick.label}
            </text>
          ))}

        {/* X-axis labels */}
        {showAxes &&
          xLabels.map((lbl, i) => (
            <text
              key={`x-${i}`}
              x={lbl.x}
              y={PAD_T + INNER_H + 16}
              textAnchor="middle"
              fontSize={10}
              className="fill-iw-text-muted"
            >
              {lbl.label}
            </text>
          ))}
      </svg>
    </div>
  );
});

AreaTrend.displayName = "Chart/AreaTrend";
