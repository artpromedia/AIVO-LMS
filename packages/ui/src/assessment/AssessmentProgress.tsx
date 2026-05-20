"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/AssessmentProgress
 *
 * Soft segmented progress indicator for the parent assessment. Each
 * segment is a rounded pill so the visual never reads like a clinical
 * Likert scale or a "questionnaire bar". Completed steps fill with the
 * AIVO sensory primary, the active step gets a softer tint, and
 * upcoming steps stay at canvas-muted.
 *
 * Rendered above the question card. Pairs with `AssessmentShell.progress`.
 *
 * For sighted users we render the chip row. For assistive tech we
 * always render an aria-valuenow progressbar with the numeric step
 * fraction.
 */
export interface AssessmentProgressProps {
  /** Total number of steps in the flow (segments rendered). */
  total: number;
  /** 0-based index of the current step. */
  current: number;
  /** Optional short label for the current step (e.g. "Strengths"). */
  label?: React.ReactNode;
  /** Optional friendly hint shown next to the label (e.g. "About 2 minutes left"). */
  hint?: React.ReactNode;
  className?: string;
}

export function AssessmentProgress({
  total,
  current,
  label,
  hint,
  className,
}: AssessmentProgressProps) {
  const clampedTotal = Math.max(1, Math.floor(total));
  const clampedCurrent = Math.min(Math.max(0, Math.floor(current)), clampedTotal - 1);
  const valueNow = clampedCurrent + 1;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-iw-text-strong">
          {label ? <span>{label}</span> : null}
          <span className="ml-2 text-xs font-medium text-iw-text-muted tabular-nums">
            Step {valueNow} of {clampedTotal}
          </span>
        </p>
        {hint ? <p className="text-xs text-iw-text-muted">{hint}</p> : null}
      </div>
      <div
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={clampedTotal}
        aria-valuenow={valueNow}
        aria-label={typeof label === "string" ? `Progress: ${label}` : "Assessment progress"}
        className="flex items-center gap-1.5"
      >
        {Array.from({ length: clampedTotal }).map((_, i) => {
          const state = i < clampedCurrent ? "done" : i === clampedCurrent ? "active" : "upcoming";
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cn(
                "h-2 flex-1 rounded-full transition-colors duration-200",
                state === "done" &&
                  "bg-[var(--aivo-sensory-primary,#7c3aed)]",
                state === "active" &&
                  "bg-[var(--aivo-color-aivoPurple-200,#ddd6fe)]",
                state === "upcoming" &&
                  "bg-[var(--aivo-color-surface-muted,#e2e8f0)]",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

AssessmentProgress.displayName = "Assessment/AssessmentProgress";
