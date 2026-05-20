"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * States/AIGenerationStatusCard
 *
 * Per Sprint 19, every AI task needs a clear in-flight state that
 * explains what's happening without overpromising. The seven kinds
 * cover the v2 surface: baseline_generating, iep_extracting,
 * lesson_generating, homework_analyzing, tutor_thinking,
 * mastery_updating, report_compiling.
 */
export type AIGenerationKind =
  | "baseline_generating"
  | "iep_extracting"
  | "lesson_generating"
  | "homework_analyzing"
  | "tutor_thinking"
  | "mastery_updating"
  | "report_compiling";

export interface AIGenerationStatusCardProps {
  kind: AIGenerationKind;
  /** Optional override of the headline. */
  title?: React.ReactNode;
  /** Optional override of the body. */
  body?: React.ReactNode;
  /** 0-100 progress; omit for indeterminate. */
  progress?: number;
  /** Estimate copy ("Usually under 2 minutes"). */
  estimate?: React.ReactNode;
  /** Tags showing what's feeding the generation. */
  inputs?: ReadonlyArray<React.ReactNode>;
  /** Secondary action (e.g. "Check back later"). */
  secondary?: React.ReactNode;
  className?: string;
}

const KIND_LABEL: Record<AIGenerationKind, { title: string; body: string }> = {
  baseline_generating: {
    title: "Building the baseline",
    body: "We're shaping a baseline check tuned to the answers you shared.",
  },
  iep_extracting: {
    title: "Reading the document",
    body: "Pulling structured supports out of the IEP. We'll never store diagnosis language.",
  },
  lesson_generating: {
    title: "Drafting the lesson",
    body: "Picking explanations, examples, and practice items from approved curriculum.",
  },
  homework_analyzing: {
    title: "Looking at your homework",
    body: "Figuring out the subject and what you might be stuck on.",
  },
  tutor_thinking: {
    title: "Thinking…",
    body: "Working out how to explain this in a way that lands.",
  },
  mastery_updating: {
    title: "Updating mastery",
    body: "Folding your latest answers into the learning path.",
  },
  report_compiling: {
    title: "Compiling the report",
    body: "Gathering the calm summaries that will show up here in a moment.",
  },
};

export function AIGenerationStatusCard({
  kind,
  title,
  body,
  progress,
  estimate,
  inputs,
  secondary,
  className,
}: AIGenerationStatusCardProps) {
  const labels = KIND_LABEL[kind];
  const isIndeterminate = typeof progress !== "number";
  const pct = Math.max(0, Math.min(100, Math.round(progress ?? 0)));
  return (
    <section
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-5 md:p-8 flex flex-col gap-5",
        className,
      )}
    >
      <header className="flex items-start gap-4">
        <span
          className="shrink-0 w-12 h-12 rounded-2xl bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-sensory-primary)] inline-flex items-center justify-center"
          aria-hidden="true"
        >
          <span className="w-3 h-3 rounded-full bg-[var(--aivo-sensory-primary)] aivo-motion-ai-thinking" />
        </span>
        <div className="flex flex-col gap-1.5 min-w-0">
          <h2 className="text-xl md:text-2xl font-semibold text-iw-text-strong leading-snug">
            {title ?? labels.title}
          </h2>
          <p className="text-sm md:text-base text-iw-text-muted leading-relaxed max-w-2xl">
            {body ?? labels.body}
          </p>
        </div>
      </header>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={isIndeterminate ? undefined : pct}
        aria-label={labels.title}
        className="relative h-2 rounded-full bg-[var(--aivo-color-surface-muted)] overflow-hidden"
      >
        {isIndeterminate ? (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--aivo-sensory-primary)] aivo-motion-indeterminate"
          />
        ) : (
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 rounded-full bg-[var(--aivo-sensory-primary)] transition-[width] duration-300"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {estimate ? <p className="text-xs text-iw-text-muted">{estimate}</p> : null}
      {inputs && inputs.length ? (
        <div className="flex flex-wrap gap-1.5">
          {inputs.map((t, i) => (
            <span
              key={i}
              className="inline-flex items-center px-2.5 py-1 rounded-iw-chip text-xs font-semibold bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border border-[var(--aivo-color-aivoPurple-100)]"
            >
              {t}
            </span>
          ))}
        </div>
      ) : null}
      {secondary ? <div className="flex">{secondary}</div> : null}
    </section>
  );
}

AIGenerationStatusCard.displayName = "States/AIGenerationStatusCard";
