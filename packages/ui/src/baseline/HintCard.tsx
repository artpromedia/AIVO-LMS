"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/HintCard
 *
 * Collapsible hint shown under a question. Default-collapsed so the
 * learner makes their own attempt first; expanding reveals the hint
 * and (optionally) emits the `onReveal` callback so the host page
 * can record that a hint was used.
 *
 * Per Sprint 6 spec the policy may be teacher-controlled. When
 * `policy === "locked"` the card renders as a quiet pill explaining
 * the hint is unavailable for this question — the same shape just
 * non-interactive.
 */
export type HintPolicy = "available" | "auto_reveal" | "locked";

export interface HintCardProps {
  hint: React.ReactNode;
  policy?: HintPolicy;
  /** Fires once the first time the hint is revealed. */
  onReveal?: () => void;
  /** Optional label override for the collapsed state. */
  collapsedLabel?: React.ReactNode;
  className?: string;
}

export function HintCard({
  hint,
  policy = "available",
  onReveal,
  collapsedLabel,
  className,
}: HintCardProps) {
  const [open, setOpen] = React.useState(policy === "auto_reveal");
  const fired = React.useRef(false);

  React.useEffect(() => {
    if (open && !fired.current) {
      fired.current = true;
      onReveal?.();
    }
  }, [open, onReveal]);

  if (policy === "locked") {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-2 rounded-iw-chip px-3 py-1.5 text-xs font-medium",
          "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted border border-iw-border",
          className,
        )}
      >
        <svg
          className="w-3.5 h-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Hints are off for this question
      </p>
    );
  }

  return (
    <div
      className={cn(
        "rounded-iw-card border bg-white overflow-hidden",
        open ? "border-[var(--aivo-color-aivoPurple-200)]" : "border-iw-border",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-3 text-sm font-semibold",
          "text-iw-text-strong hover:bg-[var(--aivo-color-aivoPurple-50)]/30",
          "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-inset",
        )}
      >
        <span className="flex items-center gap-2">
          <span
            className="shrink-0 w-7 h-7 rounded-full bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] inline-flex items-center justify-center"
            aria-hidden="true"
          >
            <svg
              className="w-3.5 h-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18h6" />
              <path d="M10 22h4" />
              <path d="M2 12a10 10 0 0 1 20 0c0 4.5-3.5 6-5 8h-10c-1.5-2-5-3.5-5-8z" />
            </svg>
          </span>
          {collapsedLabel ?? (open ? "Hide hint" : "Need a hint?")}
        </span>
        <svg
          className={cn("w-4 h-4 transition-transform", open ? "rotate-180" : "rotate-0")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open ? (
        <div className="px-4 pb-4 text-sm text-iw-text-strong leading-relaxed bg-[var(--aivo-color-aivoPurple-50)]/30">
          {hint}
          <p className="text-[11px] text-iw-text-muted mt-2">
            AIVO knows you used a hint — that's normal and helpful. No grade penalty.
          </p>
        </div>
      ) : null}
    </div>
  );
}

HintCard.displayName = "Baseline/HintCard";
