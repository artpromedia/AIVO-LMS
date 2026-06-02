"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../utils/cn";
import type { AivoComponentState } from "../utils/types";

/**
 * Overlay/SidePanel
 *
 * Right-side drawer for desktop-only experiences: assignment detail,
 * IEP goal editor, billing item preview. Pairs with BottomSheet on
 * mobile (consumer chooses which to render based on viewport).
 */
export interface SidePanelProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  state?: AivoComponentState;
  title?: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
  side?: "right" | "left";
  width?: "sm" | "md" | "lg";
  footer?: React.ReactNode;
}

const WIDTH_CLASS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-xl",
} as const;

export const SidePanel = React.forwardRef<HTMLDivElement, SidePanelProps>(function SidePanel(
  {
    open,
    state = "default",
    title,
    description,
    onClose,
    side = "right",
    width = "md",
    footer,
    className,
    children,
    ...rest
  },
  ref,
) {
  if (!open) return null;
  const align = side === "right" ? "justify-end" : "justify-start";

  return (
    <div
      className={cn("fixed inset-0 z-50 flex aivo-motion-lesson-reveal", align)}
      role="dialog"
      aria-modal="true"
      aria-busy={state === "loading" || undefined}
    >
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(15,23,42,0.35)] backdrop-blur-sm cursor-default"
        tabIndex={-1}
      />
      <aside
        ref={ref}
        {...rest}
        className={cn(
          "relative h-full w-full bg-[var(--aivo-color-surface-card,#ffffff)]",
          "shadow-[0_0_48px_-12px_rgba(15,23,42,0.32)]",
          "flex flex-col iw-safe-top iw-safe-bottom",
          side === "right"
            ? "rounded-l-iw-card-lg border-l border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.08))]"
            : "rounded-r-iw-card-lg border-r border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.08))]",
          WIDTH_CLASS[width],
          state === "loading" && "aivo-motion-baseline-gen",
          state === "error" &&
            "border-l-4 border-l-[var(--aivo-color-status-error-strong,#dc2626)]",
          className,
        )}
      >
        <header className="flex items-start justify-between gap-4 p-5 md:p-6 border-b border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.06))]">
          <div className="min-w-0 flex flex-col gap-1">
            {title && (
              <h2 className="iw-label text-[var(--aivo-color-text-default,#0f172a)]">{title}</h2>
            )}
            {description && (
              <p className="text-sm text-[var(--aivo-color-text-muted,#64748b)]">{description}</p>
            )}
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="iw-touch -m-2 inline-flex items-center justify-center rounded-iw-control text-[var(--aivo-color-text-muted,#64748b)] hover:bg-[var(--aivo-color-surface-muted,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#7c3aed)]"
            >
              <X className="w-5 h-5" aria-hidden />
            </button>
          )}
        </header>
        <div className="flex-1 min-h-0 overflow-auto p-5 md:p-6">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-3 p-5 md:p-6 border-t border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.06))]">
            {footer}
          </footer>
        )}
      </aside>
    </div>
  );
});
SidePanel.displayName = "Overlay/SidePanel";
