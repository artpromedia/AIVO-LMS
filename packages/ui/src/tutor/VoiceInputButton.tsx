"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Tutor/VoiceInputButton
 *
 * Round voice-input button for the tutor chat input bar. Three
 * states: idle / listening / disabled. Listening renders a soft
 * pulsing ring (reduced-motion friendly — collapses to static).
 *
 * Caller drives state via `listening` + `onToggle`. The button
 * always has an aria-pressed + aria-label so screen readers
 * announce the transition.
 */
export interface VoiceInputButtonProps {
  listening?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInputButton({
  listening,
  onToggle,
  disabled,
  className,
}: VoiceInputButtonProps) {
  const label = listening ? "Stop listening" : "Talk to AIVO";
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-pressed={listening || undefined}
      aria-label={label}
      title={label}
      className={cn(
        "relative w-12 h-12 rounded-full inline-flex items-center justify-center",
        "transition-all duration-200",
        listening
          ? "bg-[var(--aivo-sensory-primary)] text-white shadow-[0_8px_24px_-4px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.5)]"
          : "bg-white text-[var(--aivo-sensory-primary)] border border-iw-border hover:bg-[var(--aivo-color-aivoPurple-50)]",
        disabled && "opacity-50 pointer-events-none",
        "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-white",
        className,
      )}
    >
      {listening ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-full bg-[var(--aivo-sensory-primary)]/30 motion-safe:animate-ping"
        />
      ) : null}
      <svg
        className="w-5 h-5 relative"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}

VoiceInputButton.displayName = "Tutor/VoiceInputButton";
