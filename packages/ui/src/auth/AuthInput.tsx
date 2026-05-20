"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Auth/AuthInput
 *
 * Minimal, calm text input. Floating label, 16px text (no iOS zoom),
 * 48px tall (touch-friendly), 1px iw-border that thickens on focus.
 *
 * State contract:
 *  - default  → quiet
 *  - focus    → 2px primary focus ring
 *  - error    → red rim + helper text in red, role="alert"
 *  - disabled → 50% opacity, aria-disabled
 *
 * Prefer one input per question; avoid dense forms.
 */
export interface AuthInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "id"> {
  id: string;
  label: React.ReactNode;
  /** Optional helper text shown under the field. */
  helper?: React.ReactNode;
  /** Error message — when set, the field renders in error state. */
  error?: React.ReactNode;
  /** Leading icon (e.g. AivoIcon) shown inside the field. */
  leadingIcon?: React.ReactNode;
  /** Trailing element (e.g. show-password toggle). */
  trailing?: React.ReactNode;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  function AuthInput(
    { id, label, helper, error, leadingIcon, trailing, className, type = "text", ...rest },
    ref,
  ) {
    const helperId = helper ? `${id}-helper` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;
    return (
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor={id}
          className="text-sm font-medium text-iw-text-strong"
        >
          {label}
        </label>
        <div
          className={cn(
            "relative flex items-center rounded-iw-control bg-white border transition-colors",
            "h-12 px-3",
            error
              ? "border-[var(--aivo-status-error-strong,#dc2626)] focus-within:ring-2 focus-within:ring-[var(--aivo-status-error-strong,#dc2626)]/30"
              : "border-iw-border focus-within:border-[var(--aivo-sensory-primary,#7c3aed)] focus-within:ring-2 focus-within:ring-[var(--aivo-sensory-primary,#7c3aed)]/20",
          )}
        >
          {leadingIcon ? (
            <span className="mr-2 text-iw-text-muted" aria-hidden="true">
              {leadingIcon}
            </span>
          ) : null}
          <input
            ref={ref}
            id={id}
            type={type}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            className={cn(
              "flex-1 bg-transparent outline-none text-base text-iw-text-strong",
              "placeholder:text-iw-text-muted/70",
              className,
            )}
            {...rest}
          />
          {trailing ? (
            <span className="ml-2 text-iw-text-muted">{trailing}</span>
          ) : null}
        </div>
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-[var(--aivo-status-error-strong,#dc2626)]"
          >
            {error}
          </p>
        ) : helper ? (
          <p id={helperId} className="text-xs text-iw-text-muted">
            {helper}
          </p>
        ) : null}
      </div>
    );
  },
);

AuthInput.displayName = "Auth/AuthInput";
