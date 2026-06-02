"use client";
import { forwardRef } from "react";
import { ShieldCheck, AlertTriangle, AlertCircle, ShieldAlert } from "lucide-react";
import { cn } from "../utils/cn";
import { type RiskLevel } from "./helpers";

export type RiskIndicatorProps = {
  level: RiskLevel;
  /** Short headline, e.g. "On track" or "Reading mastery slipping". */
  label: string;
  /** Optional supporting line. */
  detail?: string;
  /** Visual density. */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const ICON: Record<RiskLevel, typeof ShieldCheck> = {
  low: ShieldCheck,
  watch: AlertCircle,
  elevated: AlertTriangle,
  high: ShieldAlert,
};

const BG: Record<RiskLevel, string> = {
  low: "bg-iw-risk-low-subtle text-iw-risk-low-strong",
  watch: "bg-iw-risk-watch-subtle text-iw-risk-watch-strong",
  elevated: "bg-iw-risk-elevated-subtle text-iw-risk-elevated-strong",
  high: "bg-iw-risk-high-subtle text-iw-risk-high-strong",
};

const SIZE: Record<
  NonNullable<RiskIndicatorProps["size"]>,
  { pad: string; icon: string; label: string }
> = {
  sm: { pad: "px-2.5 py-1.5 gap-2", icon: "w-4 h-4", label: "text-xs" },
  md: { pad: "px-3 py-2 gap-2.5", icon: "w-5 h-5", label: "text-sm" },
  lg: { pad: "px-4 py-3 gap-3", icon: "w-6 h-6", label: "text-base" },
};

/**
 * RiskIndicator — chip-style summary used in teacher and admin views to
 * flag a learner / class / district at-a-glance. Tone resolves through
 * the semantic.domain.risk scale.
 */
export const RiskIndicator = forwardRef<HTMLDivElement, RiskIndicatorProps>(function RiskIndicator(
  { level, label, detail, size = "md", className },
  ref,
) {
  const Icon = ICON[level];
  const s = SIZE[size];
  return (
    <div
      ref={ref}
      role="status"
      aria-label={`${label} — risk ${level}`}
      className={cn(
        "inline-flex items-start rounded-iw-card font-semibold whitespace-nowrap",
        BG[level],
        s.pad,
        className,
      )}
    >
      <Icon className={cn(s.icon, "shrink-0 mt-0.5")} aria-hidden="true" />
      <div className="flex flex-col items-start min-w-0">
        <span className={cn(s.label, "leading-tight")}>{label}</span>
        {detail && (
          <span className="text-xs font-normal opacity-80 leading-tight mt-0.5">{detail}</span>
        )}
      </div>
    </div>
  );
});

RiskIndicator.displayName = "Chart/RiskIndicator";
