"use client";
import * as React from "react";
import { cn } from "../utils/cn.js";
import { TutorAvatar, type TutorAvatarTone } from "./TutorAvatar.js";

/**
 * LearnerDashboard/FeaturedLessonCard
 *
 * The "today's mission" hero. Left column: subject chip, meta dots
 * (duration, difficulty), big title, supporting copy, secondary
 * action buttons, primary Start CTA. Right column: tutor avatar
 * tile labeled with tutor name + personality line.
 *
 * The card is built as a presentational shell — the Start button is
 * passed in as a child so callers can render a server-action form or
 * a Next/Link without the component knowing about routing.
 */
export interface FeaturedLessonCardProps {
  subject: string;
  /** Subject pill tone — matches the chip background. */
  subjectTone?: "math" | "reading" | "science" | "social" | "art" | "neutral";
  durationLabel?: React.ReactNode;
  difficultyLabel?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Secondary action buttons (Read Aloud, Overview, etc.). */
  secondaryActions?: React.ReactNode;
  /** The Start / Resume button. */
  primaryAction: React.ReactNode;
  tutorName: string;
  tutorPersonality?: string;
  tutorGlyph: React.ReactNode;
  tutorTone?: TutorAvatarTone;
  className?: string;
}

const SUBJECT_TONE: Record<NonNullable<FeaturedLessonCardProps["subjectTone"]>, string> = {
  math: "bg-[var(--aivo-sunriseCoral-100)] text-[var(--aivo-sunriseCoral-700)]",
  reading: "bg-[var(--aivo-calmSky-100)] text-[var(--aivo-calmSky-700)]",
  science: "bg-[var(--aivo-meadow-100)] text-[var(--aivo-meadow-700)]",
  social: "bg-[var(--aivo-sunshine-100)] text-[var(--aivo-sunshine-800)]",
  art: "bg-[var(--aivo-lavender-100)] text-[var(--aivo-lavender-700)]",
  neutral: "bg-iw-bg text-iw-text-strong",
};

export function FeaturedLessonCard({
  subject,
  subjectTone = "neutral",
  durationLabel,
  difficultyLabel,
  title,
  description,
  secondaryActions,
  primaryAction,
  tutorName,
  tutorPersonality,
  tutorGlyph,
  tutorTone = "lavender",
  className,
}: FeaturedLessonCardProps) {
  return (
    <article
      className={cn(
        "relative rounded-[28px] bg-white border border-iw-border/60",
        "p-6 md:p-8",
        "grid gap-6 md:grid-cols-[1fr_auto] md:items-center",
        className,
      )}
    >
      <div className="flex flex-col gap-5 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase",
              SUBJECT_TONE[subjectTone],
            )}
          >
            {subject}
          </span>
          {durationLabel ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-iw-text-muted">
              <span aria-hidden="true" className="w-1 h-1 rounded-full bg-iw-text-muted" />
              {durationLabel}
            </span>
          ) : null}
          {difficultyLabel ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-iw-text-muted">
              <span aria-hidden="true" className="w-1 h-1 rounded-full bg-iw-text-muted" />
              {difficultyLabel}
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl md:text-3xl font-bold text-iw-text-strong leading-tight">
            {title}
          </h2>
          {description ? (
            <p className="text-base text-iw-text-muted leading-relaxed">{description}</p>
          ) : null}
        </div>

        {secondaryActions ? (
          <div className="flex items-center gap-2 flex-wrap">{secondaryActions}</div>
        ) : null}

        <div>{primaryAction}</div>
      </div>

      <div className="flex flex-col items-center gap-2 md:pl-2">
        <TutorAvatar glyph={tutorGlyph} tone={tutorTone} size="xl" />
        <span className="font-bold text-iw-text-strong">{tutorName}</span>
        {tutorPersonality ? (
          <span className="text-sm text-[var(--color-aivo-primary)] font-medium">
            {tutorPersonality}
          </span>
        ) : null}
      </div>
    </article>
  );
}

FeaturedLessonCard.displayName = "LearnerDashboard/FeaturedLessonCard";

/* -----------------------------------------------------------------
   Secondary action button used in the FeaturedLessonCard footer row
   (Read Aloud, Overview, etc.). Soft outlined pill with an icon.
   ----------------------------------------------------------------- */
export interface LessonSecondaryActionProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

export function LessonSecondaryAction({
  icon,
  children,
  className,
  ...rest
}: LessonSecondaryActionProps) {
  return (
    <button
      type="button"
      {...rest}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold",
        "bg-white border border-iw-border/80 text-iw-text-strong",
        "hover:bg-iw-bg hover:border-[var(--color-aivo-primary)]/40",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aivo-primary)] focus-visible:ring-offset-2",
        "transition-colors",
        className,
      )}
    >
      {icon ? (
        <span aria-hidden="true" className="w-4 h-4 inline-flex items-center justify-center">
          {icon}
        </span>
      ) : null}
      {children}
    </button>
  );
}

LessonSecondaryAction.displayName = "LearnerDashboard/LessonSecondaryAction";
