"use client";
import * as React from "react";
import { cn } from "../utils/cn.js";

/**
 * LearnerDashboard/LearnerLevelBadge
 *
 * "Level: EMERGING" pill that sits at the right end of the top stat
 * strip. A small status dot followed by the label.
 */
export interface LearnerLevelBadgeProps {
  level: string;
  className?: string;
}

export function LearnerLevelBadge({ level, className }: LearnerLevelBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-full",
        "bg-[var(--color-aivo-primary-soft)]",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="w-1.5 h-1.5 rounded-full bg-[var(--color-aivo-primary)]"
      />
      <span className="text-sm font-semibold text-iw-text-strong">
        Level: <span className="text-[var(--color-aivo-primary)]">{level.toUpperCase()}</span>
      </span>
    </span>
  );
}

LearnerLevelBadge.displayName = "LearnerDashboard/LearnerLevelBadge";
