"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/BaselinePendingCard
 *
 * Shown immediately after assessment submit while AIVO generates the
 * custom baseline. Communicates *why* the baseline is personalized
 * (parent answers + optional IEP supports) so the parent never
 * suspects a generic mock quiz is about to be served to their child.
 *
 * The progress bar is indeterminate by default — pass a numeric
 * `progress` (0–100) to show concrete progress when the generation
 * service reports it.
 */
export interface BaselinePendingCardProps {
  /** Learner name (so the screen feels personal). */
  learnerName?: React.ReactNode;
  /** Optional headline override. */
  title?: React.ReactNode;
  /** Optional body override. */
  body?: React.ReactNode;
  /** 0-100 progress; omit for indeterminate. */
  progress?: number;
  /** Inputs visualised as little tags ("Parent assessment", "IEP supports"). */
  inputs?: ReadonlyArray<React.ReactNode>;
  /** Optional secondary action (e.g. "Check progress later"). */
  secondary?: React.ReactNode;
  /** Expected wait estimate ("Usually under 2 minutes."). */
  estimate?: React.ReactNode;
  className?: string;
}

export function BaselinePendingCard({
  learnerName,
  title,
  body,
  progress,
  inputs,
  secondary,
  estimate,
  className,
}: BaselinePendingCardProps) {
  const isIndeterminate = typeof progress !== "number";
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "rounded-iw-card-lg border border-iw-border bg-white",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-6 md:p-10 flex flex-col gap-6",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "shrink-0 w-12 h-12 rounded-iw-control flex items-center justify-center",
            "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-sensory-primary,#7c3aed)]",
          )}
          aria-hidden="true"
        >
          <svg
            className="w-6 h-6 motion-safe:animate-spin"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animationDuration: "4s" }}
          >
            <path d="M12 2a10 10 0 1 0 10 10" />
            <path d="M12 6v6l4 2" />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="text-2xl md:text-[28px] font-semibold text-iw-text-strong leading-snug">
            {title ?? (
              <>Building {learnerName ? <span>{learnerName}'s</span> : null} custom baseline</>
            )}
          </h1>
          <p className="text-sm md:text-base text-iw-text-muted leading-relaxed max-w-2xl">
            {body ??
              "We're shaping a baseline check that's tuned to your answers and any supports we extracted from the IEP. No generic quiz — every question is selected for your learner."}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isIndeterminate ? undefined : pct}
          aria-label="Baseline generation progress"
          className="relative h-2 rounded-full bg-[var(--aivo-color-surface-muted,#e2e8f0)] overflow-hidden"
        >
          {isIndeterminate ? (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--aivo-sensory-primary,#7c3aed)] aivo-motion-indeterminate"
            />
          ) : (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 rounded-full bg-[var(--aivo-sensory-primary,#7c3aed)] transition-[width] duration-300"
              style={{ width: `${pct}%` }}
            />
          )}
        </div>
        {estimate ? <p className="text-xs text-iw-text-muted">{estimate}</p> : null}
      </div>

      {inputs && inputs.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-iw-text-muted">
            Personalized from
          </p>
          <div className="flex flex-wrap gap-2">
            {inputs.map((tag, i) => (
              <span
                key={i}
                className={cn(
                  "inline-flex items-center px-2.5 py-1 rounded-iw-chip text-xs font-semibold",
                  "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-color-aivoPurple-700,#6d28d9)]",
                  "border border-[var(--aivo-color-aivoPurple-100,#ede9fe)]",
                )}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {secondary ? <div className="flex">{secondary}</div> : null}
    </section>
  );
}

BaselinePendingCard.displayName = "Assessment/BaselinePendingCard";
