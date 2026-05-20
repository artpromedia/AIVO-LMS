"use client";
import * as React from "react";
import { cn } from "../utils/cn";
import type { AivoComponentState, AivoTone } from "../utils/types";

/**
 * Surface/InsightChip
 *
 * Tone-driven pill used for AI insights, status flags, and rostering
 * metadata. Maps the design-system AivoTone vocabulary onto the iw-*
 * subtle/strong colour pairs so every chip shares the same look.
 *
 * Two sizes (`sm` | `md`) — sm is for inline chip clusters inside
 * MetricCard / ClassOverviewCard, md is for hero panels.
 */
export interface InsightChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  state?: AivoComponentState;
  tone?: AivoTone;
  size?: "sm" | "md";
  /** Optional lucide-react icon component for the leading slot. */
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Optional trailing element (count badge, ×, caret). */
  trailing?: React.ReactNode;
  /** Renders the strong (saturated) variant instead of subtle. */
  strong?: boolean;
  /** When true the chip becomes a button (focusable, role="button"). */
  interactive?: boolean;
}

const TONE_SUBTLE: Record<AivoTone, string> = {
  neutral:
    "bg-[var(--aivo-color-surface-muted,#f1f5f9)] text-[var(--aivo-color-text-default,#0f172a)] border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.08))]",
  primary:
    "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-color-aivoPurple-700,#6d28d9)] border-[var(--aivo-color-aivoPurple-100,#ede9fe)]",
  accent:
    "bg-[var(--aivo-color-aivoTeal-50,#f0fdfa)] text-[var(--aivo-color-aivoTeal-700,#0f766e)] border-[var(--aivo-color-aivoTeal-100,#ccfbf1)]",
  warm: "bg-[var(--aivo-color-aivoOrange-50,#fff7ed)] text-[var(--aivo-color-aivoOrange-700,#c2410c)] border-[var(--aivo-color-aivoOrange-100,#ffedd5)]",
  success:
    "bg-[var(--aivo-color-status-success-subtle,#f0fdf4)] text-[var(--aivo-color-status-success-strong,#15803d)] border-[var(--aivo-color-status-success-default,#bbf7d0)]",
  warning:
    "bg-[var(--aivo-color-status-warning-subtle,#fffbeb)] text-[var(--aivo-color-status-warning-strong,#b45309)] border-[var(--aivo-color-status-warning-default,#fde68a)]",
  error:
    "bg-[var(--aivo-color-status-error-subtle,#fef2f2)] text-[var(--aivo-color-status-error-strong,#b91c1c)] border-[var(--aivo-color-status-error-default,#fecaca)]",
  info: "bg-[var(--aivo-color-status-info-subtle,#eff6ff)] text-[var(--aivo-color-status-info-strong,#1d4ed8)] border-[var(--aivo-color-status-info-default,#bfdbfe)]",
};

const TONE_STRONG: Record<AivoTone, string> = {
  neutral:
    "bg-[var(--aivo-color-text-default,#0f172a)] text-white border-transparent",
  primary:
    "bg-[var(--aivo-sensory-primary,#7c3aed)] text-white border-transparent",
  accent:
    "bg-[var(--aivo-color-aivoTeal-600,#0d9488)] text-white border-transparent",
  warm: "bg-[var(--aivo-color-aivoOrange-600,#ea580c)] text-white border-transparent",
  success:
    "bg-[var(--aivo-color-status-success-strong,#16a34a)] text-white border-transparent",
  warning:
    "bg-[var(--aivo-color-status-warning-strong,#d97706)] text-white border-transparent",
  error:
    "bg-[var(--aivo-color-status-error-strong,#dc2626)] text-white border-transparent",
  info: "bg-[var(--aivo-color-status-info-strong,#2563eb)] text-white border-transparent",
};

const SIZE_CLASS = {
  sm: "px-2 py-0.5 text-[11px] gap-1 rounded-iw-chip",
  md: "px-3 py-1 text-xs gap-1.5 rounded-iw-chip",
} as const;

export const InsightChip = React.forwardRef<HTMLSpanElement, InsightChipProps>(
  function InsightChip(
    {
      state = "default",
      tone = "neutral",
      size = "sm",
      icon: Icon,
      trailing,
      strong = false,
      interactive = false,
      className,
      children,
      ...rest
    },
    ref
  ) {
    const palette = strong ? TONE_STRONG[tone] : TONE_SUBTLE[tone];
    return (
      <span
        ref={ref}
        data-state={state}
        role={interactive ? "button" : undefined}
        tabIndex={interactive && state !== "disabled" ? 0 : undefined}
        aria-disabled={state === "disabled" || undefined}
        aria-busy={state === "loading" || undefined}
        {...rest}
        className={cn(
          "inline-flex items-center font-semibold border whitespace-nowrap select-none transition-colors",
          SIZE_CLASS[size],
          palette,
          interactive &&
            "cursor-pointer hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus:ring-offset-1",
          state === "disabled" && "opacity-50 pointer-events-none",
          state === "loading" && "animate-pulse",
          state === "empty" && "opacity-60",
          className
        )}
      >
        {Icon && <Icon className="w-3 h-3" aria-hidden />}
        <span className="truncate">{children}</span>
        {trailing}
      </span>
    );
  }
);
InsightChip.displayName = "Surface/InsightChip";
