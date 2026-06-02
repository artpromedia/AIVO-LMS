"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * LearnerHome/TodayFocusCard
 *
 * The "Continue learning" / today's focus card on the learner home.
 * One primary action — Sprint 7 spec is firm that the learner knows
 * exactly what to do next.
 *
 * Slot model:
 *   - eyebrow (e.g. "Continue · Reading")
 *   - title   (skill name)
 *   - body    (one-line learner reason)
 *   - meta    (chips: time estimate, tutor, support)
 *   - action  (one CTA — Start / Resume / Pause)
 */
export interface TodayFocusCardProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  meta?: React.ReactNode;
  action: React.ReactNode;
  /** Accent for the soft side bar. */
  accent?: string;
  /** Optional companion (tutor avatar). */
  companion?: React.ReactNode;
  className?: string;
}

export function TodayFocusCard({
  eyebrow,
  title,
  body,
  meta,
  action,
  accent = "var(--aivo-sensory-primary)",
  companion,
  className,
}: TodayFocusCardProps) {
  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-5 md:p-6 flex flex-col gap-4",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-0 bottom-0 w-1.5 rounded-l-iw-card-lg"
        style={{ backgroundColor: accent }}
      />
      <header className="flex items-start gap-4">
        {companion ? <div aria-hidden="true">{companion}</div> : null}
        <div className="flex-1 min-w-0">
          {eyebrow ? <p className="iw-label text-iw-text-muted truncate">{eyebrow}</p> : null}
          <h2 className="text-xl md:text-2xl font-semibold text-iw-text-strong leading-snug">
            {title}
          </h2>
          {body ? (
            <p className="text-sm md:text-base text-iw-text-muted leading-relaxed mt-1">{body}</p>
          ) : null}
        </div>
      </header>
      {meta ? <div className="flex items-center gap-2 flex-wrap">{meta}</div> : null}
      <footer className="flex">{action}</footer>
    </article>
  );
}

TodayFocusCard.displayName = "LearnerHome/TodayFocusCard";
