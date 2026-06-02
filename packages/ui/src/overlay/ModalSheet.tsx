"use client";
import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../utils/cn";
import type { AivoComponentState } from "../utils/types";

/**
 * Overlay/ModalSheet
 *
 * Centered modal dialog rendered in a portal-free fashion (the consumer
 * wraps it in `<dialog>` semantics via the `open` prop). Uses the AIVO
 * lessonReveal motion duration on enter and a 0ms collapse under
 * `prefers-reduced-motion`.
 *
 * Visual: GlassCard at `card-lg` radius with `overlay` elevation,
 * backed by a soft scrim. Press Escape or scrim-click to dismiss
 * (handlers exposed on props, but **not** wired automatically — keeps
 * the primitive headless so business screens own focus management).
 */
export interface ModalSheetProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  state?: AivoComponentState;
  title?: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
  /** Footer slot — typically a primary + secondary action pair. */
  footer?: React.ReactNode;
  /** Maximum sheet width. Defaults to `lg` (~640px). */
  width?: "sm" | "md" | "lg" | "xl";
  /** When true, hides the close button (caller renders their own). */
  hideCloseButton?: boolean;
}

const WIDTH_CLASS = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export const ModalSheet = React.forwardRef<HTMLDivElement, ModalSheetProps>(function ModalSheet(
  {
    open,
    state = "default",
    title,
    description,
    onClose,
    footer,
    width = "lg",
    hideCloseButton = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 aivo-motion-lesson-reveal"
      role="dialog"
      aria-modal="true"
      aria-busy={state === "loading" || undefined}
    >
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-[rgba(15,23,42,0.4)] backdrop-blur-sm cursor-default"
        tabIndex={-1}
      />
      <div
        ref={ref}
        {...rest}
        className={cn(
          "relative w-full bg-[var(--aivo-color-surface-card,#ffffff)] rounded-iw-card-lg",
          "shadow-[0_24px_64px_-12px_rgba(15,23,42,0.32)] border border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.08))]",
          "p-6 md:p-8 flex flex-col gap-5 max-h-[90vh] overflow-hidden",
          WIDTH_CLASS[width],
          state === "loading" && "aivo-motion-baseline-gen",
          state === "error" &&
            "border-l-4 border-l-[var(--aivo-color-status-error-strong,#dc2626)]",
          className,
        )}
      >
        {(title || description || !hideCloseButton) && (
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex flex-col gap-1">
              {title && (
                <h2 className="iw-label text-[var(--aivo-color-text-default,#0f172a)]">{title}</h2>
              )}
              {description && (
                <p className="text-sm text-[var(--aivo-color-text-muted,#64748b)]">{description}</p>
              )}
            </div>
            {!hideCloseButton && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="iw-touch -m-2 inline-flex items-center justify-center rounded-iw-control text-[var(--aivo-color-text-muted,#64748b)] hover:bg-[var(--aivo-color-surface-muted,#f1f5f9)] focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus,#7c3aed)]"
                aria-label="Close"
              >
                <X className="w-5 h-5" aria-hidden />
              </button>
            )}
          </header>
        )}
        <div className="flex-1 min-h-0 overflow-auto">{children}</div>
        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-3 pt-2 border-t border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.06))]">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
});
ModalSheet.displayName = "Overlay/ModalSheet";
