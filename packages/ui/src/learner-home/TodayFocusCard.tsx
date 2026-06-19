"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * LearnerHome/TodayFocusCard
 *
 * The "Continue learning" / today's focus card on the learner home.
 * One primary action — Sprint 7 spec is firm that the learner knows
 * exactly what to do next.
 *
 * Slot model:
 *   - eyebrow (e.g. "Continue · Reading")
 *   - title   (skill name)
 *   - body    (one-line learner reason)
 *   - meta    (chips: time estimate, tutor, support)
 *   - action  (one CTA — Start / Resume / Pause)
 */
export interface TodayFocusCardProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  meta?: React.ReactNode;
  action: React.ReactNode;
  /** Accent — tints the eyebrow + a soft corner glow. */
  accent?: string;
  /** Optional companion (tutor avatar). */
  companion?: React.ReactNode;
  /**
   * Large decorative glyph (emoji / icon) floated at the right edge — the
   * handoff "Today's next step" hero shows e.g. a 📖. Purely ornamental;
   * the title/body get right padding so text never collides with it.
   */
  decoration?: React.ReactNode;
  className?: string;
}

export function TodayFocusCard({
  eyebrow,
  title,
  body,
  meta,
  action,
  accent = "var(--aivo-sensory-primary)",
  companion,
  decoration,
  className,
}: TodayFocusCardProps) {
  return (
    <article
      className={cn(
        // Handoff (LearnerApp) hero: lavender gradient card, soft warm shadow,
        // 24px radius — no clinical white surface.
        "relative overflow-hidden rounded-[24px] border border-[var(--aivo-color-aivoPurple-100,#e4ddf4)]",
        "bg-gradient-to-br from-[var(--aivo-color-aivoPurple-50,#eee9fb)] to-[#f3eefe]",
        "shadow-[0_8px_24px_rgba(60,40,110,0.06)]",
        "p-6 md:p-7 flex flex-col gap-4",
        className,
      )}
    >
      {/* Soft accent glow in the corner — keeps the card tied to the subject color. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-20 blur-2xl"
        style={{ backgroundColor: accent }}
      />
      {decoration ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-5 top-1/2 -translate-y-1/2 select-none text-[72px] leading-none opacity-90 md:text-[88px]"
        >
          {decoration}
        </span>
      ) : null}
      <header className={cn("relative flex items-start gap-4", decoration && "pr-20 md:pr-24")}>
        {companion ? <div aria-hidden="true">{companion}</div> : null}
        <div className="flex-1 min-w-0">
          {eyebrow ? (
            <p
              className="text-[12px] font-extrabold uppercase tracking-[0.1em]"
              style={{ color: accent }}
            >
              {eyebrow}
            </p>
          ) : null}
          <h2 className="font-iw-display text-2xl md:text-[34px] font-bold text-iw-text-strong leading-[1.08]">
            {title}
          </h2>
          {body ? (
            <p className="text-sm md:text-base text-iw-text-muted leading-relaxed mt-1.5">{body}</p>
          ) : null}
        </div>
      </header>
      {meta ? <div className="relative flex items-center gap-2 flex-wrap">{meta}</div> : null}
      <footer className="relative flex">{action}</footer>
    </article>
  );
}

TodayFocusCard.displayName = "LearnerHome/TodayFocusCard";
