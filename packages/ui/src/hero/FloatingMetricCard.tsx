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

const TONE_ACCENT: Record<NonNullable<FloatingMetricCardProps["tone"]>, string> = {
  neutral: "from-iw-raised to-white",
  success: "from-[var(--aivo-domain-completion-completed-strong,#16a34a)]/15 to-white",
  warning: "from-iw-warning-subtle/40 to-white",
  info: "from-[var(--aivo-color-aivoTeal-100,#ccfbf1)]/70 to-white",
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
        "relative block overflow-hidden rounded-iw-hero bg-white p-6 sm:p-7",
        "shadow-[0_30px_80px_-40px_rgba(15,23,42,0.22)]",
        href
          ? "transition-transform hover:-translate-y-0.5 hover:shadow-[0_36px_90px_-40px_rgba(15,23,42,0.28)]"
          : "",
        className,
      )}
    >
      <div
        aria-hidden
        className={clsx(
          "pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-gradient-to-br opacity-80 blur-2xl",
          TONE_ACCENT[tone],
        )}
      />
      <div className="relative flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-iw-text-muted">{label}</p>
        {icon ? <div className="text-iw-text-muted">{icon}</div> : null}
      </div>
      <div className="relative mt-3 flex items-baseline gap-2">
        <p className="font-iw-display text-4xl sm:text-5xl font-bold tracking-tight text-iw-text-strong tabular-nums">
          {value}
        </p>
        {delta ? (
          <span className={clsx("text-sm font-semibold", DELTA_CLASS[delta.tone])}>
            {delta.value}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="relative mt-3 text-sm text-iw-text-muted leading-snug">{description}</p>
      ) : null}
    </Wrapper>
  );
}
FloatingMetricCard.displayName = "Hero/FloatingMetricCard";
