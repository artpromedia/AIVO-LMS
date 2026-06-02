"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * States/Skeleton
 *
 * Loading placeholder. Five variants cover ~all dashboard needs:
 *
 *  - line   → a one-line text shimmer (default)
 *  - block  → a rectangular block, default 100% × 80px
 *  - metric → matches MetricCard value footprint (h-9 w-28)
 *  - avatar → 40×40 round
 *  - chart  → 100% × 160px tinted rectangle
 *
 * Uses the baseline-gen named motion + reduced-motion contract from
 * @aivo/brand, so it automatically disables itself when the user has
 * `prefers-reduced-motion: reduce` enabled.
 */
export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "line" | "block" | "metric" | "avatar" | "chart";
  /** Override width — accepts any CSS length. */
  width?: string | number;
  /** Override height — accepts any CSS length. */
  height?: string | number;
  /** Number of stacked lines (only for variant="line"). */
  lines?: number;
}

const BASE =
  "bg-[linear-gradient(90deg,var(--aivo-color-surface-muted,#e2e8f0)_0%,var(--aivo-color-surface-card,#f1f5f9)_50%,var(--aivo-color-surface-muted,#e2e8f0)_100%)] bg-[length:200%_100%] aivo-motion-baseline-gen";

const VARIANT: Record<
  NonNullable<SkeletonProps["variant"]>,
  { className: string; defaultStyle?: React.CSSProperties }
> = {
  line: {
    className: "h-3 rounded-iw-chip",
    defaultStyle: { width: "100%" },
  },
  block: {
    className: "rounded-iw-control",
    defaultStyle: { width: "100%", height: 80 },
  },
  metric: {
    className: "rounded-iw-control",
    defaultStyle: { width: 112, height: 36 },
  },
  avatar: {
    className: "rounded-full",
    defaultStyle: { width: 40, height: 40 },
  },
  chart: {
    className: "rounded-iw-card",
    defaultStyle: { width: "100%", height: 160 },
  },
};

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(function Skeleton(
  { variant = "line", width, height, lines = 1, className, style, ...rest },
  ref,
) {
  const { className: variantClass, defaultStyle } = VARIANT[variant];
  const merged: React.CSSProperties = {
    ...defaultStyle,
    ...(width != null ? { width } : null),
    ...(height != null ? { height } : null),
    ...style,
  };

  if (variant === "line" && lines > 1) {
    return (
      <div
        ref={ref}
        role="status"
        aria-busy="true"
        aria-label="Loading"
        className={cn("flex flex-col gap-2", className)}
        {...rest}
      >
        {Array.from({ length: lines }).map((_, i) => (
          <span
            key={i}
            className={cn(BASE, variantClass)}
            style={{
              ...merged,
              width: i === lines - 1 ? "60%" : (merged.width as React.CSSProperties["width"]),
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="status"
      aria-busy="true"
      aria-label="Loading"
      {...rest}
      style={merged}
      className={cn(BASE, variantClass, "block", className)}
    />
  );
});
Skeleton.displayName = "States/Skeleton";
