"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Auth/ConsentRow
 *
 * One unit of consent. Each row carries:
 *   - a clear question (never marketing copy)
 *   - a short "why we ask" explanation
 *   - an explicit on/off control
 *   - an optional `required` flag that disables the off state
 *
 * Sprint-3 acceptance criteria require parent consent, school consent,
 * and AI personalization consent to be SEPARATE rows. Render one
 * ConsentRow per bucket; do not bundle them behind a single switch.
 */
export interface ConsentRowProps {
  id: string;
  title: React.ReactNode;
  /** One-sentence explanation; longer text belongs in a LegalCollapse. */
  description: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** When true, the user cannot disable this row (e.g. parental consent for school accounts). */
  required?: boolean;
  /** When set, render a small badge ("Required", "Recommended", "Optional"). */
  badge?: React.ReactNode;
  /** Optional icon. */
  icon?: React.ReactNode;
  className?: string;
}

export function ConsentRow({
  id,
  title,
  description,
  checked,
  onChange,
  required,
  badge,
  icon,
  className,
}: ConsentRowProps) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-3 rounded-iw-card border border-iw-border bg-white p-4",
        "cursor-pointer",
        checked && "ring-2 ring-[var(--aivo-sensory-primary,#7c3aed)]/30",
        className,
      )}
    >
      {icon ? (
        <span className="shrink-0 mt-0.5 text-iw-text-muted" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-iw-text-strong">{title}</p>
          {badge ? (
            <span className="text-[10px] uppercase tracking-wide font-bold px-1.5 py-0.5 rounded-iw-chip bg-[var(--aivo-color-surface-canvas,#f4f6f5)] text-iw-text-muted">
              {badge}
            </span>
          ) : null}
        </div>
        <p className="text-xs text-iw-text-muted mt-0.5 leading-relaxed">{description}</p>
      </div>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={required}
        aria-required={required ? true : undefined}
        className={cn(
          "shrink-0 mt-1 w-5 h-5 rounded border-iw-border",
          "text-[var(--aivo-sensory-primary,#7c3aed)]",
          "focus:ring-2 focus:ring-[var(--aivo-sensory-primary,#7c3aed)] focus:ring-offset-2",
        )}
      />
    </label>
  );
}

ConsentRow.displayName = "Auth/ConsentRow";
