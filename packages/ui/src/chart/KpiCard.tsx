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

/** Build a consistent accessible label from label + value + optional delta. */
function buildAriaLabel(
  label: string,
  value: string,
  delta: number | null,
  periodLabel?: string,
): string {
  const parts: string[] = [label, value];
  if (delta != null) {
    const dir = delta > 0 ? "up" : delta < 0 ? "down" : "no change";
    const mag = delta !== 0 ? ` ${Math.abs(delta)}%` : "";
    const period = periodLabel ? ` ${periodLabel}` : "";
    parts.push(`${dir}${mag}${period}`);
  }
  return parts.join(", ");
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
  // Store the narrowed value once to avoid repeated non-null assertions below.
  const delta = hasDelta ? deltaPct : 0;
  const TrendIcon = !hasDelta || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const deltaClass = hasDelta ? deriveDeltaTone(delta) : "text-iw-text-muted";

  const computedAriaLabel = buildAriaLabel(label, value, hasDelta ? delta : null, periodLabel);
  const displayedAriaLabel = ariaLabel ?? computedAriaLabel;

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-2 rounded-iw-card bg-iw-card border border-iw-border p-4",
        className,
      )}
      role="figure"
      aria-label={displayedAriaLabel}
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
            {delta > 0 ? "+" : ""}
            {delta}%
          </span>
        )}
      </div>

      {/* Period caption */}
      {periodLabel && (
        <p className="iw-caption text-iw-text-muted -mt-1" aria-hidden="true">
          {periodLabel}
        </p>
      )}

      {/* Inline sparkline — decorative; metric + delta are already in the card ariaLabel */}
      {series && series.length > 0 && (
        <div className="mt-1 -mx-1" aria-hidden="true">
          <SoftLine
            data={series}
            height={40}
            tone={seriesTone}
            filled
            showDots={false}
          />
        </div>
      )}
    </div>
  );
});

KpiCard.displayName = "Chart/KpiCard";
