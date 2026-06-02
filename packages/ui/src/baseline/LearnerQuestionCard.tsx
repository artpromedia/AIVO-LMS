"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/LearnerQuestionCard
 *
 * The single large card that holds one baseline question. Designed
 * for one-question-at-a-time learners but supports a `split` layout
 * for older learners (reading passage on the left, prompt on the
 * right).
 *
 * - Big rounded card, generous padding, no clinical chrome.
 * - Question prompt rendered at xl font size, line-height loose.
 * - Optional companion slot in the header (tutor avatar / orb).
 * - Body slot is where answer choices live.
 * - Footer slot is for submit + skip + read-aloud.
 *
 * No grades or "score" affordances — this card never shows
 * correct/incorrect feedback during the run. That belongs in
 * CompletionHero.
 */
export interface LearnerQuestionCardProps {
  /** Question prompt — kept large and readable. */
  prompt: React.ReactNode;
  /** Subject / tutor / domain label rendered above the prompt. */
  eyebrow?: React.ReactNode;
  /** Optional companion (tutor avatar, AIVO orb). */
  companion?: React.ReactNode;
  /** Optional passage / context shown left of prompt on `split`. */
  passage?: React.ReactNode;
  /** Layout — `single` (default) or `split` (passage + prompt). */
  layout?: "single" | "split";
  /** Answer area (choices, input, etc.). */
  children: React.ReactNode;
  /** Sticky bottom slot inside the card — submit / skip / hint controls. */
  footer?: React.ReactNode;
  /** Optional inline read-aloud control rendered above the prompt. */
  readAloud?: React.ReactNode;
  className?: string;
}

export function LearnerQuestionCard({
  prompt,
  eyebrow,
  companion,
  passage,
  layout = "single",
  children,
  footer,
  readAloud,
  className,
}: LearnerQuestionCardProps) {
  return (
    <article
      className={cn(
        "rounded-iw-hero bg-white border border-iw-border",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-5 md:p-8 lg:p-10 flex flex-col gap-6",
        className,
      )}
    >
      {(eyebrow || companion || readAloud) && (
        <header className="flex items-center gap-3 flex-wrap">
          {companion ? (
            <div className="shrink-0" aria-hidden="true">
              {companion}
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            {eyebrow ? <p className="iw-label text-iw-text-muted truncate">{eyebrow}</p> : null}
          </div>
          {readAloud ? <div className="shrink-0">{readAloud}</div> : null}
        </header>
      )}

      <div className={cn(layout === "split" ? "grid gap-6 lg:grid-cols-2" : "flex flex-col gap-6")}>
        {layout === "split" && passage ? (
          <div className="rounded-iw-card border border-iw-border bg-[var(--aivo-color-surface-canvas)]/40 p-5 text-base leading-relaxed text-iw-text-strong">
            {passage}
          </div>
        ) : null}
        <div className="flex flex-col gap-5">
          <h2 className="text-2xl md:text-3xl leading-snug font-semibold text-iw-text-strong">
            {prompt}
          </h2>
          <div className="flex flex-col gap-3">{children}</div>
        </div>
      </div>

      {footer ? (
        <footer className="flex items-center justify-between gap-3 flex-wrap pt-2">{footer}</footer>
      ) : null}
    </article>
  );
}

LearnerQuestionCard.displayName = "Baseline/LearnerQuestionCard";
