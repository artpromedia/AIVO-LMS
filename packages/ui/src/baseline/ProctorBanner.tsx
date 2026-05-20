"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/ProctorBanner
 *
 * Visible banner shown at the top of the learner experience when a
 * parent or teacher is in proctor mode (driving the session on behalf
 * of the learner). Required by the Sprint 6 spec so the learner — and
 * any observer — always knows who's at the controls.
 *
 * Tone follows the role: parent = primary; teacher = accent. The
 * banner is decorative but renders an aria-status node so screen
 * readers announce the change on the first paint.
 */
export interface ProctorBannerProps {
  role: "parent" | "teacher";
  /** Name of the proctor (for the announcement). */
  proctorName: React.ReactNode;
  /** Name of the learner. */
  learnerName: React.ReactNode;
  /** Optional exit / hand-off action. */
  exit?: React.ReactNode;
  className?: string;
}

export function ProctorBanner({
  role,
  proctorName,
  learnerName,
  exit,
  className,
}: ProctorBannerProps) {
  const tint =
    role === "parent"
      ? "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]"
      : "bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border-[var(--aivo-color-aivoTeal-100)]";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("border-b", tint, className)}
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-2 flex items-center gap-3 justify-between flex-wrap">
        <p className="text-xs font-semibold flex items-center gap-2">
          <svg
            className="w-3.5 h-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          {role === "parent" ? "Parent view" : "Teacher view"} · {proctorName} is helping{" "}
          {learnerName}
        </p>
        {exit}
      </div>
    </div>
  );
}

ProctorBanner.displayName = "Baseline/ProctorBanner";
