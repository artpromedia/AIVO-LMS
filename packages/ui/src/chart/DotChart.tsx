"use client";
import { forwardRef } from "react";
import { cn } from "../utils/cn";
import { pointsToCoords, type ChartPoint } from "./helpers";

export type DotChartProps = {
  data: ReadonlyArray<ChartPoint>;
  height?: number;
  tone?: "brand" | "mastery" | "info";
  className?: string;
  ariaLabel?: string;
  /** Render gridlines at 0/50/100% of the y-range. */
  showGrid?: boolean;
  loading?: boolean;
  error?: string;
  empty?: boolean;
};

const DOT_FILL: Record<NonNullable<DotChartProps["tone"]>, string> = {
  brand: "fill-iw-purple-500",
  mastery: "fill-iw-mastery-proficient-strong",
  info: "fill-iw-info",
};

/**
 * DotChart — discrete points (no connecting line). Useful for "lesson
 * sessions" or "approved items per day" where the trend is implicit.
 */
export const DotChart = forwardRef<SVGSVGElement, DotChartProps>(function DotChart(
  {
    data,
    height = 96,
    tone = "brand",
    showGrid = true,
    className,
    ariaLabel = "Dot chart",
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
      />
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          "rounded-iw-card border border-iw-error/40 bg-iw-error/5 text-iw-error text-sm flex items-center justify-center",
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
  const coords = pointsToCoords(data, W, H, 12);

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("w-full block aivo-motion-lesson-reveal", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {showGrid &&
        [0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={0}
            x2={W}
            y1={H * r}
            y2={H * r}
            className="stroke-iw-border"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        ))}
      {coords.map((c, i) => (
        <circle key={`${c.label}-${i}`} cx={c.x} cy={c.y} r={4} className={cn(DOT_FILL[tone])}>
          <title>{`${c.label}: ${c.value}`}</title>
        </circle>
      ))}
    </svg>
  );
});

DotChart.displayName = "Chart/DotChart";
