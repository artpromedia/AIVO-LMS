"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Curriculum/SkillNodeCard
 *
 * One node on the soft skill-graph view. Renders the skill name,
 * standard alignment, district approval state, and a soft mastery
 * indicator. Each card is a tap target — caller passes `href`.
 *
 * Status drives the side accent:
 *   approved   green (district-approved)
 *   review     orange (awaiting review)
 *   draft      grey (not yet ready)
 *   prereq     muted (locked, prerequisite of another)
 */
export type SkillNodeStatus = "approved" | "review" | "draft" | "prereq";

export interface SkillNodeCardProps {
  href: string;
  name: React.ReactNode;
  /** Standard code (e.g. "RL.3.1"). */
  standardCode?: React.ReactNode;
  /** Subject eyebrow. */
  subject?: React.ReactNode;
  status: SkillNodeStatus;
  /** Prerequisite count. */
  prerequisiteCount?: number;
  /** Mastery percentage (0-100) for the learner. */
  masteryPct?: number;
  className?: string;
}

const ACCENT: Record<SkillNodeStatus, string> = {
  approved: "bg-[var(--aivo-color-status-success-strong)]",
  review: "bg-[var(--aivo-color-status-warning-strong)]",
  draft: "bg-[var(--aivo-color-surface-muted)]",
  prereq: "bg-[var(--aivo-color-aivoPurple-200)]",
};

const STATUS_LABEL: Record<SkillNodeStatus, string> = {
  approved: "District approved",
  review: "Awaiting review",
  draft: "Draft",
  prereq: "Prerequisite",
};

const STATUS_TINT: Record<SkillNodeStatus, string> = {
  approved:
    "bg-[var(--aivo-color-status-success-subtle)] text-[var(--aivo-color-status-success-strong)]",
  review:
    "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)]",
  draft: "bg-[var(--aivo-color-surface-muted)] text-iw-text-muted",
  prereq: "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)]",
};

export function SkillNodeCard({
  href,
  name,
  standardCode,
  subject,
  status,
  prerequisiteCount,
  masteryPct,
  className,
}: SkillNodeCardProps) {
  return (
    <a
      href={href}
      className={cn(
        "relative flex flex-col gap-2 rounded-iw-card-lg bg-white border border-iw-border",
        "pl-5 pr-4 py-4 transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-[var(--aivo-color-surface-canvas)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute left-0 top-0 bottom-0 w-1 rounded-l-iw-card-lg", ACCENT[status])}
      />
      <header className="flex items-center justify-between gap-2">
        {subject ? <p className="iw-label text-iw-text-muted">{subject}</p> : <span />}
        <span
          className={cn(
            "inline-flex items-center px-2 py-0.5 rounded-iw-chip text-[10px] font-semibold uppercase tracking-wide",
            STATUS_TINT[status],
          )}
        >
          {STATUS_LABEL[status]}
        </span>
      </header>
      <p className="text-base font-semibold text-iw-text-strong leading-snug">{name}</p>
      <footer className="flex items-center justify-between gap-2 text-xs text-iw-text-muted">
        {standardCode ? (
          <span className="font-mono text-[11px] tabular-nums">{standardCode}</span>
        ) : (
          <span />
        )}
        <span className="flex items-center gap-3">
          {typeof prerequisiteCount === "number" && prerequisiteCount > 0 ? (
            <span>
              {prerequisiteCount} prereq{prerequisiteCount === 1 ? "" : "s"}
            </span>
          ) : null}
          {typeof masteryPct === "number" ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="w-12 h-1 rounded-full bg-[var(--aivo-color-surface-muted)] overflow-hidden inline-block">
                <span
                  className="block h-full bg-[var(--aivo-sensory-primary)]"
                  style={{ width: `${Math.max(0, Math.min(100, masteryPct))}%` }}
                />
              </span>
              <span className="tabular-nums font-semibold text-iw-text-strong">
                {Math.round(masteryPct)}%
              </span>
            </span>
          ) : null}
        </span>
      </footer>
    </a>
  );
}

SkillNodeCard.displayName = "Curriculum/SkillNodeCard";
