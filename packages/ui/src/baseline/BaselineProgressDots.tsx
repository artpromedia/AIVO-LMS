"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/BaselineProgressDots
 *
 * Calm dot-strip progress for the baseline question runner. Each
 * question gets a rounded dot. States:
 *  - answered     — solid purple
 *  - skipped      — outlined purple
 *  - current      — filled white with purple ring + scale-up
 *  - pending      — soft grey
 *
 * No numeric badge unless the learner explicitly opted into a
 * detailed progress view — the dot strip alone is enough for
 * younger learners to feel forward motion.
 */
export type DotState = "answered" | "skipped" | "current" | "pending";

export interface BaselineProgressDotsProps {
  /** Per-question dot state, ordered. */
  states: ReadonlyArray<DotState>;
  /** Optional aria label for the whole strip. */
  ariaLabel?: string;
  /** Show "X of Y" caption under the dots. */
  showCaption?: boolean;
  className?: string;
}

const DOT_CLASS: Record<DotState, string> = {
  answered: "bg-[var(--aivo-sensory-primary)]",
  skipped: "bg-white border-2 border-[var(--aivo-sensory-primary)]",
  current:
    "bg-white ring-2 ring-[var(--aivo-sensory-primary)] ring-offset-2 ring-offset-[var(--aivo-color-surface-canvas)] scale-110",
  pending: "bg-[var(--aivo-color-surface-muted)]",
};

export function BaselineProgressDots({
  states,
  ariaLabel = "Baseline progress",
  showCaption = false,
  className,
}: BaselineProgressDotsProps) {
  const total = states.length;
  const answered = states.filter((s) => s === "answered" || s === "skipped").length;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        aria-label={ariaLabel}
        className="flex items-center gap-1.5 flex-wrap"
      >
        {states.map((s, i) => (
          <span
            key={i}
            aria-hidden="true"
            className={cn("w-2.5 h-2.5 rounded-full transition-all duration-200", DOT_CLASS[s])}
          />
        ))}
      </div>
      {showCaption ? (
        <p className="text-xs text-iw-text-muted tabular-nums">
          {answered} of {total}
        </p>
      ) : null}
    </div>
  );
}

BaselineProgressDots.displayName = "Baseline/BaselineProgressDots";
