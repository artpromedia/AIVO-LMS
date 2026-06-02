"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/ScaleField
 *
 * Friendly confidence / comfort scale. Renders 3-5 large rounded pill
 * cards (Just starting / Building / Comfortable / Strong / etc) with a
 * soft gradient that grows left-to-right. Used for reading comfort,
 * math comfort, frustration tolerance — anywhere a Likert-style scale
 * would normally appear.
 *
 * Always single-select. Always native radio so server submission works
 * with no JS.
 */
export interface ScaleOption {
  value: string;
  label: React.ReactNode;
  /** Optional helper that appears under the label. */
  description?: React.ReactNode;
}

export interface ScaleFieldProps {
  name: string;
  legend: React.ReactNode;
  helper?: React.ReactNode;
  options: ReadonlyArray<ScaleOption>;
  defaultValue?: string;
  required?: boolean;
  error?: React.ReactNode;
  className?: string;
}

const TINTS = [
  "bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)]",
  "bg-[var(--aivo-color-aivoTeal-50,#f0fdfa)]",
  "bg-[var(--aivo-color-aivoTeal-100,#ccfbf1)]",
  "bg-[var(--aivo-color-status-success-subtle,#f0fdf4)]",
  "bg-[var(--aivo-color-aivoOrange-50,#fff7ed)]",
];

export function ScaleField({
  name,
  legend,
  helper,
  options,
  defaultValue,
  required,
  error,
  className,
}: ScaleFieldProps) {
  const [selected, setSelected] = React.useState<string | undefined>(defaultValue);
  const errorId = error ? `${name}-error` : undefined;
  const helperId = helper ? `${name}-helper` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <fieldset
      className={cn("flex flex-col gap-3", className)}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="text-sm font-semibold text-iw-text-strong">
        {legend}
        {required ? (
          <span
            className="ml-1 text-[var(--aivo-color-status-error-strong,#b91c1c)]"
            aria-hidden="true"
          >
            *
          </span>
        ) : null}
      </legend>
      {helper ? (
        <p id={helperId} className="text-xs text-iw-text-muted -mt-1">
          {helper}
        </p>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {options.map((opt, i) => {
          const checked = selected === opt.value;
          const tint = TINTS[Math.min(i, TINTS.length - 1)];
          return (
            <label
              key={opt.value}
              className={cn(
                "relative flex flex-col gap-1 cursor-pointer select-none",
                "rounded-iw-card border bg-white p-4 transition-all duration-150",
                "hover:border-[var(--aivo-color-aivoPurple-200,#ddd6fe)]",
                checked
                  ? "border-[var(--aivo-sensory-primary,#7c3aed)] shadow-[0_0_0_2px_var(--aivo-color-aivoPurple-100,#ede9fe)]"
                  : "border-iw-border",
                "focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus-within:ring-offset-2",
              )}
            >
              <input
                type="radio"
                name={name}
                value={opt.value}
                defaultChecked={defaultValue === opt.value}
                onChange={() => setSelected(opt.value)}
                className="sr-only"
              />
              <span className="flex items-center justify-between">
                <span className="text-sm font-semibold text-iw-text-strong">{opt.label}</span>
                <span
                  className={cn(
                    "w-7 h-2.5 rounded-full",
                    checked ? "bg-[var(--aivo-sensory-primary,#7c3aed)]" : tint,
                  )}
                  aria-hidden="true"
                />
              </span>
              {opt.description ? (
                <span className="text-xs text-iw-text-muted leading-relaxed">
                  {opt.description}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-xs text-[var(--aivo-color-status-error-strong,#b91c1c)]"
        >
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

ScaleField.displayName = "Assessment/ScaleField";
