"use client";
import * as React from "react";
import { cn } from "../utils/cn.js";

/**
 * LearnerDashboard/StatChip
 *
 * Top-of-page stat card used on the learner home for Level/XP and
 * Streak — small icon tile on the left, uppercase label + bold value
 * stacked on the right. Renders inside a soft-rounded surface card.
 *
 * Visual contract mirrors the SensoryAdaptive reference: 56px icon
 * tile in a tinted background that picks up the accent prop, value
 * in display weight, label as a tracked micro-caps eyebrow.
 */
export interface StatChipProps {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  /** Optional CSS color or var() for the icon tile background tint. */
  tone?: "primary" | "warm" | "success" | "info";
  className?: string;
}

const TONE_BG: Record<NonNullable<StatChipProps["tone"]>, string> = {
  primary: "bg-[color-mix(in_oklab,var(--color-aivo-primary)_14%,white)]",
  warm: "bg-[color-mix(in_oklab,var(--aivo-sunshine-400)_22%,white)]",
  success: "bg-[color-mix(in_oklab,var(--aivo-meadow-400)_18%,white)]",
  info: "bg-[color-mix(in_oklab,var(--aivo-calmSky-400)_18%,white)]",
};
const TONE_FG: Record<NonNullable<StatChipProps["tone"]>, string> = {
  primary: "text-[var(--color-aivo-primary)]",
  warm: "text-[var(--aivo-sunshine-700)]",
  success: "text-[var(--aivo-meadow-700)]",
  info: "text-[var(--aivo-calmSky-700)]",
};

export function StatChip({ icon, label, value, tone = "primary", className }: StatChipProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 px-4 py-3 rounded-[20px]",
        "bg-white border border-iw-border/60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "w-11 h-11 inline-flex items-center justify-center rounded-2xl shrink-0",
          TONE_BG[tone],
          TONE_FG[tone],
        )}
      >
        {icon}
      </span>
      <span className="flex flex-col leading-tight">
        <span className="iw-label-sm text-iw-text-muted">{label}</span>
        <span className="text-base font-bold text-iw-text-strong tabular-nums">{value}</span>
      </span>
    </div>
  );
}

StatChip.displayName = "LearnerDashboard/StatChip";
