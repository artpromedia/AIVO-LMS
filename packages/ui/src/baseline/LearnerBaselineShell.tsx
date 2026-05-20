"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/LearnerBaselineShell
 *
 * The page canvas for the learner-side baseline assessment. Same
 * soft canvas as the parent AssessmentShell but tuned for a single
 * learner staring at one card at a time:
 *  - no role nav (the learner is in protected focus mode)
 *  - top bar with optional ProctorBanner and a calm "exit / pause" slot
 *  - one wide content column with a max-width that keeps lines short
 *
 * Reduced-motion friendly. The shell holds layout only — every visual
 * decision lives in the child cards.
 */
export interface LearnerBaselineShellProps {
  /** Optional banner at the very top (e.g. ProctorBanner). */
  topBanner?: React.ReactNode;
  /** Left-aligned header slot — usually a back/exit chip. */
  headerLeft?: React.ReactNode;
  /** Right-aligned header slot — usually progress + pause. */
  headerRight?: React.ReactNode;
  /** Main content — a single LearnerQuestionCard or hero. */
  children: React.ReactNode;
  /** Floating status chips slot — rendered above the question card. */
  status?: React.ReactNode;
  /** Optional bottom bar — typically the submit / continue action. */
  bottomBar?: React.ReactNode;
  className?: string;
}

export function LearnerBaselineShell({
  topBanner,
  headerLeft,
  headerRight,
  children,
  status,
  bottomBar,
  className,
}: LearnerBaselineShellProps) {
  return (
    <div
      className={cn(
        "relative min-h-[100dvh] flex flex-col",
        "bg-[var(--aivo-color-surface-canvas)]",
        className,
      )}
    >
      {topBanner}
      <header className="sticky top-0 z-10 bg-[var(--aivo-color-surface-canvas)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--aivo-color-surface-canvas)]/70 border-b border-iw-border">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2">{headerLeft}</div>
          <div className="shrink-0 flex items-center gap-2">{headerRight}</div>
        </div>
      </header>

      <main className="flex-1 w-full mx-auto max-w-4xl px-4 py-6 md:py-10 flex flex-col gap-6">
        {status ? (
          <div className="flex flex-wrap gap-2" role="status" aria-live="polite">
            {status}
          </div>
        ) : null}
        {children}
      </main>

      {bottomBar ? (
        <footer className="sticky bottom-0 bg-white/95 backdrop-blur border-t border-iw-border">
          <div className="mx-auto w-full max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
            {bottomBar}
          </div>
        </footer>
      ) : null}
    </div>
  );
}

LearnerBaselineShell.displayName = "Baseline/LearnerBaselineShell";
