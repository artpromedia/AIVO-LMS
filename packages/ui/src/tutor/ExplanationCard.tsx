"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Tutor/ExplanationCard
 *
 * Soft learning card used inside the lesson player for explanations,
 * worked examples, and misconception corrections. The `kind` prop
 * drives the eyebrow + tint:
 *   - explanation   neutral purple
 *   - example       teal "Let's work through one"
 *   - correction    warm orange "Common mistake"
 *   - definition    neutral grey "Word to know"
 *
 * Each card optionally renders a step number, a citation footer
 * (Sprint 8 spec: school-provided content needs source links), and
 * an aside for read-aloud / save-for-later controls.
 */
export type ExplanationKind = "explanation" | "example" | "correction" | "definition";

export interface ExplanationCardProps {
  kind: ExplanationKind;
  /** Step index (1-based) — rendered as a small badge. */
  step?: number;
  title: React.ReactNode;
  /** Main body — accepts rich content. */
  children: React.ReactNode;
  /** Optional citation row at the bottom. */
  citation?: React.ReactNode;
  /** Right-aligned controls (read-aloud, save). */
  controls?: React.ReactNode;
  className?: string;
}

const KIND_TINT: Record<ExplanationKind, { ribbon: string; eyebrow: React.ReactNode }> = {
  explanation: {
    ribbon: "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)]",
    eyebrow: "Explanation",
  },
  example: {
    ribbon: "bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)]",
    eyebrow: "Let's work through one",
  },
  correction: {
    ribbon: "bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)]",
    eyebrow: "Common mistake",
  },
  definition: {
    ribbon: "bg-[var(--aivo-color-surface-muted)] text-iw-text-strong",
    eyebrow: "Word to know",
  },
};

export function ExplanationCard({
  kind,
  step,
  title,
  children,
  citation,
  controls,
  className,
}: ExplanationCardProps) {
  const tint = KIND_TINT[kind];
  return (
    <article
      className={cn(
        "rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-[0_10px_28px_rgba(60,40,110,0.07)]",
        "p-5 md:p-6 flex flex-col gap-4",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {typeof step === "number" ? (
            <span
              className="shrink-0 w-7 h-7 rounded-iw-control flex items-center justify-center text-xs font-bold tabular-nums bg-[var(--aivo-sensory-primary)] text-white"
              aria-hidden="true"
            >
              {step}
            </span>
          ) : null}
          <span
            className={cn(
              "inline-flex items-center px-2.5 py-1 rounded-iw-chip text-[10px] font-semibold uppercase tracking-wide",
              tint.ribbon,
            )}
          >
            {tint.eyebrow}
          </span>
        </div>
        {controls ? <div className="shrink-0 flex items-center gap-2">{controls}</div> : null}
      </header>
      <h3 className="text-xl md:text-2xl font-semibold text-iw-text-strong leading-snug">
        {title}
      </h3>
      <div className="text-base text-iw-text-strong leading-relaxed">{children}</div>
      {citation ? (
        <footer className="text-xs text-iw-text-muted border-t border-iw-border pt-3">
          {citation}
        </footer>
      ) : null}
    </article>
  );
}

ExplanationCard.displayName = "Tutor/ExplanationCard";
