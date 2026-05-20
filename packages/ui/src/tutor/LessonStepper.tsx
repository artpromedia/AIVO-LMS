"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Tutor/LessonStepper
 *
 * Calm horizontal progress for the beat-by-beat lesson player. Each
 * beat is a soft pill with the beat label. Completed beats fill, the
 * active beat highlights, future beats stay muted.
 *
 * Renders an aria-progressbar with the numeric step.
 */
export interface LessonBeat {
  /** Stable id per beat. */
  id: string;
  /** Short label (welcome / story / micro / example / guided / check / wrap). */
  label: React.ReactNode;
}

export interface LessonStepperProps {
  beats: ReadonlyArray<LessonBeat>;
  /** 0-based index of the current beat. */
  current: number;
  className?: string;
}

export function LessonStepper({ beats, current, className }: LessonStepperProps) {
  const valueNow = Math.min(current + 1, beats.length);
  return (
    <ol
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={beats.length}
      aria-valuenow={valueNow}
      className={cn("flex items-center gap-1.5 overflow-x-auto py-1", className)}
    >
      {beats.map((b, i) => {
        const state = i < current ? "done" : i === current ? "active" : "upcoming";
        return (
          <li key={b.id} className="contents">
            <span
              aria-current={state === "active" ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-iw-chip text-[11px] font-semibold whitespace-nowrap transition-colors",
                state === "done" &&
                  "bg-[var(--aivo-sensory-primary)] text-white",
                state === "active" &&
                  "bg-white text-[var(--aivo-sensory-primary)] border border-[var(--aivo-sensory-primary)]",
                state === "upcoming" &&
                  "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted",
              )}
            >
              <span aria-hidden="true" className="tabular-nums">
                {state === "done" ? "✓" : i + 1}
              </span>
              {b.label}
            </span>
            {i < beats.length - 1 ? (
              <span
                aria-hidden="true"
                className="w-3 h-px bg-iw-border"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

LessonStepper.displayName = "Tutor/LessonStepper";
