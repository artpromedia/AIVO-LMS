"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/LearnerChoiceCard
 *
 * One large, touch-friendly answer card. Each card wraps a native
 * radio input so the form posts back without client JS. Designed
 * with big tap targets (min 56px) so younger learners and motor-
 * impaired learners can hit the answer comfortably.
 *
 * Numbered leading badge ("A", "B", "C") is optional — pass `index`
 * for an auto-letter, or `lead` for a custom node (emoji, image).
 */
export interface LearnerChoiceCardProps {
  /** Form field name (all cards in a question share this). */
  name: string;
  /** The value posted when selected. */
  value: string;
  /** Visible answer text. */
  label: React.ReactNode;
  /** Optional 0-based index — renders A / B / C / D auto-letter. */
  index?: number;
  /** Override the leading badge with a custom node. */
  lead?: React.ReactNode;
  /** Default-checked (for restore). */
  defaultChecked?: boolean;
  /** Disabled state (used after submit while the next card is loading). */
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

function letter(i: number): string {
  return String.fromCharCode(65 + (i % 26));
}

export function LearnerChoiceCard({
  name,
  value,
  label,
  index,
  lead,
  defaultChecked,
  disabled,
  required,
  className,
}: LearnerChoiceCardProps) {
  const [checked, setChecked] = React.useState(Boolean(defaultChecked));
  return (
    <label
      className={cn(
        "group relative flex items-center gap-4 cursor-pointer select-none",
        "rounded-iw-card-lg border-2 bg-white p-4 md:p-5 min-h-[64px] transition-all duration-150",
        "hover:border-[var(--aivo-color-aivoPurple-200)] hover:bg-[var(--aivo-color-aivoPurple-50)]/40",
        checked
          ? "border-[var(--aivo-sensory-primary)] bg-[var(--aivo-color-aivoPurple-50)] shadow-[0_2px_8px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.12)]"
          : "border-iw-border",
        disabled && "opacity-50 pointer-events-none",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--aivo-sensory-ringFocus)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--aivo-color-surface-canvas)]",
        className,
      )}
    >
      <input
        type="radio"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        disabled={disabled}
        required={required}
        onChange={(e) => setChecked(e.currentTarget.checked)}
        className="sr-only"
      />
      <span
        className={cn(
          "shrink-0 w-10 h-10 rounded-iw-control flex items-center justify-center",
          "text-base font-bold transition-colors",
          checked
            ? "bg-[var(--aivo-sensory-primary)] text-white"
            : "bg-[var(--aivo-color-surface-muted)] text-iw-text-strong",
        )}
        aria-hidden="true"
      >
        {lead ?? (typeof index === "number" ? letter(index) : null)}
      </span>
      <span className="flex-1 text-base md:text-lg text-iw-text-strong leading-relaxed">
        {label}
      </span>
      {checked ? (
        <span
          className="shrink-0 w-6 h-6 rounded-full bg-[var(--aivo-sensory-primary)] text-white inline-flex items-center justify-center"
          aria-hidden="true"
        >
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 8 7 12 13 4" />
          </svg>
        </span>
      ) : null}
    </label>
  );
}

LearnerChoiceCard.displayName = "Baseline/LearnerChoiceCard";
