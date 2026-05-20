"use client";
import * as React from "react";
import { cn } from "../utils/cn.js";
import { TutorAvatar, type TutorAvatarTone } from "./TutorAvatar.js";

/**
 * LearnerDashboard/TutorAvatarCard
 *
 * Tile in the "Your AI Tutors" grid below the featured lesson.
 * Avatar tile centered on a white card; tutor name + subject stacked
 * below. Hover lifts the card slightly and brings the indigo focus
 * ring into view to telegraph interactivity.
 */
export interface TutorAvatarCardProps {
  name: string;
  subject: React.ReactNode;
  glyph: React.ReactNode;
  tone?: TutorAvatarTone;
  href?: string;
  className?: string;
}

export function TutorAvatarCard({
  name,
  subject,
  glyph,
  tone = "lavender",
  href,
  className,
}: TutorAvatarCardProps) {
  const inner = (
    <>
      <TutorAvatar glyph={glyph} tone={tone} size="lg" />
      <div className="flex flex-col items-center gap-0.5">
        <span className="font-bold text-iw-text-strong">{name}</span>
        <span className="text-sm text-iw-text-muted">{subject}</span>
      </div>
    </>
  );
  const cls = cn(
    "group flex flex-col items-center gap-3 p-5 rounded-[24px] bg-white border border-iw-border/60",
    "transition-all duration-150",
    "hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)] hover:border-[var(--color-aivo-primary)]/40",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-aivo-primary)] focus-visible:ring-offset-2",
    className,
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return <div className={cls}>{inner}</div>;
}

TutorAvatarCard.displayName = "LearnerDashboard/TutorAvatarCard";
