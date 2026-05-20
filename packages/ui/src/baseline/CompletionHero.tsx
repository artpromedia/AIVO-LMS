"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/CompletionHero
 *
 * Calm completion screen rendered when the learner finishes the
 * baseline. Intentionally low-key — there are no scores, no leaderboards,
 * no badges. Just a warm acknowledgement, a soft summary, and a
 * forward action.
 *
 * Per Sprint 6 spec the completion language must avoid shame and
 * pressure: "Nice work" / "Thanks for showing me how you think" — never
 * "You got X out of Y" unless the parent/teacher view requests it via
 * `showAnswered`.
 */
export interface CompletionHeroProps {
  /** Learner first name. */
  learnerName?: React.ReactNode;
  /** Optional answered/total caption (shown only when requested). */
  answered?: number;
  total?: number;
  /** When false (default) the answered/total caption is hidden from the learner view. */
  showAnswered?: boolean;
  /** Hero headline override. */
  title?: React.ReactNode;
  /** Body copy override. */
  body?: React.ReactNode;
  /** "What AIVO learned" chips — strings rendered as soft pills. */
  learned?: ReadonlyArray<React.ReactNode>;
  /** Primary action (Link or button). */
  primary?: React.ReactNode;
  /** Secondary action. */
  secondary?: React.ReactNode;
  className?: string;
}

export function CompletionHero({
  learnerName,
  answered,
  total,
  showAnswered = false,
  title,
  body,
  learned,
  primary,
  secondary,
  className,
}: CompletionHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-iw-hero",
        "bg-gradient-to-br from-[var(--aivo-color-aivoPurple-50)] via-white to-[var(--aivo-color-aivoOrange-50)]",
        "border border-iw-border shadow-[0_24px_64px_-24px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)]",
        "p-6 md:p-10 flex flex-col gap-6",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className="shrink-0 w-14 h-14 rounded-2xl bg-white shadow-[0_4px_16px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)] inline-flex items-center justify-center text-[var(--aivo-sensory-primary)]"
          aria-hidden="true"
        >
          <svg
            className="w-7 h-7"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5 min-w-0">
          <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong leading-snug">
            {title ?? (
              <>
                Thanks{learnerName ? <>, {learnerName}</> : ""} — that's plenty for AIVO to start.
              </>
            )}
          </h1>
          <p className="text-sm md:text-base text-iw-text-muted leading-relaxed max-w-2xl">
            {body ??
              "There are no grades here. AIVO uses what you showed it to plan calm, just-right lessons."}
          </p>
          {showAnswered && typeof answered === "number" && typeof total === "number" ? (
            <p className="text-xs text-iw-text-muted mt-1">
              You answered <span className="tabular-nums font-semibold">{answered}</span> of{" "}
              <span className="tabular-nums">{total}</span> questions.
            </p>
          ) : null}
        </div>
      </div>

      {learned && learned.length ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-iw-text-muted">
            What AIVO learned about you
          </p>
          <div className="flex flex-wrap gap-2">
            {learned.map((tag, i) => (
              <span
                key={i}
                className="inline-flex items-center px-2.5 py-1 rounded-iw-chip text-xs font-semibold bg-white text-iw-text-strong border border-iw-border"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {(primary || secondary) && (
        <div className="flex items-center gap-3 flex-wrap">
          {primary}
          {secondary}
        </div>
      )}
    </section>
  );
}

CompletionHero.displayName = "Baseline/CompletionHero";
