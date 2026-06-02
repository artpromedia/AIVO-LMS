"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Auth/LegalCollapse
 *
 * Progressive disclosure for legal text. Renders a one-line summary
 * with a "Read full text" toggle. Avoids the dense legal wall that
 * users always scroll past.
 *
 * Accessibility:
 *   - <details>/<summary> ensures native keyboard support and
 *     screen-reader announcement of the open/closed state.
 *   - The summary is the click target; no JS state needed.
 */
export interface LegalCollapseProps {
  summary: React.ReactNode;
  children: React.ReactNode;
  /** When true, the section starts open. Default false. */
  defaultOpen?: boolean;
  className?: string;
}

export function LegalCollapse({ summary, children, defaultOpen, className }: LegalCollapseProps) {
  return (
    <details
      className={cn(
        "group rounded-iw-control border border-iw-border bg-white",
        "open:bg-[var(--aivo-color-surface-canvas,#f4f6f5)]",
        className,
      )}
      open={defaultOpen}
    >
      <summary
        className={cn(
          "list-none cursor-pointer select-none",
          "px-4 py-3 flex items-center justify-between gap-3",
          "text-sm text-iw-text-strong font-medium",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--aivo-sensory-primary,#7c3aed)] focus-visible:ring-offset-2 rounded-iw-control",
        )}
      >
        <span>{summary}</span>
        <span
          aria-hidden="true"
          className="text-iw-text-muted text-xs font-semibold group-open:hidden"
        >
          Read full
        </span>
        <span
          aria-hidden="true"
          className="text-iw-text-muted text-xs font-semibold hidden group-open:inline"
        >
          Hide
        </span>
      </summary>
      <div className="px-4 pb-4 pt-1 text-xs leading-relaxed text-iw-text-muted">{children}</div>
    </details>
  );
}

LegalCollapse.displayName = "Auth/LegalCollapse";
