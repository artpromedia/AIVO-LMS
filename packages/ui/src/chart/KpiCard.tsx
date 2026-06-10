"use client";
import { forwardRef } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../utils/cn";
import { SoftLine } from "./SoftLine";
import type { ChartPoint } from "./helpers";

export interface KpiCardProps {
  /** Short metric label (e.g. "Overall mastery"). */
  label: string;
  /** Formatted display value (e.g. "75%"). */
  value: string;
  /**
   * Signed percentage delta vs prior period (e.g. 5 means +5 %).
   * If omitted the delta row is hidden — use this when no historical
   * data is available rather than showing a misleading 0%.
   */
  deltaPct?: number;
  /** Period descriptor rendered next to the delta (e.g. "vs last 30 days"). */
  periodLabel?: string;
  /**
   * Optional sparkline data. When provided a small `SoftLine` is
   * rendered below the metric. The series maps onto the last N slots
   * (days / weeks) for the metric being shown.
   */
  series?: ReadonlyArray<ChartPoint>;
  /** Tone used for the sparkline fill/stroke. Defaults to "brand". */
  seriesTone?: "brand" | "mastery" | "risk" | "info" | "success";
  /** Full accessible description read by screen readers. */
  ariaLabel?: string;
  className?: string;
}

function deriveDeltaTone(delta: number): "text-iw-success" | "text-iw-error" | "text-iw-text-muted" {
  if (delta > 0) return "text-iw-success";
  if (delta < 0) return "text-iw-error";
  return "text-iw-text-muted";
}

/**
 * Chart/KpiCard
 *
 * A calm KPI tile that shows a headline metric, an optional signed-delta
 * badge (hidden gracefully when no history exists), and an optional
 * inline SoftLine sparkline. Designed as the upgrade path from flat
 * `FloatingMetricCard` numbers on all six role dashboards.
 *
 * - SVG is aria-hidden; the card itself carries a descriptive ariaLabel.
 * - Delta is omitted entirely (not zeroed) when prior data is absent.
 * - Respects reduced-motion via the `aivo-motion-lesson-reveal` class on
 *   the sparkline which the brand tokens map to `animation: none`.
 */
export const KpiCard = forwardRef<HTMLDivElement, KpiCardProps>(function KpiCard(
  {
    label,
    value,
    deltaPct,
    periodLabel,
    series,
    seriesTone = "brand",
    ariaLabel,
    className,
  },
  ref,
) {
  const hasDelta = deltaPct != null;
  const TrendIcon =
    !hasDelta || deltaPct === 0 ? Minus : deltaPct > 0 ? TrendingUp : TrendingDown;
  const deltaClass = hasDelta ? deriveDeltaTone(deltaPct!) : "text-iw-text-muted";

  const computedAriaLabel =
    ariaLabel ??
    [
      label,
      value,
      hasDelta
        ? `${deltaPct! > 0 ? "up" : deltaPct! < 0 ? "down" : "no change"} ${Math.abs(deltaPct!)}%${periodLabel ? ` ${periodLabel}` : ""}`
        : null,
    ]
      .filter(Boolean)
      .join(", ");

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 rounded-iw-card bg-iw-card border border-iw-border p-4",
        className,
      )}
      role="figure"
      aria-label={computedAriaLabel}
    >
      {/* Label row */}
      <span className="iw-label-sm text-iw-text-muted uppercase tracking-wide truncate">
        {label}
      </span>

      {/* Value + delta row */}
      <div className="flex items-end justify-between gap-2">
        <span className="iw-metric-lg text-iw-text-strong tabular-nums leading-none">{value}</span>

        {hasDelta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-semibold shrink-0 mb-0.5",
              deltaClass,
            )}
            aria-hidden="true"
          >
            <TrendIcon className="w-3.5 h-3.5" aria-hidden />
            {deltaPct! > 0 ? "+" : ""}
            {deltaPct!}%
          </span>
        )}
      </div>

      {/* Period caption */}
      {periodLabel && (
        <p className="iw-caption text-iw-text-muted -mt-1" aria-hidden="true">
          {periodLabel}
        </p>
      )}

      {/* Inline sparkline */}
      {series && series.length > 0 && (
        <div className="mt-1 -mx-1" aria-hidden="true">
          <SoftLine
            data={series}
            height={40}
            tone={seriesTone}
            filled
            showDots={false}
            ariaLabel={`${label} trend sparkline`}
          />
        </div>
      )}
    </div>
  );
});

KpiCard.displayName = "Chart/KpiCard";
