"use client";
import * as React from "react";
import { cn } from "../utils/cn.js";

/**
 * LearnerDashboard/LearnerProfileCard
 *
 * Sidebar identity card: round avatar (initials or image), display
 * name, role badge, and approval status pill. Used at the top of the
 * learner workspace rail.
 */
export interface LearnerProfileCardProps {
  name: string;
  initials?: string;
  avatarUrl?: string;
  roleLabel?: string;
  approvalStatus?: "approved" | "pending" | "review" | null;
  className?: string;
}

const STATUS_COPY: Record<NonNullable<LearnerProfileCardProps["approvalStatus"]>, string> = {
  approved: "Approved",
  pending: "Pending",
  review: "In review",
};

const STATUS_CLS: Record<NonNullable<LearnerProfileCardProps["approvalStatus"]>, string> = {
  approved:
    "bg-[var(--aivo-meadow-50)] text-[var(--aivo-meadow-700)] border-[var(--aivo-meadow-200)]",
  pending:
    "bg-[var(--aivo-sunshine-50)] text-[var(--aivo-sunshine-700)] border-[var(--aivo-sunshine-200)]",
  review:
    "bg-[var(--aivo-calmSky-50)] text-[var(--aivo-calmSky-700)] border-[var(--aivo-calmSky-200)]",
};

export function LearnerProfileCard({
  name,
  initials,
  avatarUrl,
  roleLabel = "Learner",
  approvalStatus = "approved",
  className,
}: LearnerProfileCardProps) {
  const fallback = (initials || name.slice(0, 2)).toUpperCase();
  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-2xl bg-white border border-iw-border/60",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="w-12 h-12 rounded-full inline-flex items-center justify-center shrink-0 text-sm font-bold bg-[var(--color-aivo-primary-soft)] text-[var(--color-aivo-primary)]"
        style={
          avatarUrl
            ? {
                backgroundImage: `url(${avatarUrl})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : undefined
        }
      >
        {avatarUrl ? "" : fallback}
      </span>
      <div className="flex flex-col gap-1 min-w-0">
        <span className="font-bold text-iw-text-strong truncate">{name}</span>
        <span className="inline-flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--color-aivo-primary-soft)] text-[var(--color-aivo-primary)]">
            {roleLabel}
          </span>
          {approvalStatus ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-semibold",
                STATUS_CLS[approvalStatus],
              )}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                aria-hidden="true"
                className="shrink-0"
                fill="currentColor"
              >
                <path d="M8 1.5 2.75 4v3.78c0 3.3 2.27 6.38 5.25 7.22 2.98-.84 5.25-3.92 5.25-7.22V4L8 1.5Zm-.94 9.86L4.5 8.8l1.06-1.06 1.5 1.5 3.38-3.38L11.5 6.92l-4.44 4.44Z" />
              </svg>
              {STATUS_COPY[approvalStatus]}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}

LearnerProfileCard.displayName = "LearnerDashboard/LearnerProfileCard";
