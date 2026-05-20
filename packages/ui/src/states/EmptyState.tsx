"use client";
import * as React from "react";
import { cn } from "../utils/cn";
import type { AivoTone } from "../utils/types";

/**
 * States/EmptyState
 *
 * Friendly zero-data view. Use inside GlassCard / SidePanel when the
 * data set is empty by design (no assignments yet, no flagged items).
 *
 * Composes a tone-tinted icon halo + headline + body + optional CTA.
 * Keeps copy short — long marketing-style copy belongs in HeroPanel.
 */
export interface EmptyStateProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  /** Lucide icon (or any component receiving `className`). */
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  tone?: Extract<
    AivoTone,
    "neutral" | "primary" | "accent" | "warm" | "info" | "success"
  >;
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
}

const HALO: Record<EmptyStateProps["tone"] & string, string> = {
  neutral:
    "bg-[var(--aivo-color-surface-muted,#f1f5f9)] text-[var(--aivo-color-text-muted,#64748b)]",
  primary:
    "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-color-aivoPurple-600,#7c3aed)]",
  accent:
    "bg-[var(--aivo-color-aivoTeal-50,#f0fdfa)] text-[var(--aivo-color-aivoTeal-600,#0d9488)]",
  warm: "bg-[var(--aivo-color-aivoOrange-50,#fff7ed)] text-[var(--aivo-color-aivoOrange-600,#ea580c)]",
  info: "bg-[var(--aivo-color-status-info-subtle,#eff6ff)] text-[var(--aivo-color-status-info-strong,#2563eb)]",
  success:
    "bg-[var(--aivo-color-status-success-subtle,#f0fdf4)] text-[var(--aivo-color-status-success-strong,#16a34a)]",
};

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  function EmptyState(
    { icon: Icon, tone = "neutral", title, body, action, className, ...rest },
    ref
  ) {
    return (
      <div
        ref={ref}
        {...rest}
        className={cn(
          "flex flex-col items-center text-center gap-3 py-10 px-6",
          className
        )}
      >
        {Icon && (
          <span
            className={cn(
              "inline-flex items-center justify-center w-14 h-14 rounded-iw-chip",
              HALO[tone]
            )}
          >
            <Icon className="w-6 h-6" aria-hidden />
          </span>
        )}
        <h3 className="iw-label text-[var(--aivo-color-text-default,#0f172a)]">
          {title}
        </h3>
        {body && (
          <p className="text-sm text-[var(--aivo-color-text-muted,#64748b)] max-w-prose">
            {body}
          </p>
        )}
        {action && <div className="pt-1">{action}</div>}
      </div>
    );
  }
);
EmptyState.displayName = "States/EmptyState";
