"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Auth/AuthShell
 *
 * Calm full-bleed canvas for every authentication, onboarding, and
 * consent screen. Center column is the AuthCard; left rail is an
 * optional brand panel; bottom is an optional legal strip.
 *
 * Mobile: brand rail collapses, content fills the viewport.
 * Desktop: 2-column split with the brand rail glued to the left.
 *
 * Reduced-motion safe (no entrance animations; relies on token motion
 * which already honours prefers-reduced-motion).
 */
export interface AuthShellProps {
  /** Optional left-rail brand / illustration content. */
  brand?: React.ReactNode;
  /** Optional bottom legal strip (links to privacy, terms). */
  footer?: React.ReactNode;
  /** Main column content — usually one AuthCard. */
  children: React.ReactNode;
  className?: string;
}

export function AuthShell({ brand, footer, children, className }: AuthShellProps) {
  return (
    <div
      className={cn(
        "min-h-screen bg-[var(--aivo-color-surface-canvas,#f4f6f5)] iw-safe-top iw-safe-bottom",
        "flex flex-col",
        className,
      )}
    >
      <div
        className={cn(
          "flex-1 grid grid-cols-1",
          // Only allocate a 520px brand-rail column when a brand panel
          // is actually provided. Without this guard the grid still
          // reserved 520px on the left even when the aside was null,
          // pinning every brand-less step to a narrow left column on
          // desktop instead of centering it in the viewport.
          brand ? "lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]" : "",
        )}
      >
        {brand ? (
          <aside
            className={cn(
              "hidden lg:flex flex-col justify-between p-10",
              "bg-gradient-to-br from-[var(--aivo-color-aivoPurple-100,#ede9fe)] to-[var(--aivo-color-aivoTeal-100,#ccfbf1)]",
            )}
            aria-hidden="true"
          >
            {brand}
          </aside>
        ) : null}
        <main className="flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-[480px]">{children}</div>
        </main>
      </div>
      {footer ? (
        <footer className="px-6 lg:px-10 py-4 text-xs text-iw-text-muted border-t border-iw-border bg-white/50 backdrop-blur-sm">
          {footer}
        </footer>
      ) : null}
    </div>
  );
}

AuthShell.displayName = "Auth/AuthShell";
