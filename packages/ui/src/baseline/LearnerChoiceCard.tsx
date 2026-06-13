"use client";
import * as React from "react";
import { cn } from "../utils/cn";
import { LEARNER_PREF_CSS_VARS } from "@aivo/accessibility-contract";

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
  /**
   * Sprint C-15 — opt the card into switch/AAC scanning. When set, the
   * rendered `<label>` carries the `data-scan-target` (+ `data-scan-label`)
   * attributes the baseline scan controller discovers in DOM order. The
   * label is the focus/click surface, so activating the scanned target checks
   * this radio. Omit on surfaces that don't scan (no behavioural change).
   */
  scanTargetId?: string;
  /** Human-readable label announced / spoken when this card is scanned.
   *  Defaults to the string `label` when that is a string. */
  scanLabel?: string;
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
  scanTargetId,
  scanLabel,
}: LearnerChoiceCardProps) {
  const [checked, setChecked] = React.useState(Boolean(defaultChecked));
  const scanProps = scanTargetId
    ? {
        "data-scan-target": scanTargetId,
        "data-scan-label": scanLabel ?? (typeof label === "string" ? label : undefined),
      }
    : undefined;
  return (
    <label
      {...scanProps}
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
      {/*
        Answer label honors the learner's reading prefs (font family, scale,
        spacing) via the same `--learner-*` contract vars as the prompt. The
        card's `min-h-[64px]` floor is unconditional, so the touch target is
        always the LARGER of 64px and the (pref-scaled) content height — a
        larger-text learner gets a taller card, never a smaller one.
      */}
      <span
        data-learner-answer
        className="flex-1 [--answer-base:1rem] md:[--answer-base:1.125rem] text-iw-text-strong"
        style={{
          fontFamily: `var(${LEARNER_PREF_CSS_VARS.fontFamily}, inherit)`,
          fontSize: `calc(var(--answer-base) * var(${LEARNER_PREF_CSS_VARS.fontScale}, 1))`,
          letterSpacing: `var(${LEARNER_PREF_CSS_VARS.letterSpacing}, normal)`,
          lineHeight: `var(${LEARNER_PREF_CSS_VARS.lineHeight}, 1.625)`,
        }}
      >
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
