"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Tutor/TutorMessage
 *
 * Sprint 8: AIVO tutor chat must NOT look like a generic messaging
 * app. Each message is a soft learning card with role, optional
 * insight chip ("Hint", "Adapting difficulty", "Safety filter on"),
 * companion avatar, and a body slot that can hold rich content —
 * not just text.
 *
 * The component has no scrollback semantics; the host arranges
 * messages in a list. Author can be:
 *   - "tutor"   : AI tutor (purple-tinted with companion)
 *   - "learner" : the child (right-aligned, neutral card)
 *   - "system"  : non-author (centered slim chip — e.g. "lesson started")
 */
export type TutorAuthor = "tutor" | "learner" | "system";

export interface TutorMessageProps {
  author: TutorAuthor;
  /** Optional name displayed above the message. */
  name?: React.ReactNode;
  /** Optional companion avatar (emoji, image, or node). */
  avatar?: React.ReactNode;
  /** Optional insight chip rendered inside the message header. */
  insight?: React.ReactNode;
  /** Message body — text, lists, formula, anything. */
  children: React.ReactNode;
  /** Timestamp (already formatted). */
  when?: React.ReactNode;
  /** Optional action row pinned to the bottom of the card. */
  actions?: React.ReactNode;
  /** When true, the card renders with a soft border-pulse to signal "tutor thinking". */
  thinking?: boolean;
  className?: string;
}

export function TutorMessage({
  author,
  name,
  avatar,
  insight,
  children,
  when,
  actions,
  thinking,
  className,
}: TutorMessageProps) {
  if (author === "system") {
    return (
      <div role="status" className={cn("flex items-center justify-center my-2", className)}>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-iw-chip bg-[var(--aivo-color-surface-muted)] text-iw-text-muted text-xs font-medium">
          {children}
        </span>
      </div>
    );
  }
  const isLearner = author === "learner";
  return (
    <article
      className={cn(
        "flex gap-3 items-start",
        isLearner ? "flex-row-reverse" : "flex-row",
        className,
      )}
    >
      {avatar ? (
        <span
          className={cn(
            "shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center text-xl",
            isLearner
              ? "bg-[var(--aivo-color-surface-muted)] text-iw-text-strong"
              : "bg-[var(--aivo-color-aivoPurple-50)] text-[var(--aivo-color-aivoPurple-700)]",
          )}
          aria-hidden="true"
        >
          {avatar}
        </span>
      ) : null}
      <div className={cn("flex-1 min-w-0 flex flex-col gap-1", isLearner && "items-end")}>
        {(name || insight || when) && (
          <header className="flex items-center gap-2 flex-wrap text-xs text-iw-text-muted">
            {name ? <span className="font-semibold">{name}</span> : null}
            {insight}
            {when ? <span className="text-[11px]">{when}</span> : null}
          </header>
        )}
        <div
          className={cn(
            "border p-4 max-w-[36rem]",
            // Handoff (LearnerApp/HomeworkHelper) chat bubble: the asymmetric
            // corner points back at the avatar, with a lavender hairline border;
            // the tutor card carries a soft warm-purple drop shadow.
            isLearner
              ? "rounded-[18px_4px_18px_18px] bg-[var(--aivo-color-aivoPurple-50)] border-[var(--aivo-color-aivoPurple-100)] text-iw-text-strong"
              : "rounded-[4px_18px_18px_18px] bg-white border-[var(--aivo-color-aivoPurple-100)] text-iw-text-strong shadow-[0_8px_22px_rgba(60,40,110,0.06)]",
            thinking && "ring-2 ring-[var(--aivo-color-aivoPurple-100)] aivo-motion-ai-thinking",
          )}
        >
          {children}
        </div>
        {actions ? <div className="flex items-center gap-2 mt-1">{actions}</div> : null}
      </div>
    </article>
  );
}

TutorMessage.displayName = "Tutor/TutorMessage";
