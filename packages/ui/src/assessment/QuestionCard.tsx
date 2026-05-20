"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/QuestionCard
 *
 * The single large rounded card that owns one logical question group
 * per screen. Composes a calm header (eyebrow + headline + helper),
 * the question body, and a sticky-feeling action row pinned to the
 * bottom of the card.
 *
 * This is intentionally distinct from `Surface/GlassCard` because the
 * assessment cards have a softer presence (warm canvas + extra
 * breathing room) and an opinionated typography rhythm. Don't reach
 * for GlassCard inside the assessment flow — use this.
 */
export interface QuestionCardProps {
  /** Small uppercase label above the headline (e.g. "Reading"). */
  eyebrow?: React.ReactNode;
  /** The question headline. Keep under ~70 chars. */
  title: React.ReactNode;
  /** Optional helper / framing sentence under the title. */
  helper?: React.ReactNode;
  /** Optional micro-tag rendered inline next to the eyebrow (e.g. "Optional"). */
  tag?: React.ReactNode;
  /** Question body — pills, inputs, etc. */
  children: React.ReactNode;
  /** Action row pinned to the bottom of the card (back / next). */
  actions?: React.ReactNode;
  /** Optional in-card error message (shown above actions). */
  error?: React.ReactNode;
  className?: string;
}

export function QuestionCard({
  eyebrow,
  title,
  helper,
  tag,
  children,
  actions,
  error,
  className,
}: QuestionCardProps) {
  return (
    <section
      className={cn(
        "rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-5 md:p-8 flex flex-col gap-6",
        className,
      )}
      aria-live="polite"
    >
      <header className="flex flex-col gap-2.5">
        {(eyebrow || tag) && (
          <div className="flex items-center gap-2 flex-wrap">
            {eyebrow ? (
              <p className="iw-label text-iw-text-muted">{eyebrow}</p>
            ) : null}
            {tag ? (
              <span
                className={cn(
                  "inline-flex items-center px-2 py-0.5 rounded-iw-chip",
                  "text-[10px] font-semibold uppercase tracking-wide",
                  "bg-[var(--aivo-color-aivoTeal-50,#f0fdfa)] text-[var(--aivo-color-aivoTeal-700,#0f766e)]",
                )}
              >
                {tag}
              </span>
            ) : null}
          </div>
        )}
        <h1 className="text-2xl md:text-[28px] leading-snug font-semibold text-iw-text-strong">
          {title}
        </h1>
        {helper ? (
          <p className="text-sm md:text-base text-iw-text-muted leading-relaxed max-w-2xl">
            {helper}
          </p>
        ) : null}
      </header>

      <div className="flex flex-col gap-4">{children}</div>

      {error ? (
        <p
          role="alert"
          className={cn(
            "rounded-iw-card border px-3 py-2 text-sm",
            "border-[var(--aivo-color-status-error-default,#fecaca)]",
            "bg-[var(--aivo-color-status-error-subtle,#fef2f2)]",
            "text-[var(--aivo-color-status-error-strong,#b91c1c)]",
          )}
        >
          {error}
        </p>
      ) : null}

      {actions ? (
        <footer className="flex items-center justify-between gap-3 pt-2 border-t border-iw-border">
          {actions}
        </footer>
      ) : null}
    </section>
  );
}

QuestionCard.displayName = "Assessment/QuestionCard";
