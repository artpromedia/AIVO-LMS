"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Auth/ReassuranceCard
 *
 * A floating, low-noise card used to answer "why are you asking me
 * this?" inline next to a sensitive field or consent row. Tone is
 * informational by default; use `tone="safety"` for child-safety
 * statements and `tone="privacy"` for data-use statements.
 *
 * Keep copy short. One claim per card. Never put marketing copy here.
 */
export interface ReassuranceCardProps {
  tone?: "info" | "privacy" | "safety";
  icon?: React.ReactNode;
  title: React.ReactNode;
  body: React.ReactNode;
  /** Optional "learn more" link — opens a LegalCollapse or external page. */
  link?: { href: string; label: React.ReactNode };
  className?: string;
}

const TONE_CLASS: Record<NonNullable<ReassuranceCardProps["tone"]>, string> = {
  info: "bg-[var(--aivo-status-info-subtle,#eff6ff)] text-[var(--aivo-status-info-strong,#2563eb)]",
  privacy:
    "bg-[var(--aivo-color-aivoTeal-50,#f0fdfa)] text-[var(--aivo-color-aivoTeal-700,#0f766e)]",
  safety:
    "bg-[var(--aivo-domain-safety-safe-subtle,#ecfdf5)] text-[var(--aivo-domain-safety-safe-strong,#047857)]",
};

export function ReassuranceCard({
  tone = "info",
  icon,
  title,
  body,
  link,
  className,
}: ReassuranceCardProps) {
  return (
    <aside
      className={cn(
        "rounded-iw-card border border-iw-border bg-white",
        "p-4 flex items-start gap-3",
        className,
      )}
    >
      {icon ? (
        <span
          className={cn(
            "shrink-0 w-9 h-9 rounded-iw-control flex items-center justify-center",
            TONE_CLASS[tone],
          )}
          aria-hidden="true"
        >
          {icon}
        </span>
      ) : null}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-iw-text-strong">{title}</p>
        <p className="text-xs text-iw-text-muted leading-relaxed mt-0.5">
          {body}
        </p>
        {link ? (
          <a
            href={link.href}
            className="inline-block mt-1.5 text-xs font-semibold text-[var(--aivo-sensory-primary,#7c3aed)] hover:underline"
          >
            {link.label}
          </a>
        ) : null}
      </div>
    </aside>
  );
}

ReassuranceCard.displayName = "Auth/ReassuranceCard";
