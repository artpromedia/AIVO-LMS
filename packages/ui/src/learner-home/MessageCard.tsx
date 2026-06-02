"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * LearnerHome/MessageCard
 *
 * Soft card for parent/teacher messages, break reminders, and tutor
 * nudges shown on the learner home. Renders a small avatar / icon,
 * a one-line title, a short body, and a single CTA.
 *
 * `from` drives the tint — "parent" / "teacher" / "tutor" / "system".
 */
export type MessageFrom = "parent" | "teacher" | "tutor" | "system" | "break";

export interface MessageCardProps {
  from: MessageFrom;
  /** Optional name override ("Ms. Rivera", "Mom"). */
  sender?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Optional time-ago string. */
  when?: React.ReactNode;
  /** Optional avatar (image url string, emoji, or node). */
  avatar?: React.ReactNode;
  /** CTA — a Link or button. */
  action?: React.ReactNode;
  className?: string;
}

const FROM_TINT: Record<MessageFrom, string> = {
  parent:
    "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)] border-[var(--aivo-color-aivoPurple-100)]",
  teacher:
    "bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border-[var(--aivo-color-aivoTeal-100)]",
  tutor:
    "bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] border-[var(--aivo-color-aivoOrange-100)]",
  system:
    "bg-[var(--aivo-color-surface-muted)] text-[var(--aivo-color-text-default)] border-iw-border",
  break:
    "bg-[var(--aivo-color-status-info-subtle)] text-[var(--aivo-color-status-info-strong)] border-[var(--aivo-color-status-info-default)]",
};

const FROM_LABEL: Record<MessageFrom, string> = {
  parent: "From a grown-up",
  teacher: "From your teacher",
  tutor: "From your tutor",
  system: "From AIVO",
  break: "Time for a break?",
};

export function MessageCard({
  from,
  sender,
  title,
  body,
  when,
  avatar,
  action,
  className,
}: MessageCardProps) {
  return (
    <article
      className={cn(
        "rounded-iw-card-lg bg-white border border-iw-border p-4 md:p-5 flex flex-col gap-3",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <span
          className={cn(
            "shrink-0 w-10 h-10 rounded-iw-control inline-flex items-center justify-center text-base font-semibold border",
            FROM_TINT[from],
          )}
          aria-hidden="true"
        >
          {avatar ?? sender?.toString().slice(0, 1)?.toUpperCase() ?? "·"}
        </span>
        <div className="flex-1 min-w-0">
          <p className="iw-label text-iw-text-muted truncate">
            {FROM_LABEL[from]}
            {sender ? <> · {sender}</> : null}
          </p>
          <p className="text-sm font-semibold text-iw-text-strong truncate">{title}</p>
        </div>
        {when ? <span className="text-[11px] text-iw-text-muted shrink-0">{when}</span> : null}
      </header>
      {body ? <p className="text-sm text-iw-text-muted leading-relaxed">{body}</p> : null}
      {action ? <div className="flex">{action}</div> : null}
    </article>
  );
}

MessageCard.displayName = "LearnerHome/MessageCard";
