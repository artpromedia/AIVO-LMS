"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/PersonalizationChip
 *
 * Floating status chip that proves the baseline is tuned to the
 * learner — never a generic mock quiz. Used in `LearnerBaselineShell.status`.
 *
 * Variants:
 *  - parent_assessment  "Personalized from parent assessment"
 *  - iep                "IEP supports applied"
 *  - pacing             "Pacing adjusted"
 *  - no_grades          "No grades — this helps AIVO learn"
 *  - read_aloud         "Read-aloud on"
 *  - calm_mode          "Calm mode"
 *  - extended_time      "Extra time"
 *  - paused             "Paused"
 *
 * The chip is decorative status, not an interactive control — render
 * one per active personalization signal and let them wrap.
 */
export type PersonalizationVariant =
  | "parent_assessment"
  | "iep"
  | "pacing"
  | "no_grades"
  | "read_aloud"
  | "calm_mode"
  | "extended_time"
  | "paused"
  | "ai_companion";

interface VariantSpec {
  label: string;
  tone: "primary" | "accent" | "info" | "neutral" | "warm";
  icon: React.ReactNode;
}

const SPECS: Record<PersonalizationVariant, VariantSpec> = {
  parent_assessment: {
    label: "Personalized from parent assessment",
    tone: "primary",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="m22 11-3 3-1.5-1.5" />
      </svg>
    ),
  },
  iep: {
    label: "IEP supports applied",
    tone: "accent",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  pacing: {
    label: "Pacing adjusted",
    tone: "info",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  no_grades: {
    label: "No grades — this helps AIVO learn",
    tone: "neutral",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <circle cx="12" cy="12" r="10" />
        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  read_aloud: {
    label: "Read-aloud on",
    tone: "info",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
        <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      </svg>
    ),
  },
  calm_mode: {
    label: "Calm mode",
    tone: "accent",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
      </svg>
    ),
  },
  extended_time: {
    label: "Extra time",
    tone: "info",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  paused: {
    label: "Paused",
    tone: "warm",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <rect x="6" y="4" width="4" height="16" />
        <rect x="14" y="4" width="4" height="16" />
      </svg>
    ),
  },
  ai_companion: {
    label: "AIVO is with you",
    tone: "primary",
    icon: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="w-3 h-3"
      >
        <circle cx="12" cy="12" r="9" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
};

const TONE: Record<VariantSpec["tone"], string> = {
  primary:
    "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]",
  accent:
    "bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border-[var(--aivo-color-aivoTeal-100)]",
  info: "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)] border-[var(--aivo-color-status-info-default)]",
  neutral:
    "bg-[var(--aivo-color-surface-muted)] text-[var(--aivo-color-text-default)] border-[var(--aivo-color-border-subtle)]",
  warm: "bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] border-[var(--aivo-color-aivoOrange-100)]",
};

export interface PersonalizationChipProps {
  variant: PersonalizationVariant;
  /** Override the default label (e.g. "IEP supports · 4 applied"). */
  label?: React.ReactNode;
  className?: string;
}

export function PersonalizationChip({ variant, label, className }: PersonalizationChipProps) {
  const spec = SPECS[variant];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-iw-chip border px-2.5 py-1",
        "text-xs font-semibold whitespace-nowrap",
        TONE[spec.tone],
        className,
      )}
    >
      {spec.icon}
      {label ?? spec.label}
    </span>
  );
}

PersonalizationChip.displayName = "Baseline/PersonalizationChip";
