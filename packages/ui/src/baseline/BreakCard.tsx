"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/BreakCard
 *
 * Calm break / pause screen rendered between question blocks. The
 * card explains why a break is good, offers a single primary
 * "Resume" action, and shows a friendly count of progress so the
 * learner sees how far they've come.
 *
 * No timers. No countdown. Breaks end when the learner says so.
 *
 * Two variants:
 *  - `cadence` (default): a routine "every few questions" pause. Upbeat
 *    "nice work" headline + moon icon.
 *  - `struggle`: shown when a run of tricky items triggered the break. The
 *    headline and icon soften, and the host passes a one-line, shame-free
 *    `title`/`body` (e.g. "Some of those were tricky — that's exactly when a
 *    breath helps."). The card NEVER renders or implies a wrong-answer count.
 *
 * Copy is always supplied by the host (i18n) via `title` / `body`; the
 * variant only chooses the icon + the built-in headline fallback tone.
 */
export type BreakCardVariant = "cadence" | "struggle";

export interface BreakCardProps {
  /** Which break this is — chooses icon + headline tone. Default `cadence`. */
  variant?: BreakCardVariant;
  /** Learner first name for the friendly headline. */
  learnerName?: React.ReactNode;
  /** Questions completed so far. */
  answered: number;
  /** Total questions. */
  total: number;
  /** Primary resume action — typically a form submit button or Link. */
  resume: React.ReactNode;
  /** Optional secondary action (e.g. "End for today"). */
  secondary?: React.ReactNode;
  /** Optional headline override (i18n). Falls back to a per-variant default. */
  title?: React.ReactNode;
  /** Optional custom body copy (i18n). */
  body?: React.ReactNode;
  className?: string;
}

export function BreakCard({
  variant = "cadence",
  learnerName,
  answered,
  total,
  resume,
  secondary,
  title,
  body,
  className,
}: BreakCardProps) {
  const isStruggle = variant === "struggle";
  return (
    <section
      data-variant={variant}
      className={cn(
        "rounded-iw-hero bg-gradient-to-br from-[var(--aivo-color-aivoTeal-50)] via-white to-[var(--aivo-color-aivoPurple-50)]",
        "border border-iw-border shadow-[0_24px_64px_-24px_rgb(from_var(--aivo-color-aivoTeal-400)_r_g_b_/_0.18)]",
        "p-6 md:p-10 flex flex-col gap-6 items-center text-center",
        className,
      )}
    >
      <span
        className="w-16 h-16 rounded-2xl bg-white shadow-[0_4px_16px_rgb(from_var(--aivo-color-aivoTeal-400)_r_g_b_/_0.18)] inline-flex items-center justify-center text-[var(--aivo-color-aivoTeal-700)]"
        aria-hidden="true"
      >
        {isStruggle ? (
          // A warm heart — softens the moment without naming difficulty.
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        ) : (
          <svg
            className="w-8 h-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        )}
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong">
          {title ??
            (isStruggle ? (
              <>Let&apos;s take a breath together.</>
            ) : learnerName ? (
              <>Nice work, {learnerName} — take a breath.</>
            ) : (
              "Take a breath."
            ))}
        </h1>
        <p className="text-sm md:text-base text-iw-text-muted max-w-md leading-relaxed">
          {body ??
            "Stretch, sip some water, look out the window. AIVO will be here when you're ready. No clock."}
        </p>
      </div>

      <div
        className="flex items-center gap-3 rounded-iw-card bg-white/80 border border-iw-border px-4 py-2.5"
        aria-label={`Progress: ${answered} of ${total}`}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-iw-text-muted">
          Done so far
        </span>
        <span className="text-lg font-semibold tabular-nums text-iw-text-strong">
          {answered}
          <span className="text-iw-text-muted">/{total}</span>
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap justify-center">
        {resume}
        {secondary}
      </div>
    </section>
  );
}

BreakCard.displayName = "Baseline/BreakCard";
