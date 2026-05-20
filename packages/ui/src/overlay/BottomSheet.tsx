"use client";
import * as React from "react";
import { cn } from "../utils/cn";
import type { AivoComponentState } from "../utils/types";

/**
 * Overlay/BottomSheet
 *
 * Mobile-first drawer that slides up from the bottom. Honors
 * env(safe-area-inset-bottom) via `.iw-safe-bottom` so it sits above
 * the iOS home indicator and Android nav bar.
 *
 * Includes an optional drag-handle indicator (purely visual — drag
 * gestures are the consumer's responsibility; the primitive remains
 * controlled via `open` / `onClose`).
 */
export interface BottomSheetProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  open: boolean;
  state?: AivoComponentState;
  title?: React.ReactNode;
  onClose?: () => void;
  /** Show the small grab-handle pill at the top. */
  withHandle?: boolean;
  /** Max height as % of viewport. Defaults to 85. */
  maxHeightVh?: number;
}

export const BottomSheet = React.forwardRef<HTMLDivElement, BottomSheetProps>(
  function BottomSheet(
    {
      open,
      state = "default",
      title,
      onClose,
      withHandle = true,
      maxHeightVh = 85,
      className,
      children,
      style,
      ...rest
    },
    ref
  ) {
    if (!open) return null;

    return (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center aivo-motion-lesson-reveal"
        role="dialog"
        aria-modal="true"
        aria-busy={state === "loading" || undefined}
      >
        <button
          type="button"
          aria-label="Close sheet"
          onClick={onClose}
          className="absolute inset-0 bg-[rgba(15,23,42,0.4)] backdrop-blur-sm cursor-default"
          tabIndex={-1}
        />
        <div
          ref={ref}
          {...rest}
          style={{ maxHeight: `${maxHeightVh}vh`, ...style }}
          className={cn(
            "relative w-full max-w-2xl bg-[var(--aivo-color-surface-card,#ffffff)]",
            "rounded-t-iw-sheet-top shadow-[0_-12px_48px_-12px_rgba(15,23,42,0.24)]",
            "flex flex-col px-5 pt-3 iw-safe-bottom overflow-hidden",
            state === "loading" && "aivo-motion-baseline-gen",
            className
          )}
        >
          {withHandle && (
            <div className="self-center mb-3 w-10 h-1.5 rounded-full bg-[var(--aivo-color-border-subtle,rgba(15,23,42,0.18))]" />
          )}
          {title && (
            <header className="pb-3 border-b border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.06))]">
              <h2 className="iw-label text-[var(--aivo-color-text-default,#0f172a)]">
                {title}
              </h2>
            </header>
          )}
          <div className="flex-1 min-h-0 overflow-auto py-4">{children}</div>
        </div>
      </div>
    );
  }
);
BottomSheet.displayName = "Overlay/BottomSheet";
