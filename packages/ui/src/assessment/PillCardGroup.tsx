"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/PillCardGroup
 *
 * Selectable pill card group used wherever the parent picks from a
 * small enumerated set: grade band, reading comfort, break style,
 * communication mode, sensory sensitivities, etc.
 *
 * Two selection modes:
 *  - mode="single"   → radio group, exactly one selection
 *  - mode="multi"    → checkbox group, any subset
 *
 * Renders semantic native inputs (visually hidden) wrapped by a label
 * — so keyboard focus, screen-reader announcement, and form
 * submission all work without any custom JS. The parent can submit
 * the form server-side with no client hydration.
 *
 * Each option's `value` is what posts back under `name`. Pass
 * `defaultValue` (single) or `defaultValues` (multi) for restored
 * answers.
 */
export interface PillOption {
  value: string;
  label: React.ReactNode;
  /** Optional short description rendered under the label. */
  description?: React.ReactNode;
  /** Optional icon (lucide component or any element). */
  icon?: React.ReactNode;
  /** Disable individual options (e.g. accommodations not yet available). */
  disabled?: boolean;
}

interface BaseProps {
  /** Field name submitted to the server. */
  name: string;
  /** Visible legend (the question), required for a11y. */
  legend: React.ReactNode;
  /** Optional helper rendered under the legend. */
  helper?: React.ReactNode;
  /** Grid columns at md breakpoint — defaults to auto (1–3 based on count). */
  columns?: 1 | 2 | 3;
  /** Compact spacing — for in-card secondary groups. */
  compact?: boolean;
  /** Required field (adds visual + aria signal). */
  required?: boolean;
  /** Per-group error message. */
  error?: React.ReactNode;
  options: ReadonlyArray<PillOption>;
  className?: string;
}

export type PillCardGroupProps =
  | (BaseProps & { mode: "single"; defaultValue?: string })
  | (BaseProps & { mode: "multi"; defaultValues?: ReadonlyArray<string> });

// ParentAssessment.dc.html answer card: a big rounded card with an optional
// icon circle on the left, the label, and a check circle on the right.
function cardClass(checked: boolean, disabled?: boolean) {
  return cn(
    "group relative flex items-center gap-3.5 cursor-pointer select-none",
    "rounded-[18px] border-[1.5px] bg-white p-4 transition-all duration-150",
    checked
      ? "border-[var(--aivo-sensory-primary,#7c3aed)] shadow-[0_3px_10px_rgba(60,40,110,0.08)]"
      : "border-[var(--aivo-color-aivoPurple-100,#ece7f6)] shadow-[0_3px_10px_rgba(60,40,110,0.03)] hover:border-[var(--aivo-color-aivoPurple-200,#ddd6fe)]",
    disabled && "opacity-50 cursor-not-allowed",
    "focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus-within:ring-offset-2",
  );
}

function iconWrapClass(checked: boolean) {
  return cn(
    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--aivo-sensory-primary,#7c3aed)]",
    checked
      ? "bg-[var(--aivo-color-aivoPurple-200,#e7defb)]"
      : "bg-[var(--aivo-color-aivoPurple-50,#f4f1fb)]",
  );
}

function checkClass(checked: boolean) {
  return cn(
    "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition-colors",
    checked
      ? "bg-[var(--aivo-sensory-primary,#7c3aed)]"
      : "border-2 border-[var(--aivo-color-aivoPurple-200,#d8d0ea)] bg-white",
  );
}

function ColumnsClass(columns: 1 | 2 | 3 | undefined, count: number): string {
  if (columns === 1) return "grid grid-cols-1 gap-3";
  if (columns === 2) return "grid grid-cols-1 sm:grid-cols-2 gap-3";
  if (columns === 3) return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3";
  // auto
  if (count <= 2) return "grid grid-cols-1 sm:grid-cols-2 gap-3";
  if (count <= 4) return "grid grid-cols-1 sm:grid-cols-2 gap-3";
  return "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3";
}

export function PillCardGroup(props: PillCardGroupProps) {
  const { name, legend, helper, columns, compact, required, error, options, className } = props;
  const isSingle = props.mode === "single";
  const initial: Set<string> = isSingle
    ? new Set(props.defaultValue ? [props.defaultValue] : [])
    : new Set(props.defaultValues ?? []);
  const [selected, setSelected] = React.useState<Set<string>>(initial);

  function toggle(value: string, disabled?: boolean) {
    if (disabled) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (isSingle) {
        next.clear();
        next.add(value);
      } else {
        if (next.has(value)) next.delete(value);
        else next.add(value);
      }
      return next;
    });
  }

  const errorId = error ? `${name}-error` : undefined;
  const helperId = helper ? `${name}-helper` : undefined;
  const describedBy = [helperId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <fieldset
      className={cn("flex flex-col gap-3", compact && "gap-2", className)}
      aria-describedby={describedBy}
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
      <div className={ColumnsClass(columns, options.length)}>
        {options.map((opt) => {
          const checked = selected.has(opt.value);
          return (
            <label key={opt.value} className={cardClass(checked, opt.disabled)}>
              <input
                type={isSingle ? "radio" : "checkbox"}
                name={name}
                value={opt.value}
                defaultChecked={initial.has(opt.value)}
                disabled={opt.disabled}
                onChange={() => toggle(opt.value, opt.disabled)}
                className="sr-only"
                aria-describedby={opt.description ? `${name}-${opt.value}-desc` : undefined}
              />
              {opt.icon ? (
                <span className={iconWrapClass(checked)} aria-hidden="true">
                  {opt.icon}
                </span>
              ) : null}
              <span className="flex-1 min-w-0">
                <span
                  className={cn(
                    "block text-base font-bold",
                    checked
                      ? "text-[var(--aivo-color-aivoPurple-800,#5b21b6)]"
                      : "text-iw-text-strong",
                  )}
                >
                  {opt.label}
                </span>
                {opt.description ? (
                  <span
                    id={`${name}-${opt.value}-desc`}
                    className="mt-0.5 block text-xs leading-relaxed text-iw-text-muted"
                  >
                    {opt.description}
                  </span>
                ) : null}
              </span>
              <span className={checkClass(checked)} aria-hidden="true">
                {checked ? (
                  <svg
                    className="h-3.5 w-3.5 text-white"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 8 7 12 13 4" />
                  </svg>
                ) : null}
              </span>
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

PillCardGroup.displayName = "Assessment/PillCardGroup";
