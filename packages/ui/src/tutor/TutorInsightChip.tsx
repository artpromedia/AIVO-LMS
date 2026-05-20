"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Tutor/TutorInsightChip
 *
 * Small floating chip that appears inside a TutorMessage header to
 * communicate what the AI is doing right now. Sprint 8 spec:
 *  - "hint_used"           the tutor handed out a hint
 *  - "difficulty_adjusted" the tutor adapted to learner pace
 *  - "safety_active"       safety filter is on
 *  - "thinking"            tutor is generating
 *  - "cited"               this response is grounded in source content
 *  - "scaffolded"          worked example / step-by-step engaged
 */
export type TutorInsightKind =
  | "hint_used"
  | "difficulty_adjusted"
  | "safety_active"
  | "thinking"
  | "cited"
  | "scaffolded";

interface Spec {
  label: string;
  tint: string;
  icon: React.ReactNode;
}

const SPECS: Record<TutorInsightKind, Spec> = {
  hint_used: {
    label: "Hint used",
    tint: "bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] border-[var(--aivo-color-aivoOrange-100)]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3 h-3">
        <path d="M9 18h6" />
        <path d="M10 22h4" />
        <path d="M2 12a10 10 0 0 1 20 0c0 4.5-3.5 6-5 8h-10c-1.5-2-5-3.5-5-8z" />
      </svg>
    ),
  },
  difficulty_adjusted: {
    label: "Adapting",
    tint: "bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border-[var(--aivo-color-aivoTeal-100)]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3 h-3">
        <path d="m9 18 6-6-6-6" />
      </svg>
    ),
  },
  safety_active: {
    label: "Safety on",
    tint: "bg-[var(--aivo-color-status-success-subtle)] text-[var(--aivo-color-status-success-strong)] border-[var(--aivo-color-status-success-default)]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3 h-3">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  thinking: {
    label: "Thinking",
    tint: "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]",
    icon: (
      <span className="aivo-motion-ai-thinking w-3 h-3 rounded-full bg-[var(--aivo-sensory-primary)]" aria-hidden="true" />
    ),
  },
  cited: {
    label: "From your school",
    tint: "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)] border-[var(--aivo-color-status-info-default)]",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3 h-3">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    ),
  },
  scaffolded: {
    label: "Step by step",
    tint: "bg-[var(--aivo-color-surface-muted)] text-iw-text-strong border-iw-border",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3 h-3">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
      </svg>
    ),
  },
};

export interface TutorInsightChipProps {
  kind: TutorInsightKind;
  /** Override the default label (e.g. "Hint 2 of 3 used"). */
  label?: React.ReactNode;
  className?: string;
}

export function TutorInsightChip({ kind, label, className }: TutorInsightChipProps) {
  const spec = SPECS[kind];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-iw-chip border text-[10px] font-semibold whitespace-nowrap",
        spec.tint,
        className,
      )}
    >
      {spec.icon}
      {label ?? spec.label}
    </span>
  );
}

TutorInsightChip.displayName = "Tutor/TutorInsightChip";
