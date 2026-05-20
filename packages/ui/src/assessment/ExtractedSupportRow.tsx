"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/ExtractedSupportRow
 *
 * One reviewable row in the "extracted supports preview" screen. Shows
 * the support label, a calm one-line description, the document
 * provenance (e.g. "Page 3"), and a toggle so the parent can opt-in
 * or out before the support feeds personalization.
 *
 * Renders the toggle as a native checkbox so the form posts back the
 * selected supports without client JS.
 */
export interface ExtractedSupportRowProps {
  name: string;
  value: string;
  label: React.ReactNode;
  /** Short, friendly description of the support. */
  description?: React.ReactNode;
  /** Where in the source document the support was found. */
  provenance?: React.ReactNode;
  /** Confidence chip (e.g. "High match" / "Needs your review"). */
  confidence?: "high" | "medium" | "low";
  /** Whether the support is consented-to by default. */
  defaultChecked?: boolean;
  /** Required supports cannot be toggled off (visual lock). */
  required?: boolean;
  className?: string;
}

const CONFIDENCE_LABEL: Record<NonNullable<ExtractedSupportRowProps["confidence"]>, string> = {
  high: "High confidence",
  medium: "Worth a glance",
  low: "Please confirm",
};
const CONFIDENCE_TINT: Record<NonNullable<ExtractedSupportRowProps["confidence"]>, string> = {
  high: "bg-[var(--aivo-color-status-success-subtle,#f0fdf4)] text-[var(--aivo-color-status-success-strong,#15803d)]",
  medium: "bg-[var(--aivo-color-status-info-subtle,#eff6ff)] text-[var(--aivo-color-status-info-strong,#1d4ed8)]",
  low: "bg-[var(--aivo-color-status-warning-subtle,#fffbeb)] text-[var(--aivo-color-status-warning-strong,#b45309)]",
};

export function ExtractedSupportRow({
  name,
  value,
  label,
  description,
  provenance,
  confidence,
  defaultChecked = true,
  required,
  className,
}: ExtractedSupportRowProps) {
  const [checked, setChecked] = React.useState(defaultChecked);
  const id = `${name}-${value}`;
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex items-start gap-4 cursor-pointer select-none",
        "rounded-iw-card border bg-white p-4 transition-colors",
        checked
          ? "border-[var(--aivo-color-aivoPurple-200,#ddd6fe)] bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)]/40"
          : "border-iw-border",
        required && "opacity-100 cursor-default",
        "focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--aivo-sensory-ringFocus,#7c3aed)] focus-within:ring-offset-2 focus-within:ring-offset-white",
        className,
      )}
    >
      <span className="relative shrink-0 mt-0.5">
        <input
          id={id}
          name={name}
          type="checkbox"
          value={value}
          defaultChecked={defaultChecked}
          disabled={required}
          onChange={(e) => setChecked(e.currentTarget.checked)}
          className="sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            "w-5 h-5 rounded-[6px] border-2 flex items-center justify-center transition-colors",
            checked
              ? "border-[var(--aivo-sensory-primary,#7c3aed)] bg-[var(--aivo-sensory-primary,#7c3aed)]"
              : "border-iw-border bg-white",
          )}
        >
          {checked ? (
            <svg
              className="w-3 h-3 text-white"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 8 7 12 13 4" />
            </svg>
          ) : null}
        </span>
      </span>
      <span className="flex-1 min-w-0 flex flex-col gap-1">
        <span className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-iw-text-strong">
            {label}
          </span>
          {confidence ? (
            <span
              className={cn(
                "inline-flex items-center px-2 py-0.5 rounded-iw-chip text-[10px] font-semibold uppercase tracking-wide",
                CONFIDENCE_TINT[confidence],
              )}
            >
              {CONFIDENCE_LABEL[confidence]}
            </span>
          ) : null}
          {required ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-iw-chip text-[10px] font-semibold uppercase tracking-wide bg-[var(--aivo-color-surface-muted,#f1f5f9)] text-iw-text-muted">
              Required by IEP
            </span>
          ) : null}
        </span>
        {description ? (
          <span className="text-xs text-iw-text-muted leading-relaxed">
            {description}
          </span>
        ) : null}
        {provenance ? (
          <span className="text-[11px] text-iw-text-muted/80 mt-0.5">
            {provenance}
          </span>
        ) : null}
      </span>
    </label>
  );
}

ExtractedSupportRow.displayName = "Assessment/ExtractedSupportRow";
