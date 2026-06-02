"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Tutor/PracticeCard
 *
 * A clearly graded-or-ungraded practice question. Sprint 8 requires
 * AI guidance and graded work to read distinctly different — so this
 * card always renders a small visible ribbon: "Practice · not graded"
 * for tutor practice, "Graded check" when an assignment is in play.
 *
 * The card itself is a thin wrapper: pass the question via `prompt`,
 * and any answer UI as children. `evaluation` slot shows result
 * feedback after submit (caller controls visibility).
 */
export type PracticeKind = "practice" | "graded" | "try_it";

export interface PracticeCardProps {
  kind: PracticeKind;
  prompt: React.ReactNode;
  /** Subtitle (e.g. "Try it yourself"). */
  subtitle?: React.ReactNode;
  /** Answer UI — choices, input, etc. */
  children: React.ReactNode;
  /** Footer / action row — typically Submit + Hint. */
  actions?: React.ReactNode;
  /** Evaluation feedback (correct / try again / explanation link). */
  evaluation?: React.ReactNode;
  className?: string;
}

const KIND_RIBBON: Record<PracticeKind, { class: string; label: string }> = {
  practice: {
    class:
      "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]",
    label: "Practice · not graded",
  },
  graded: {
    class:
      "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)] border-[var(--aivo-color-status-warning-default)]",
    label: "Graded check",
  },
  try_it: {
    class:
      "bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border-[var(--aivo-color-aivoTeal-100)]",
    label: "Try it yourself",
  },
};

export function PracticeCard({
  kind,
  prompt,
  subtitle,
  children,
  actions,
  evaluation,
  className,
}: PracticeCardProps) {
  const ribbon = KIND_RIBBON[kind];
  return (
    <article
      className={cn(
        "rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-5 md:p-6 flex flex-col gap-4",
        className,
      )}
    >
      <header className="flex items-center gap-2 flex-wrap">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-iw-chip border text-[11px] font-semibold uppercase tracking-wide",
            ribbon.class,
          )}
        >
          <svg
            className="w-3 h-3"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            {kind === "graded" ? <path d="m9 12 2 2 4-4" /> : <path d="M12 7v6m0 3v.01" />}
          </svg>
          {ribbon.label}
        </span>
        {subtitle ? <p className="text-xs text-iw-text-muted">{subtitle}</p> : null}
      </header>
      <h3 className="text-xl md:text-2xl font-semibold text-iw-text-strong leading-snug">
        {prompt}
      </h3>
      <div className="flex flex-col gap-3">{children}</div>
      {evaluation ? <div>{evaluation}</div> : null}
      {actions ? (
        <footer className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-iw-border">
          {actions}
        </footer>
      ) : null}
    </article>
  );
}

PracticeCard.displayName = "Tutor/PracticeCard";
