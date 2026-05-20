"use client";
import { forwardRef } from "react";
import { cn } from "../utils/cn";
import {
  pointsToCoords,
  smoothPath,
  type ChartPoint,
} from "./helpers";

export type SoftLineProps = {
  data: ReadonlyArray<ChartPoint>;
  /** Pixel height; width fills container. */
  height?: number;
  /** Stroke tone — defaults to the AIVO primary brand. */
  tone?: "brand" | "mastery" | "risk" | "info" | "success";
  /** Show a soft area fill under the line. */
  filled?: boolean;
  /** Render dot markers at every data point. */
  showDots?: boolean;
  className?: string;
  ariaLabel?: string;
  loading?: boolean;
  error?: string;
  empty?: boolean;
};

const STROKE: Record<NonNullable<SoftLineProps["tone"]>, string> = {
  brand: "stroke-iw-purple-500",
  mastery: "stroke-iw-mastery-proficient-strong",
  risk: "stroke-iw-risk-elevated-strong",
  info: "stroke-iw-info",
  success: "stroke-iw-success",
};

const FILL: Record<NonNullable<SoftLineProps["tone"]>, string> = {
  brand: "fill-iw-purple-200/40",
  mastery: "fill-iw-mastery-proficient-subtle/60",
  risk: "fill-iw-risk-elevated-subtle/60",
  info: "fill-iw-info/15",
  success: "fill-iw-success/15",
};

/**
 * SoftLine — calm trend line for KPI strips and lesson timelines.
 * Pure SVG, no chart-lib dependency; uses Catmull-Rom smoothing.
 */
export const SoftLine = forwardRef<SVGSVGElement, SoftLineProps>(function SoftLine(
  {
    data,
    height = 96,
    tone = "brand",
    filled = true,
    showDots = false,
    className,
    ariaLabel = "Trend",
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
  const coords = pointsToCoords(data, W, H, 10);
  const linePath = smoothPath(coords);
  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x} ${H - 4} L ${coords[0].x} ${H - 4} Z`
      : "";

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("w-full block aivo-motion-lesson-reveal", className)}
      role="img"
      aria-label={ariaLabel}
    >
      {filled && <path d={areaPath} className={cn(FILL[tone])} />}
      <path
        d={linePath}
        fill="none"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={cn(STROKE[tone])}
      />
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
  );
});

SoftLine.displayName = "Chart/SoftLine";
