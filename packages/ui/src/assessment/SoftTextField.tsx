"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/SoftTextField
 *
 * Calm, low-stigma text field for assessment + IEP capture. Renders a
 * 48px (single line) or auto-grow (multiline) input on a white card
 * with the AIVO soft focus ring. Native form submission compatible.
 *
 * For tag-style entry (frustration triggers, calming strategies) we
 * still use this with `multiline` — the page passes the raw list as
 * comma- or newline-separated text and parses on the server. Keeps the
 * UI free of brittle pill-input widgets.
 */
type CommonProps = {
  name: string;
  label: React.ReactNode;
  helper?: React.ReactNode;
  required?: boolean;
  error?: React.ReactNode;
  placeholder?: string;
  className?: string;
  /** Maximum character count (renders a counter). */
  maxLength?: number;
  /** When true, renders a textarea instead of a single-line input. */
  multiline?: boolean;
  /** Default value (for SSR / form restore). */
  defaultValue?: string;
  /** Optional inline trailing slot (e.g. unit, hint). */
  trailing?: React.ReactNode;
};

export type SoftTextFieldProps = CommonProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, keyof CommonProps | "type"> & {
    type?: "text" | "email" | "tel" | "date" | "number";
  };

export function SoftTextField({
  name,
  label,
  helper,
  required,
  error,
  placeholder,
  className,
  maxLength,
  multiline,
  defaultValue,
  trailing,
  type = "text",
  ...rest
}: SoftTextFieldProps) {
  const helperId = helper ? `${name}-helper` : undefined;
  const errorId = error ? `${name}-error` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;
  const [count, setCount] = React.useState<number>(defaultValue?.length ?? 0);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={name} className="text-sm font-semibold text-iw-text-strong">
        {label}
        {required ? (
          <span
            className="ml-1 text-[var(--aivo-color-status-error-strong,#b91c1c)]"
            aria-hidden="true"
          >
            *
          </span>
        ) : null}
      </label>
      {helper ? (
        <p id={helperId} className="text-xs text-iw-text-muted">
          {helper}
        </p>
      ) : null}
      <div
        className={cn(
          "relative flex items-stretch rounded-iw-control border bg-white",
          "transition-colors duration-150",
          "focus-within:border-[var(--aivo-sensory-primary,#7c3aed)] focus-within:ring-2 focus-within:ring-[var(--aivo-sensory-ringFocus,#7c3aed)]/40",
          error ? "border-[var(--aivo-color-status-error-default,#fecaca)]" : "border-iw-border",
        )}
      >
        {multiline ? (
          <textarea
            id={name}
            name={name}
            rows={4}
            defaultValue={defaultValue}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setCount(e.currentTarget.value.length)}
            className={cn(
              "flex-1 bg-transparent px-4 py-3 text-sm md:text-base text-iw-text-strong",
              "placeholder:text-iw-text-muted/70 resize-y min-h-[96px]",
              "focus:outline-none",
            )}
          />
        ) : (
          <input
            id={name}
            name={name}
            type={type}
            defaultValue={defaultValue}
            placeholder={placeholder}
            maxLength={maxLength}
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setCount(e.currentTarget.value.length)}
            className={cn(
              "flex-1 bg-transparent px-4 py-3 text-sm md:text-base text-iw-text-strong",
              "placeholder:text-iw-text-muted/70 h-12",
              "focus:outline-none",
            )}
            {...(rest as React.InputHTMLAttributes<HTMLInputElement>)}
          />
        )}
        {trailing ? (
          <span className="flex items-center pr-3 text-xs text-iw-text-muted">{trailing}</span>
        ) : null}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        {error ? (
          <p
            id={errorId}
            role="alert"
            className="text-xs text-[var(--aivo-color-status-error-strong,#b91c1c)]"
          >
            {error}
          </p>
        ) : (
          <span />
        )}
        {maxLength ? (
          <p className="text-[11px] text-iw-text-muted tabular-nums">
            {count}/{maxLength}
          </p>
        ) : null}
      </div>
    </div>
  );
}

SoftTextField.displayName = "Assessment/SoftTextField";
