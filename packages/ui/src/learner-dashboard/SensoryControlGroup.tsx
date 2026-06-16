"use client";
import * as React from "react";
import { cn } from "../utils/cn.js";

/**
 * LearnerDashboard/SensoryControlGroup
 *
 * Segmented-button control used in the workspace rail for sensory-
 * adaptive preferences: Mood, Spacing, Font Style, Sound, etc.
 *
 * Headless contract — caller controls `value` + `onChange`. Each
 * option is rendered as a soft-rounded tile with an optional icon
 * above the label. Selected tile gets the indigo ring + tinted
 * background; unselected tiles are quiet white.
 *
 * Keyboard model: arrow keys move focus and select, matching the
 * WAI-ARIA radiogroup pattern.
 */
export interface SensoryControlOption<V extends string = string> {
  value: V;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

export interface SensoryControlGroupProps<V extends string = string> {
  label: string;
  value: V;
  onChange: (next: V) => void;
  options: SensoryControlOption<V>[];
  /** Visual density. `compact` removes the icon row. */
  density?: "comfortable" | "compact";
  className?: string;
  /** Optional cap on columns when there are 3+ options. */
  columns?: 2 | 3;
}

export function SensoryControlGroup<V extends string = string>({
  label,
  value,
  onChange,
  options,
  density = "comfortable",
  className,
  columns,
}: SensoryControlGroupProps<V>) {
  const resolvedCols = columns ?? (options.length >= 3 ? 3 : 2);
  const onKeyDown = (e: React.KeyboardEvent, idx: number) => {
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      const next = options[(idx + 1) % options.length];
      onChange(next.value);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = options[(idx - 1 + options.length) % options.length];
      onChange(next.value);
    }
  };
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <span className="iw-label-sm text-iw-text-muted">{label}</span>
      <div
        role="radiogroup"
        aria-label={label}
        className={cn("grid gap-2", resolvedCols === 3 ? "grid-cols-3" : "grid-cols-2")}
      >
        {options.map((opt, idx) => {
          const selected = opt.value === value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              type="button"
              onClick={() => onChange(opt.value)}
              onKeyDown={(e) => onKeyDown(e, idx)}
              className={cn(
                "group flex flex-col items-center justify-center gap-1 rounded-iw-control border px-2 transition-all",
                density === "comfortable" ? "py-3" : "py-2",
                selected
                  ? "bg-[var(--color-aivo-primary-soft)] border-[var(--color-aivo-primary)] text-[var(--color-aivo-primary)] shadow-[inset_0_0_0_1px_var(--color-aivo-primary)]"
                  : "bg-white border-iw-border/60 text-iw-text-strong hover:bg-iw-bg",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aivo-primary)] focus-visible:ring-offset-2",
              )}
            >
              {opt.icon && density === "comfortable" ? (
                <span
                  aria-hidden="true"
                  className="w-5 h-5 inline-flex items-center justify-center"
                >
                  {opt.icon}
                </span>
              ) : null}
              <span className="text-sm font-semibold leading-tight text-center">{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

SensoryControlGroup.displayName = "LearnerDashboard/SensoryControlGroup";
