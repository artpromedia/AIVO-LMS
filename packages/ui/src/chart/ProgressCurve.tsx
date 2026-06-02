"use client";
import { forwardRef } from "react";
import { cn } from "../utils/cn";
import { clamp } from "./helpers";

export type ProgressCurveProps = {
  /** 0..1 progress ratio. */
  value: number;
  /** Optional target 0..1 to mark on the curve (e.g. weekly goal). */
  target?: number;
  /** Diameter in pixels. */
  size?: number;
  /** Stroke tone. */
  tone?: "brand" | "mastery" | "completion" | "success";
  /** Headline label inside the ring (defaults to percentage). */
  label?: string;
  /** Supporting helper line below the label. */
  helper?: string;
  className?: string;
  ariaLabel?: string;
};

const STROKE: Record<NonNullable<ProgressCurveProps["tone"]>, string> = {
  brand: "stroke-iw-purple-500",
  mastery: "stroke-iw-mastery-proficient-strong",
  completion: "stroke-iw-completion-complete-strong",
  success: "stroke-iw-success",
};

/**
 * ProgressCurve — soft radial progress ring with a tabular numeric
 * readout. Used for weekly lesson completion, mastery growth, etc.
 */
export const ProgressCurve = forwardRef<SVGSVGElement, ProgressCurveProps>(function ProgressCurve(
  { value, target, size = 160, tone = "brand", label, helper, className, ariaLabel = "Progress" },
  ref,
) {
  const v = clamp(value, 0, 1);
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - v);
  const targetAngle = target == null ? null : clamp(target, 0, 1);

  const pct = Math.round(v * 100);
  const headline = label ?? `${pct}%`;

  return (
    <div
      className={cn("inline-flex flex-col items-center justify-center", className)}
      aria-label={ariaLabel}
    >
      <svg
        ref={ref}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        className="block aivo-motion-mastery-up"
        role="img"
        aria-label={`${ariaLabel}: ${pct}%`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-iw-border"
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className={cn(STROKE[tone])}
        />
        {targetAngle != null && (
          <circle
            cx={size / 2 + r * Math.cos(2 * Math.PI * targetAngle - Math.PI / 2)}
            cy={size / 2 + r * Math.sin(2 * Math.PI * targetAngle - Math.PI / 2)}
            r={4}
            className="fill-iw-text-strong"
          />
        )}
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-iw-text-strong iw-tabular"
          style={{ fontSize: size * 0.22, fontWeight: 600 }}
        >
          {headline}
        </text>
      </svg>
      {helper && <p className="mt-2 text-xs text-iw-text-muted">{helper}</p>}
    </div>
  );
});

ProgressCurve.displayName = "Chart/ProgressCurve";
