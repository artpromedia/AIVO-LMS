"use client";
import { forwardRef } from "react";
import { cn } from "../utils/cn";

export interface DonutSlice {
  /** Accessible label for this slice (e.g. "Proficient"). */
  label: string;
  /** Numeric count or percentage. */
  value: number;
  /** Tailwind fill class for this slice. */
  colorClass: string;
}

export interface DonutProps {
  /** Data slices. Values are summed to determine proportions. */
  data: ReadonlyArray<DonutSlice>;
  /** Pixel size (width = height). Defaults to 96. */
  size?: number;
  /** Optional center label (e.g. "75%"). */
  centerLabel?: string;
  /** Optional center sub-label (e.g. "mastery"). */
  centerSublabel?: string;
  /** Accessible description. */
  ariaLabel: string;
  className?: string;
  loading?: boolean;
  empty?: boolean;
}

const STROKE_OFFSET = 25; // donut hole radius as % of viewBox
const VIEWBOX = 100;
const RADIUS = 40;
const CX = 50;
const CY = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Chart/Donut
 *
 * A calm categorical donut for displaying distribution data
 * (e.g. mastery distribution: Emerging / Developing / Proficient / Mastered).
 * Pure SVG — no external charting dependency.
 *
 * Screen-reader: SVG is aria-hidden; a sr-only legend lists each slice.
 */
export const Donut = forwardRef<SVGSVGElement, DonutProps>(function Donut(
  {
    data,
    size = 96,
    centerLabel,
    centerSublabel,
    ariaLabel,
    className,
    loading,
    empty,
  },
  ref,
) {
  if (loading) {
    return (
      <div
        className={cn("aivo-motion-baseline-gen rounded-full bg-iw-border", className)}
        style={{ width: size, height: size }}
        aria-busy="true"
        aria-label={`${ariaLabel} loading`}
      />
    );
  }

  const total = data.reduce((s, d) => s + d.value, 0);

  if (empty || data.length === 0 || total === 0) {
    return (
      <div
        className={cn(
          "rounded-full border-2 border-dashed border-iw-border flex items-center justify-center text-iw-text-muted text-xs",
          className,
        )}
        style={{ width: size, height: size }}
      >
        —
      </div>
    );
  }

  // Build arc segments
  let accumulated = 0;
  const segments = data.map((d) => {
    const proportion = d.value / total;
    const dashArray = `${proportion * CIRCUMFERENCE} ${CIRCUMFERENCE}`;
    const offset = CIRCUMFERENCE - accumulated * CIRCUMFERENCE;
    accumulated += proportion;
    return { ...d, dashArray, offset };
  });

  return (
    <figure className={cn("inline-block", className)}>
      <svg
        ref={ref}
        viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
        width={size}
        height={size}
        aria-hidden="true"
      >
        {/* Track */}
        <circle
          cx={CX}
          cy={CY}
          r={RADIUS}
          fill="none"
          strokeWidth={STROKE_OFFSET}
          className="stroke-iw-border"
        />

        {/* Slices */}
        {segments.map((seg) => (
          <circle
            key={seg.label}
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE_OFFSET}
            strokeDasharray={seg.dashArray}
            strokeDashoffset={seg.offset}
            transform={`rotate(-90 ${CX} ${CY})`}
            className={cn(seg.colorClass)}
          />
        ))}

        {/* Center text */}
        {centerLabel && (
          <text
            x={CX}
            y={centerSublabel ? CY - 2 : CY + 5}
            textAnchor="middle"
            className="fill-iw-text-strong font-semibold"
            fontSize="18"
            fontWeight="600"
          >
            {centerLabel}
          </text>
        )}
        {centerSublabel && (
          <text
            x={CX}
            y={CY + 12}
            textAnchor="middle"
            className="fill-iw-text-muted"
            fontSize="8"
          >
            {centerSublabel}
          </text>
        )}
      </svg>

      {/* Screen-reader legend */}
      <ul className="sr-only" role="list" aria-label={ariaLabel}>
        {data.map((d) => (
          <li key={d.label}>
            {d.label}: {d.value} ({Math.round((d.value / total) * 100)}%)
          </li>
        ))}
      </ul>
    </figure>
  );
});

Donut.displayName = "Chart/Donut";
