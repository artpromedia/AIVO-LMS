"use client";
import * as React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "../utils/cn";
import type { AivoComponentState, AivoTone } from "../utils/types";
import { GlassCard } from "./GlassCard";

/**
 * Surface/MetricCard
 *
 * Tabular-numerals KPI tile. Used everywhere a single number tells the
 * story: "12 lessons mastered", "$1,240 due", "94% on-track".
 *
 * Composes GlassCard for the surface so it inherits the shared state
 * contract (default / hover / focus / disabled / loading / error / empty).
 *
 * The big number renders in the metric type ramp (.iw-metric-lg) with
 * `font-variant-numeric: tabular-nums` so digits sit on a grid even as
 * the value animates.
 */
export interface MetricCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  state?: AivoComponentState;
  label: React.ReactNode;
  value: React.ReactNode;
  /** Smaller supporting figure shown to the right of the value (e.g. "/ 20"). */
  suffix?: React.ReactNode;
  /** Delta vs previous period; `null` renders a neutral dash. */
  delta?: number | null;
  /** Override the auto-derived delta tone. */
  deltaTone?: AivoTone;
  /** Optional lucide-react icon component to render in the top-right. */
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Optional sparkline / mini chart rendered under the value. */
  trail?: React.ReactNode;
  /** Optional caption rendered at the bottom (footnote, period label, …). */
  caption?: React.ReactNode;
}

const TONE_CLASS: Record<AivoTone, string> = {
  neutral: "text-[var(--aivo-color-text-muted,#64748b)]",
  primary: "text-[var(--aivo-sensory-primary,#7c3aed)]",
  accent: "text-[var(--aivo-color-aivoTeal-600,#0d9488)]",
  warm: "text-[var(--aivo-color-aivoOrange-600,#ea580c)]",
  success: "text-[var(--aivo-domain-completion-complete-strong,#15803d)]",
  warning: "text-[var(--aivo-color-status-warning-strong,#d97706)]",
  error: "text-[var(--aivo-color-status-error-strong,#dc2626)]",
  info: "text-[var(--aivo-color-status-info-strong,#7c3aed)]",
};

function deriveDeltaTone(delta: number | null | undefined): AivoTone {
  if (delta == null || delta === 0) return "neutral";
  return delta > 0 ? "success" : "error";
}

export const MetricCard = React.forwardRef<HTMLDivElement, MetricCardProps>(function MetricCard(
  {
    state = "default",
    label,
    value,
    suffix,
    delta,
    deltaTone,
    icon: Icon,
    trail,
    caption,
    className,
    ...rest
  },
  ref,
) {
  const tone = deltaTone ?? deriveDeltaTone(delta);
  const TrendIcon = delta == null || delta === 0 ? Minus : delta > 0 ? TrendingUp : TrendingDown;
  const isLoading = state === "loading";
  const isEmpty = state === "empty";

  return (
    <GlassCard
      ref={ref}
      state={state}
      density="base"
      radius="card"
      elevation="raised"
      className={cn("min-h-[140px]", className)}
      {...rest}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="iw-label-sm text-[var(--aivo-color-text-muted,#64748b)] uppercase tracking-wide">
          {label}
        </span>
        {Icon && (
          <Icon className="w-4 h-4 text-[var(--aivo-color-text-muted,#94a3b8)]" aria-hidden />
        )}
      </div>

      <div className="flex items-baseline gap-2 iw-tabular">
        {isLoading ? (
          <span
            aria-hidden
            className="inline-block h-9 w-24 rounded-iw-control bg-[var(--aivo-color-surface-muted,#e2e8f0)]"
          />
        ) : isEmpty ? (
          <span className="iw-metric-lg text-[var(--aivo-color-text-muted,#94a3b8)]">—</span>
        ) : (
          <span className="iw-metric-lg text-[var(--aivo-color-text-default,#0f172a)]">
            {value}
          </span>
        )}
        {suffix && !isLoading && !isEmpty && (
          <span className="text-sm text-[var(--aivo-color-text-muted,#64748b)]">{suffix}</span>
        )}
      </div>

      {delta !== undefined && (
        <div
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold iw-tabular",
            TONE_CLASS[tone],
          )}
        >
          <TrendIcon className="w-3.5 h-3.5" aria-hidden />
          <span aria-hidden="true">{delta == null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}</span>
          <span className="sr-only">
            {delta == null
              ? "No change data"
              : `${delta > 0 ? "Up" : delta < 0 ? "Down" : "No change"} ${Math.abs(delta)} percent`}
          </span>
        </div>
      )}

      {trail && <div className="mt-2">{trail}</div>}

      {caption && (
        <p className="iw-caption text-[var(--aivo-color-text-muted,#94a3b8)]">{caption}</p>
      )}
    </GlassCard>
  );
});
MetricCard.displayName = "Surface/MetricCard";
