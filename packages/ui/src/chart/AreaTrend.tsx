"use client";
import { forwardRef } from "react";
import { cn } from "../utils/cn";
import { pointsToCoords, smoothPath, type ChartPoint } from "./helpers";

export interface AreaTrendProps {
  /**
   * Primary data series (e.g. mastery % over weeks).
   */
  data: ReadonlyArray<ChartPoint>;
  /**
   * Optional secondary / comparison series rendered as a thinner dashed
   * line (e.g. prior-period overlay).
   */
  secondaryData?: ReadonlyArray<ChartPoint>;
  /** Pixel height; width fills container. */
  height?: number;
  /** Stroke tone for the primary series. */
  tone?: "brand" | "mastery" | "risk" | "info" | "success";
  /** Optional horizontal reference line value (e.g. 0.65 for the 65 % mastery threshold). */
  refLineValue?: number;
  /** Label shown next to the reference line. */
  refLineLabel?: string;
  /** Show dot markers on the primary series. */
  showDots?: boolean;
  /** Accessible description. Required for a11y compliance. */
  ariaLabel: string;
  className?: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
}

const STROKE: Record<NonNullable<AreaTrendProps["tone"]>, string> = {
  brand: "stroke-iw-purple-500",
  mastery: "stroke-iw-mastery-proficient-strong",
  risk: "stroke-iw-risk-elevated-strong",
  info: "stroke-iw-info",
  success: "stroke-iw-success",
};

const FILL: Record<NonNullable<AreaTrendProps["tone"]>, string> = {
  brand: "fill-iw-purple-200/40",
  mastery: "fill-iw-mastery-proficient-subtle/60",
  risk: "fill-iw-risk-elevated-subtle/60",
  info: "fill-iw-info/15",
  success: "fill-iw-success/15",
};

/**
 * Chart/AreaTrend
 *
 * A richer area/line chart for role dashboard "insights" sections.
 * Supports a secondary comparison series and an optional horizontal
 * reference line (e.g. the 65 % mastery threshold). Pure SVG — no
 * chart-lib dependency.
 *
 * The SVG itself is aria-hidden; a visually-hidden data table is
 * rendered for screen-reader access (same pattern as SoftLine / DotChart).
 */
export const AreaTrend = forwardRef<SVGSVGElement, AreaTrendProps>(function AreaTrend(
  {
    data,
    secondaryData,
    height = 120,
    tone = "brand",
    refLineValue,
    refLineLabel,
    showDots = false,
    ariaLabel,
    className,
    loading,
    error,
    empty,
  },
  ref,
) {
  if (loading) {
    return (
      <div
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

  if (empty || data.length === 0) {
    return (
      <div
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

  const W = 600;
  const H = height;
  const padding = 10;
  const coords = pointsToCoords(data, W, H, padding);
  const linePath = smoothPath(coords);
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${H - padding} L ${coords[0].x} ${H - padding} Z`
      : "";

  // Secondary series (comparison / prior period)
  const secCoords = secondaryData ? pointsToCoords(secondaryData, W, H, padding) : [];
  const secLinePath = secCoords.length > 0 ? smoothPath(secCoords) : "";

  // Reference line — map refLineValue into the chart's y-scale
  let refY: number | null = null;
  if (refLineValue != null && coords.length > 0) {
    const values = data.map((p) => p.value);
    const minV = Math.min(...values);
    const maxV = Math.max(...values);
    if (maxV !== minV) {
      const ratio = (refLineValue - minV) / (maxV - minV);
      refY = padding + (1 - ratio) * (H - padding * 2);
    }
  }

  return (
    <figure className={cn("relative w-full", className)}>
      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="w-full block aivo-motion-lesson-reveal"
        aria-hidden="true"
      >
        {/* Area fill */}
        <path d={areaPath} className={cn(FILL[tone])} />

        {/* Primary line */}
        <path
          d={linePath}
          fill="none"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={cn(STROKE[tone])}
        />

        {/* Secondary / comparison line */}
        {secLinePath && (
          <path
            d={secLinePath}
            fill="none"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="6 3"
            className="stroke-iw-text-muted opacity-50"
          />
        )}

        {/* Reference line */}
        {refY != null && (
          <>
            <line
              x1={padding}
              y1={refY}
              x2={W - padding}
              y2={refY}
              strokeWidth={1}
              strokeDasharray="4 3"
              className="stroke-iw-text-muted opacity-60"
            />
            {refLineLabel && (
              <text
                x={W - padding}
                y={refY - 4}
                textAnchor="end"
                className="fill-iw-text-muted text-[9px]"
                fontSize="9"
              >
                {refLineLabel}
              </text>
            )}
          </>
        )}

        {/* Primary dots */}
        {showDots &&
          coords.map((c, i) => (
            <circle
              key={`${c.label}-${i}`}
              cx={c.x}
              cy={c.y}
              r={3}
              className={cn(STROKE[tone], "fill-white")}
              strokeWidth={1.5}
            />
          ))}
      </svg>

      {/* Screen-reader data table */}
      <table className="sr-only">
        <caption>{ariaLabel}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.label}>
              <td>{p.label}</td>
              <td>{p.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
});

AreaTrend.displayName = "Chart/AreaTrend";
