"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/AssessmentShell
 *
 * The page canvas for the parent assessment + IEP upload flow. Same
 * soft-tinted background as Auth/AuthShell so the parent never feels
 * like they crossed into a "medical form" surface. One visible card
 * per screen — the shell holds progress + the card + the reassurance
 * column.
 *
 * Two-column on >= md (card on the left, reassurance on the right).
 * Single-column on small screens with reassurance stacked below the
 * primary actions so it never pushes the CTA off-screen.
 */
export interface AssessmentShellProps {
  /** Progress / stepper rendered above the card. */
  progress?: React.ReactNode;
  /** Eyebrow over the title (e.g. learner name). */
  eyebrow?: React.ReactNode;
  /** Primary question card. */
  children: React.ReactNode;
  /** Floating reassurance / privacy column. */
  reassurance?: React.ReactNode;
  /** Optional save indicator rendered above the card on the right. */
  saveIndicator?: React.ReactNode;
  className?: string;
}

export function AssessmentShell({
  progress,
  eyebrow,
  children,
  reassurance,
  saveIndicator,
  className,
}: AssessmentShellProps) {
  return (
    <main
      className={cn(
        "relative min-h-[100dvh] w-full",
        "bg-[var(--aivo-color-surface-canvas,#f4f6f5)]",
        "px-4 py-6 md:px-8 md:py-10",
        className,
      )}
    >
      <div className="mx-auto w-full max-w-6xl flex flex-col gap-6">
        {(progress || saveIndicator || eyebrow) && (
          <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1 min-w-0">
              {eyebrow ? <p className="iw-label text-iw-text-muted truncate">{eyebrow}</p> : null}
              {progress}
            </div>
            {saveIndicator ? (
              <div className="shrink-0 text-xs text-iw-text-muted">{saveIndicator}</div>
            ) : null}
          </header>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">{children}</div>
          {reassurance ? (
            <aside className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
              {reassurance}
            </aside>
          ) : null}
        </div>
      </div>
    </main>
  );
}

AssessmentShell.displayName = "Assessment/AssessmentShell";
