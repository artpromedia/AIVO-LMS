"use client";
import { forwardRef } from "react";
import { cn } from "../utils/cn";

// ─── Categorical palette ─────────────────────────────────────────────────────
// Up to 6 distinct segments; wraps for larger datasets.
const SEGMENT_STROKE = [
  "fill-iw-purple-500",
  "fill-iw-info",
  "fill-iw-success",
  "fill-iw-risk-watch-strong",
  "fill-iw-mastery-proficient-strong",
  "fill-iw-risk-elevated-strong",
];

/** CSS variable fallbacks for legend swatches (same order as SEGMENT_STROKE). */
const SEGMENT_SWATCH = [
  "var(--color-iw-purple-500, #7c3aed)",
  "var(--color-iw-info, #0284c7)",
  "var(--color-iw-success, #16a34a)",
  "var(--color-iw-risk-watch-strong, #d97706)",
  "var(--color-iw-mastery-proficient-strong, #059669)",
  "var(--color-iw-risk-elevated-strong, #dc2626)",
];

// ─── Types ───────────────────────────────────────────────────────────────────

export type DonutSegment = {
  /** Category label (e.g. "Reading", "Math"). */
  label: string;
  /** Numeric value (absolute count or score). */
  value: number;
};

export type DonutProps = {
  /** Categorical segments to display. */
  segments: ReadonlyArray<DonutSegment>;
  /** Diameter of the SVG in pixels. Defaults to 180. */
  size?: number;
  /**
   * Text rendered in the donut center.
   * Defaults to the formatted sum of all segment values.
   */
  centerLabel?: string;
  /** Show the legend below the donut. Defaults to true. */
  showLegend?: boolean;
  className?: string;
  ariaLabel?: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
};

// ─── Arc helpers ─────────────────────────────────────────────────────────────

function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number,
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/**
 * Build an SVG arc path for a donut slice.
 * Starts at `startDeg`, sweeps clockwise to `endDeg`.
 */
function donutSlicePath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startDeg: number,
  endDeg: number,
): string {
  // Clamp sweep to avoid degenerate full-circle arcs
  const sweep = Math.min(endDeg - startDeg, 359.99);
  const outerStart = polarToCartesian(cx, cy, outerR, startDeg);
  const outerEnd = polarToCartesian(cx, cy, outerR, startDeg + sweep);
  const innerStart = polarToCartesian(cx, cy, innerR, startDeg + sweep);
  const innerEnd = polarToCartesian(cx, cy, innerR, startDeg);
  const largeArc = sweep > 180 ? 1 : 0;

  return [
    `M ${outerStart.x.toFixed(2)},${outerStart.y.toFixed(2)}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x.toFixed(2)},${outerEnd.y.toFixed(2)}`,
    `L ${innerStart.x.toFixed(2)},${innerStart.y.toFixed(2)}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerEnd.x.toFixed(2)},${innerEnd.y.toFixed(2)}`,
    "Z",
  ].join(" ");
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * Donut — categorical breakdown chart with a centre total and legend.
 *
 * Pure SVG, no chart-library dependency. Resolves colours through
 * @aivo/brand tokens following the same pattern as SoftLine / DotChart.
 *
 * Accessibility: the SVG is `aria-hidden`; a visually-hidden `<table>`
 * provides a screen-reader-accessible breakdown of every segment.
 */
export const Donut = forwardRef<HTMLDivElement, DonutProps>(function Donut(
  {
    segments,
    size = 180,
    centerLabel,
    showLegend = true,
    className,
    ariaLabel = "Donut chart",
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
        style={{ width: size, height: size }}
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
        style={{ height: size }}
      >
        {error}
      </div>
    );
  }

  if (empty || segments.length === 0) {
    return (
      <div
        ref={ref}
        className={cn(
          "rounded-iw-card border border-dashed border-iw-border text-iw-text-muted text-sm flex items-center justify-center",
          className,
        )}
        style={{ height: size }}
      >
        No data yet
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size * 0.44;
  const innerR = size * 0.3;

  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const center = centerLabel ?? String(total);

  // Build slices
  let cumDeg = 0;
  const slices = segments.map((seg, idx) => {
    const sweepDeg = total > 0 ? (seg.value / total) * 360 : 360 / segments.length;
    const startDeg = cumDeg;
    cumDeg += sweepDeg;
    return {
      ...seg,
      startDeg,
      sweepDeg,
      pct: total > 0 ? Math.round((seg.value / total) * 100) : 0,
      fillCls: SEGMENT_STROKE[idx % SEGMENT_STROKE.length],
      swatch: SEGMENT_SWATCH[idx % SEGMENT_SWATCH.length],
    };
  });

  return (
    <div ref={ref} className={cn("inline-flex flex-col items-center gap-3", className)}>
      {/* Visually hidden data table for screen readers */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Category</th>
            <th scope="col">Value</th>
            <th scope="col">Percentage</th>
          </tr>
        </thead>
        <tbody>
          {slices.map((s) => (
            <tr key={s.label}>
              <td>{s.label}</td>
              <td>{s.value}</td>
              <td>{s.pct}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* SVG donut — aria-hidden; the data table above serves screen readers */}
      <svg
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block aivo-motion-lesson-reveal"
        aria-hidden="true"
      >
        {slices.map((s) => (
          <path
            key={s.label}
            d={donutSlicePath(cx, cy, outerR, innerR, s.startDeg, s.startDeg + s.sweepDeg)}
            className={cn(s.fillCls)}
          />
        ))}
        {/* Centre total */}
        <text
          x={cx}
          y={cy}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-iw-text-strong iw-tabular"
          style={{ fontSize: size * 0.14, fontWeight: 600 }}
        >
          {center}
        </text>
      </svg>

      {/* Legend */}
      {showLegend && (
        <ul
          className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs text-iw-text-muted"
          aria-hidden="true"
        >
          {slices.map((s) => (
            <li key={s.label} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ background: s.swatch }}
              />
              <span>{s.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

Donut.displayName = "Chart/Donut";
