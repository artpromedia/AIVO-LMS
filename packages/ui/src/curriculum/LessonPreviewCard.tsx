"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Curriculum/LessonPreviewCard
 *
 * The teacher-facing card for an AI-generated lesson awaiting
 * review. Sprint 13 spec requires this surface to prove alignment:
 *  - what skill the lesson targets
 *  - what standard it satisfies
 *  - what prerequisites
 *  - what content sources fed the generation
 *  - teacher approval state
 *
 * The card itself doesn't own approval logic — the host page wires
 * the actions (Approve / Edit / Reject) into a form.
 */
export type LessonApprovalState = "pending" | "approved" | "rejected" | "needs_edit";

export interface LessonPreviewCardProps {
  /** Skill name. */
  skillName: React.ReactNode;
  /** Standard code (e.g. "RL.3.1"). */
  standardCode?: React.ReactNode;
  /** Subject eyebrow. */
  subject?: React.ReactNode;
  /** Brief lesson summary / headline. */
  summary: React.ReactNode;
  /** Approval state ribbon. */
  state: LessonApprovalState;
  /** Estimated minutes. */
  estimateMinutes?: number;
  /** Prerequisite skill list. */
  prerequisites?: ReadonlyArray<React.ReactNode>;
  /** Sources used to generate the lesson. */
  sources?: ReadonlyArray<React.ReactNode>;
  /** Optional sensory / accommodation chips. */
  accommodations?: ReadonlyArray<React.ReactNode>;
  /** Actions slot — typically Approve / Edit / Reject buttons. */
  actions?: React.ReactNode;
  className?: string;
}

const STATE_TINT: Record<LessonApprovalState, string> = {
  pending:
    "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]",
  approved:
    "bg-[var(--aivo-color-status-success-subtle)] text-[var(--aivo-color-status-success-strong)] border-[var(--aivo-color-status-success-default)]",
  rejected:
    "bg-[var(--aivo-color-status-error-subtle)] text-[var(--aivo-color-status-error-strong)] border-[var(--aivo-color-status-error-default)]",
  needs_edit:
    "bg-[var(--aivo-color-status-warning-subtle)] text-[var(--aivo-color-status-warning-strong)] border-[var(--aivo-color-status-warning-default)]",
};

const STATE_LABEL: Record<LessonApprovalState, string> = {
  pending: "Awaiting your review",
  approved: "Approved",
  rejected: "Rejected",
  needs_edit: "Needs edits",
};

export function LessonPreviewCard({
  skillName,
  standardCode,
  subject,
  summary,
  state,
  estimateMinutes,
  prerequisites,
  sources,
  accommodations,
  actions,
  className,
}: LessonPreviewCardProps) {
  return (
    <article
      className={cn(
        "rounded-iw-card-lg bg-white border border-iw-border",
        "shadow-[0_4px_12px_rgba(15,23,42,0.04),0_24px_48px_-20px_rgba(15,23,42,0.10)]",
        "p-5 md:p-6 flex flex-col gap-4",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          {subject ? <p className="iw-label text-iw-text-muted">{subject}</p> : null}
          <h3 className="text-xl md:text-2xl font-semibold text-iw-text-strong leading-snug mt-1">
            {skillName}
          </h3>
          {standardCode ? (
            <p className="text-xs text-iw-text-muted font-mono mt-0.5">{standardCode}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "inline-flex items-center px-2.5 py-1 rounded-iw-chip border text-[11px] font-semibold uppercase tracking-wide shrink-0",
            STATE_TINT[state],
          )}
        >
          {STATE_LABEL[state]}
        </span>
      </header>

      <p className="text-sm md:text-base text-iw-text-strong leading-relaxed">{summary}</p>

      <dl className="grid gap-3 md:grid-cols-2 text-sm">
        {typeof estimateMinutes === "number" ? (
          <div>
            <dt className="iw-label text-iw-text-muted">Estimated time</dt>
            <dd className="font-semibold text-iw-text-strong tabular-nums">
              {estimateMinutes} min
            </dd>
          </div>
        ) : null}
        {prerequisites && prerequisites.length > 0 ? (
          <div>
            <dt className="iw-label text-iw-text-muted">Prerequisite skills</dt>
            <dd className="flex flex-wrap gap-1.5 mt-1">
              {prerequisites.map((p, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-iw-chip text-[11px] font-semibold bg-[var(--aivo-color-surface-muted)] text-iw-text-strong"
                >
                  {p}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
        {sources && sources.length > 0 ? (
          <div className="md:col-span-2">
            <dt className="iw-label text-iw-text-muted">Generated from</dt>
            <dd className="flex flex-wrap gap-1.5 mt-1">
              {sources.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-iw-chip text-[11px] font-semibold bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)] border border-[var(--aivo-color-status-info-default)]"
                >
                  {s}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
        {accommodations && accommodations.length > 0 ? (
          <div className="md:col-span-2">
            <dt className="iw-label text-iw-text-muted">Accommodations applied</dt>
            <dd className="flex flex-wrap gap-1.5 mt-1">
              {accommodations.map((a, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-iw-chip text-[11px] font-semibold bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border border-[var(--aivo-color-aivoTeal-100)]"
                >
                  {a}
                </span>
              ))}
            </dd>
          </div>
        ) : null}
      </dl>

      {actions ? (
        <footer className="flex items-center justify-end gap-2 flex-wrap pt-2 border-t border-iw-border">
          {actions}
        </footer>
      ) : null}
    </article>
  );
}

LessonPreviewCard.displayName = "Curriculum/LessonPreviewCard";
