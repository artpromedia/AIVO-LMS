"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/AssessmentFooter
 *
 * The action row pinned at the bottom of every QuestionCard. Renders
 * Back / Save & exit / Next-or-Submit. Designed to compose with native
 * form submit buttons so the assessment works without client JS.
 *
 * Pass in `back` / `saveExit` / `primary` as ReactNode (typically
 * <button type="submit" name="..." value="...">). Use `primaryLabel`
 * for a shortcut that renders the default purple AIVO submit button.
 */
export interface AssessmentFooterProps {
  /** Back / previous step element (typically a Link or submit button). */
  back?: React.ReactNode;
  /** Optional "Save & exit" element. */
  saveExit?: React.ReactNode;
  /** Custom primary (submit) element. Takes precedence over primaryLabel. */
  primary?: React.ReactNode;
  /** Quick-config: render a default purple submit button with this label. */
  primaryLabel?: React.ReactNode;
  /** Disable the default primary button. */
  primaryDisabled?: boolean;
  className?: string;
}

export function AssessmentFooter({
  back,
  saveExit,
  primary,
  primaryLabel,
  primaryDisabled,
  className,
}: AssessmentFooterProps) {
  return (
    <div className={cn("flex w-full items-center justify-between gap-3 flex-wrap", className)}>
      <div className="flex items-center gap-2">
        {back}
        {saveExit}
      </div>
      <div className="flex items-center gap-2">
        {primary ??
          (primaryLabel ? (
            <button
              type="submit"
              disabled={primaryDisabled}
              className={cn(
                "inline-flex items-center gap-2 rounded-iw-control px-5 py-2.5",
                "text-sm font-semibold text-white",
                "bg-[var(--aivo-sensory-primary,#7c3aed)]",
                "hover:brightness-110 active:brightness-95",
                "shadow-[0_2px_6px_rgba(124,58,237,0.18)]",
                "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus:ring-offset-2 focus:ring-offset-white",
                "disabled:opacity-50 disabled:pointer-events-none",
              )}
            >
              {primaryLabel}
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M5 12h14" />
                <path d="m13 5 7 7-7 7" />
              </svg>
            </button>
          ) : null)}
      </div>
    </div>
  );
}

AssessmentFooter.displayName = "Assessment/AssessmentFooter";

/**
 * Helper button styles used by Back / Save&exit. Exported so flows can
 * keep visual consistency without re-deriving these classes.
 */
export const ASSESSMENT_BACK_CLASS = cn(
  "inline-flex items-center gap-1.5 rounded-iw-control px-4 py-2.5",
  "text-sm font-semibold text-iw-text-strong",
  "bg-white border border-iw-border",
  "hover:bg-[var(--aivo-color-surface-muted,#f1f5f9)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus:ring-offset-2 focus:ring-offset-white",
);

export const ASSESSMENT_GHOST_CLASS = cn(
  "inline-flex items-center gap-1.5 rounded-iw-control px-3 py-2",
  "text-sm font-medium text-iw-text-muted",
  "hover:text-iw-text-strong hover:bg-[var(--aivo-color-surface-muted,#f1f5f9)]",
  "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus:ring-offset-2 focus:ring-offset-white",
);
