"use client";
import * as React from "react";
import { cn } from "../utils/cn";
import { LEARNER_PREF_CSS_VARS } from "@aivo/accessibility-contract";

/**
 * Baseline/LearnerChoiceCard
 *
 * One large, touch-friendly answer card matching the BaselineAssessment
 * "Reading Forest" handoff: a rounded-22 white card with a tinted 52px
 * icon square on the left, a big playful label, and a state mark on the
 * right. Each card wraps a native radio input so the form posts back
 * without client JS. Big tap targets (min 76px) keep younger and
 * motor-impaired learners comfortable.
 *
 * Leading square: pass `lead` for a custom node (emoji, Twemoji image),
 * or `index` for an auto-letter (A / B / C). `leadColor` tints the square
 * to the option's accent (design uses the icon color at ~10% alpha).
 *
 * Feedback states: pass `state` *after* the learner answers to reveal the
 * design's correct / incorrect / muted treatment (green check, red x, or
 * faded). Omit `state` during normal selection — the card then behaves as
 * a plain radio with the purple "selected" look.
 */
export type LearnerChoiceState = "correct" | "incorrect" | "muted";

export interface LearnerChoiceCardProps {
  /** Form field name (all cards in a question share this). */
  name: string;
  /** The value posted when selected. */
  value: string;
  /** Visible answer text. */
  label: React.ReactNode;
  /** Optional 0-based index — renders A / B / C / D auto-letter. */
  index?: number;
  /** Override the leading square with a custom node (emoji, image). */
  lead?: React.ReactNode;
  /** Tint the leading square to the option's accent color (e.g. "#F59E0B"). */
  leadColor?: string;
  /** Default-checked (for restore). */
  defaultChecked?: boolean;
  /** Disabled state (used after submit while the next card is loading). */
  disabled?: boolean;
  required?: boolean;
  /**
   * Reveal state shown after the learner answers. When set, overrides the
   * resting/selected look with the handoff's feedback colors and renders a
   * check (correct) or x (incorrect) mark. Omit during normal selection.
   */
  state?: LearnerChoiceState;
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

const CHECK = (
  <svg
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const CROSS = (
  <svg
    className="w-4 h-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export function LearnerChoiceCard({
  name,
  value,
  label,
  index,
  lead,
  leadColor,
  defaultChecked,
  disabled,
  required,
  state,
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

  // The card surface: feedback `state` (post-answer reveal) wins over the
  // resting/selected radio look so a consuming runner can opt into the
  // handoff's correct/incorrect colours without changing this component.
  const surface =
    state === "correct"
      ? "border-[var(--aivo-status-success-strong,#10b981)] bg-[#f1fbf6]"
      : state === "incorrect"
        ? "border-[#f87171] bg-[#fef2f2]"
        : state === "muted"
          ? "border-[var(--aivo-color-aivoPurple-100,#efeafa)] bg-[#fbfafe]"
          : checked
            ? "border-[var(--aivo-sensory-primary,#7c3aed)] bg-[var(--aivo-color-aivoPurple-50,#fbfafe)]"
            : "border-[var(--aivo-color-aivoPurple-100,#efeafa)] bg-white hover:border-[var(--aivo-color-aivoPurple-200,#ddd6fe)]";

  const showMark = state === "correct" || state === "incorrect" || (checked && !state);
  const markBg =
    state === "incorrect"
      ? "bg-[var(--aivo-status-error-strong,#ef4444)]"
      : state === "correct"
        ? "bg-[var(--aivo-status-success-strong,#10b981)]"
        : "bg-[var(--aivo-sensory-primary,#7c3aed)]";

  return (
    <label
      {...scanProps}
      className={cn(
        "group relative flex items-center gap-[18px] cursor-pointer select-none",
        "rounded-[22px] border-2 bg-white px-[22px] py-5 min-h-[76px] transition-all duration-150",
        "shadow-[0_8px_22px_rgba(60,40,110,0.07)]",
        surface,
        disabled && "opacity-50 pointer-events-none",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus-within:ring-offset-2 focus-within:ring-offset-[var(--aivo-color-surface-canvas,#fff)]",
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
      {/*
        52px tinted icon square (handoff). With a `lead` (emoji / Twemoji
        image) it shows a soft accent tint; without one it falls back to the
        A / B / C letter — filled purple when this card is the active radio.
      */}
      <span
        className={cn(
          "shrink-0 w-[52px] h-[52px] rounded-[15px] flex items-center justify-center",
          "text-lg font-bold transition-colors",
          lead == null &&
            (checked && !state
              ? "bg-[var(--aivo-sensory-primary,#7c3aed)] text-white"
              : "bg-[var(--aivo-color-surface-muted,#f4f1fb)] text-iw-text-strong"),
        )}
        style={
          lead != null
            ? {
                backgroundColor: leadColor
                  ? `color-mix(in srgb, ${leadColor} 12%, #fff)`
                  : "var(--aivo-color-aivoPurple-50, #f4f1fb)",
              }
            : undefined
        }
        aria-hidden="true"
      >
        {lead ?? (typeof index === "number" ? letter(index) : null)}
      </span>
      {/*
        Answer label honors the learner's reading prefs (font family, scale,
        spacing) via the same `--learner-*` contract vars as the prompt. The
        card's `min-h-[76px]` floor is unconditional, so the touch target is
        always the LARGER of 76px and the (pref-scaled) content height — a
        larger-text learner gets a taller card, never a smaller one. The base
        size is bumped to the handoff's large playful scale.
      */}
      <span
        data-learner-answer
        className="flex-1 [--answer-base:1.125rem] md:[--answer-base:1.25rem] font-semibold text-iw-text-strong"
        style={{
          fontFamily: `var(${LEARNER_PREF_CSS_VARS.fontFamily}, inherit)`,
          fontSize: `calc(var(--answer-base) * var(${LEARNER_PREF_CSS_VARS.fontScale}, 1))`,
          letterSpacing: `var(${LEARNER_PREF_CSS_VARS.letterSpacing}, normal)`,
          lineHeight: `var(${LEARNER_PREF_CSS_VARS.lineHeight}, 1.4)`,
        }}
      >
        {label}
      </span>
      {showMark ? (
        <span
          className={cn(
            "shrink-0 w-[30px] h-[30px] rounded-full text-white inline-flex items-center justify-center",
            markBg,
          )}
          aria-hidden="true"
        >
          {state === "incorrect" ? CROSS : CHECK}
        </span>
      ) : null}
    </label>
  );
}

LearnerChoiceCard.displayName = "Baseline/LearnerChoiceCard";
