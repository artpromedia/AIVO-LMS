"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Auth/StepperHeader
 *
 * Calm step indicator for multi-step flows (create account, parent
 * setup, learner profile creation). Renders a numbered pill row with
 * the current step filled, completed steps checked, and remaining
 * steps muted.
 *
 * Keep steps to 3–5. If you have more, you have two flows.
 */
export interface StepperStep {
  label: React.ReactNode;
}

export interface StepperHeaderProps {
  steps: ReadonlyArray<StepperStep>;
  /** 0-based index of the current step. */
  current: number;
  className?: string;
}

export function StepperHeader({ steps, current, className }: StepperHeaderProps) {
  return (
    <ol
      className={cn("flex items-center gap-2 flex-wrap", className)}
      aria-label="Progress"
    >
      {steps.map((s, i) => {
        const state =
          i < current ? "done" : i === current ? "active" : "upcoming";
        const cls =
          state === "done"
            ? "bg-[var(--aivo-domain-completion-completed-strong,#047857)] text-white"
            : state === "active"
              ? "bg-[var(--aivo-sensory-primary,#7c3aed)] text-white"
              : "bg-[var(--aivo-color-surface-canvas,#f4f6f5)] text-iw-text-muted border border-iw-border";
        return (
          <li
            key={i}
            className="flex items-center gap-2"
            aria-current={state === "active" ? "step" : undefined}
          >
            <span
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold tabular-nums",
                cls,
              )}
              aria-hidden="true"
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                state === "active"
                  ? "text-iw-text-strong"
                  : "text-iw-text-muted",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden="true"
                className="w-6 h-px bg-iw-border mx-1"
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

StepperHeader.displayName = "Auth/StepperHeader";
