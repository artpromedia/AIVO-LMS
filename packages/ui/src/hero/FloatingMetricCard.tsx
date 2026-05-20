import * as React from "react";
import { clsx } from "clsx";

/**
 * FloatingMetricCard
 *
 * Oversized "floating" metric card used on the redesigned parent home.
 * Larger than the existing `surface/MetricCard` so it can be the
 * focal point of a section. Designed to sit on the canvas background
 * with a soft drop-shadow giving the "floating" feel — without using
 * any backdrop-filter (which still has perf cliffs on low-end
 * Chromebooks).
 */
export type FloatingMetricCardProps = {
  label: string;
  value: React.ReactNode;
  delta?: { value: string; tone: "up" | "down" | "flat" };
  description?: string;
  icon?: React.ReactNode;
  href?: string;
  tone?: "neutral" | "success" | "warning" | "info";
  className?: string;
};

const TONE_RING: Record<NonNullable<FloatingMetricCardProps["tone"]>, string> = {
  neutral: "ring-iw-border",
  success: "ring-[var(--aivo-domain-completion-completed-strong,#16a34a)]/30",
  warning: "ring-amber-300/60",
  info: "ring-[var(--aivo-status-info-strong,#0284c7)]/30",
};

const DELTA_CLASS = {
  up: "text-[var(--aivo-domain-completion-completed-strong,#16a34a)]",
  down: "text-[var(--aivo-status-error-strong,#dc2626)]",
  flat: "text-iw-text-muted",
} as const;

export function FloatingMetricCard({
  label,
  value,
  delta,
  description,
  icon,
  href,
  tone = "neutral",
  className,
}: FloatingMetricCardProps) {
  const Wrapper: React.ElementType = href ? "a" : "div";
  return (
    <Wrapper
      {...(href ? { href } : {})}
      className={clsx(
        "block rounded-iw-card-lg bg-white p-5 sm:p-6",
        "ring-1",
        TONE_RING[tone],
        "shadow-[0_24px_60px_-30px_rgba(15,23,42,0.18)]",
        href ? "transition-transform hover:-translate-y-0.5 hover:shadow-[0_30px_70px_-30px_rgba(15,23,42,0.24)]" : "",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="iw-label uppercase tracking-wider text-iw-text-muted">{label}</p>
        {icon ? <div className="text-iw-text-muted">{icon}</div> : null}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl sm:text-4xl font-extrabold text-iw-text-strong tabular-nums">
          {value}
        </p>
        {delta ? (
          <span className={clsx("text-sm font-semibold", DELTA_CLASS[delta.tone])}>
            {delta.value}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mt-2 text-sm text-iw-text-muted leading-snug">{description}</p>
      ) : null}
    </Wrapper>
  );
}
FloatingMetricCard.displayName = "Hero/FloatingMetricCard";
