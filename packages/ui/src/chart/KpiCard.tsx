"use client";
import { type ReactNode } from "react";
import { cn } from "../utils/cn";
import { SoftLine } from "./SoftLine";
import type { ChartPoint } from "./helpers";

// ─── Tone maps ───────────────────────────────────────────────────────────────
type KpiTone = "brand" | "mastery" | "success" | "risk";

const VALUE_CLS: Record<KpiTone, string> = {
  brand: "text-iw-text-strong",
  mastery: "text-iw-mastery-proficient-strong",
  success: "text-iw-success",
  risk: "text-iw-risk-elevated-strong",
};

const SOFTLINE_TONE: Record<KpiTone, "brand" | "mastery" | "success" | "risk"> = {
  brand: "brand",
  mastery: "mastery",
  success: "success",
  risk: "risk",
};

// ─── Types ───────────────────────────────────────────────────────────────────

export type KpiCardProps = {
  /** The primary metric value (required). A number, formatted string, or node. */
  value: ReactNode;
  /** Metric label shown above the value. */
  label?: string;
  /**
   * Signed percentage delta vs previous period (e.g. `0.12` = +12%).
   * Positive → green, negative → red, zero → muted.
   */
  deltaPct?: number;
  /**
   * Time-series data for the inline sparkline.
   * When provided, a `SoftLine` sparkline is rendered below the metric.
   */
  series?: ReadonlyArray<ChartPoint>;
  /** Tone for the value text and sparkline. Defaults to "brand". */
  tone?: KpiTone;
  className?: string;
  /**
   * Accessible label for the card.
   * Should describe the metric name + value, e.g. "Active learners: 240".
   */
  ariaLabel?: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDelta(pct: number): string {
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(Math.round(pct * 100))}%`;
}

function deltaToneCls(pct: number): string {
  if (pct > 0) return "text-iw-success";
  if (pct < 0) return "text-iw-risk-elevated-strong";
  return "text-iw-text-muted";
}

// ─── Component ───────────────────────────────────────────────────────────────

/**
 * KpiCard — trend-aware metric tile.
 *
 * Renders a headline value with an optional signed delta badge and an
 * optional inline `SoftLine` sparkline. It is the upgrade path for
 * `FloatingMetricCard` callers who want historical trend context.
 *
 * Accessibility: the card has a `role="region"` with `aria-label`; when a
 * sparkline `series` is provided, a visually-hidden `<table>` gives
 * screen readers access to the underlying data.
 */
export function KpiCard({
  value,
  label,
  deltaPct,
  series,
  tone = "brand",
  className,
  ariaLabel,
}: KpiCardProps) {
  const accessibleLabel =
    ariaLabel ??
    (label != null
      ? typeof value === "string" || typeof value === "number"
        ? `${label}: ${String(value)}`
        : label
      : undefined);

  return (
    <div
      role="region"
      aria-label={accessibleLabel}
      className={cn(
        "flex flex-col gap-3 rounded-iw-card bg-iw-card border border-iw-border p-4",
        className,
      )}
    >
      {/* Label */}
      {label && (
        <p className="text-xs font-medium text-iw-text-muted uppercase tracking-wide">{label}</p>
      )}

      {/* Value + delta */}
      <div className="flex items-baseline gap-2">
        <span
          className={cn(
            "font-iw-display text-3xl font-bold tracking-tight tabular-nums",
            VALUE_CLS[tone],
          )}
        >
          {value}
        </span>
        {deltaPct != null && (
          <span className={cn("text-sm font-semibold", deltaToneCls(deltaPct))}>
            {formatDelta(deltaPct)}
          </span>
        )}
      </div>

      {/* Sparkline with visually-hidden data table */}
      {series != null && series.length > 0 && (
        <div className="mt-1">
          {/* Screen-reader data table */}
          <table className="sr-only">
            <caption>{accessibleLabel ?? label ?? "Trend data"}</caption>
            <thead>
              <tr>
                <th scope="col">Period</th>
                <th scope="col">Value</th>
              </tr>
            </thead>
            <tbody>
              {series.map((pt, i) => (
                <tr key={`${pt.label}-${i}`}>
                  <td>{pt.label}</td>
                  <td>{pt.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <SoftLine
            data={series}
            height={48}
            tone={SOFTLINE_TONE[tone]}
            filled
            showDots={false}
            aria-hidden="true"
          />
        </div>
      )}
    </div>
  );
}

KpiCard.displayName = "Chart/KpiCard";
