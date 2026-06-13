"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/ReadAloudButton
 *
 * Soft pill that toggles read-aloud for the current question. The
 * actual audio playback is provided by the surrounding TTS adapter
 * (lib/tts in apps/web-v2) — this component only owns the button
 * state and the aria-pressed contract.
 *
 * Pass `playing` + `onToggle` to drive it from a controlling
 * component. For SSR-friendly fallback the button works as a
 * link to a `?read=on` URL if `href` is supplied.
 */
export interface ReadAloudButtonProps {
  /** Whether audio is currently playing. */
  playing?: boolean;
  /** Callback when the user clicks. Omit for uncontrolled. */
  onToggle?: () => void;
  /** Server-rendered fallback link (preserves SSR a11y). */
  href?: string;
  /** Disable (e.g. no readAloudText for this question). */
  disabled?: boolean;
  /** Optional short label override ("Read aloud" / "Stop"). */
  label?: React.ReactNode;
  className?: string;
  /**
   * Sprint C-15 — opt into switch/AAC scanning. When set, the rendered
   * control carries `data-scan-target` + `data-scan-action="read-aloud"` so
   * the baseline scan controller activates the spoken read-aloud instead of
   * following the SSR `href`. `scanReadText` is the text the scanner speaks.
   */
  scanTargetId?: string;
  scanLabel?: string;
  scanReadText?: string;
}

export function ReadAloudButton({
  playing,
  onToggle,
  href,
  disabled,
  label,
  className,
  scanTargetId,
  scanLabel,
  scanReadText,
}: ReadAloudButtonProps) {
  const ariaLabel = playing ? "Stop reading aloud" : "Read this aloud";
  const scanProps = scanTargetId
    ? {
        "data-scan-target": scanTargetId,
        "data-scan-action": "read-aloud",
        "data-scan-label": scanLabel,
        "data-scan-read": scanReadText,
      }
    : undefined;
  const content = (
    <>
      <span
        className={cn(
          "shrink-0 w-7 h-7 rounded-full flex items-center justify-center",
          playing
            ? "bg-white text-[var(--aivo-sensory-primary)]"
            : "bg-[var(--aivo-sensory-primary)] text-white",
        )}
        aria-hidden="true"
      >
        {playing ? (
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
        )}
      </span>
      <span>{label ?? (playing ? "Stop" : "Read aloud")}</span>
    </>
  );

  const baseClass = cn(
    "inline-flex items-center gap-2 rounded-iw-chip px-3 py-1.5 text-sm font-semibold",
    "transition-colors duration-150",
    playing
      ? "bg-[var(--aivo-sensory-primary)] text-white"
      : "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border border-[var(--aivo-color-aivoPurple-100)]",
    "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white",
    disabled && "opacity-50 pointer-events-none",
    className,
  );

  if (href) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        aria-pressed={playing || undefined}
        className={baseClass}
        {...scanProps}
      >
        {content}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={playing || undefined}
      className={baseClass}
      {...scanProps}
    >
      {content}
    </button>
  );
}

ReadAloudButton.displayName = "Baseline/ReadAloudButton";
