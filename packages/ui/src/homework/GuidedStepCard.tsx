"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Homework/GuidedStepCard
 *
 * Step in a "guided help" sequence. Sprint 9 spec: AIVO must help
 * the learner understand, not simply give answers. This card
 * progressively reveals scaffolding — a "Try it" prompt first, then
 * a hint if the learner asks, then a worked example, never the bare
 * answer.
 *
 * Stages map to visible state:
 *   try     "First, try this on your own"
 *   hint    a small hint, no solution yet
 *   walk    walk through together
 *   reveal  full step-by-step (requires teacher policy: allowed)
 */
export type GuidedStage = "try" | "hint" | "walk" | "reveal";

export interface GuidedStepCardProps {
  /** 1-based step number rendered as a badge. */
  step: number;
  /** Total steps in the sequence. */
  total: number;
  /** Step title (e.g. "Understand the question"). */
  title: React.ReactNode;
  /** Stage label drives the visible ribbon. */
  stage: GuidedStage;
  /** Main body content (varies per stage). */
  children: React.ReactNode;
  /** Action row at the bottom (e.g. "I think I've got it" / "Show me how"). */
  actions?: React.ReactNode;
  /** When the policy locks reveal, show a small note. */
  revealLockedReason?: React.ReactNode;
  className?: string;
}

const STAGE: Record<GuidedStage, { label: string; ribbon: string }> = {
  try: {
    label: "Try it first",
    ribbon:
      "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]",
  },
  hint: {
    label: "Here's a nudge",
    ribbon:
      "bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] border-[var(--aivo-color-aivoOrange-100)]",
  },
  walk: {
    label: "Let's walk through it",
    ribbon:
      "bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border-[var(--aivo-color-aivoTeal-100)]",
  },
  reveal: {
    label: "Step-by-step",
    ribbon:
      "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)] border-[var(--aivo-color-status-info-default)]",
  },
};

export function GuidedStepCard({
  step,
  total,
  title,
  stage,
  children,
  actions,
  revealLockedReason,
  className,
}: GuidedStepCardProps) {
  const tint = STAGE[stage];
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
          className="shrink-0 w-8 h-8 rounded-iw-control flex items-center justify-center text-xs font-bold tabular-nums bg-[var(--aivo-sensory-primary)] text-white"
          aria-hidden="true"
        >
          {step}
        </span>
        <span className="iw-label text-iw-text-muted">
          Step {step} of {total}
        </span>
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-iw-chip border text-[10px] font-semibold uppercase tracking-wide",
            tint.ribbon,
          )}
        >
          {tint.label}
        </span>
      </header>
      <h3 className="text-xl md:text-2xl font-semibold text-iw-text-strong leading-snug">
        {title}
      </h3>
      <div className="text-base text-iw-text-strong leading-relaxed">{children}</div>
      {revealLockedReason ? (
        <p className="rounded-iw-card border border-iw-border bg-[var(--aivo-color-surface-muted)] px-3 py-2 text-xs text-iw-text-muted">
          {revealLockedReason}
        </p>
      ) : null}
      {actions ? (
        <footer className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-iw-border">
          {actions}
        </footer>
      ) : null}
    </article>
  );
}

GuidedStepCard.displayName = "Homework/GuidedStepCard";
