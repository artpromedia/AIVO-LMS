"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * LearnerHome/SubjectCard
 *
 * The premium soft-card subject tile for the learner home and subject
 * hub. Per Sprint 7 spec it must show: mastery level, next action,
 * confidence/support status, teacher-assigned tasks, parent-visible
 * progress. Uses a calm radial mastery ring (no noisy gamification)
 * and rounded support chips.
 *
 * Tap target wraps the whole card — caller passes an `href`. The
 * card never renders a separate button so screen readers don't
 * announce duplicate semantics.
 */
export interface SubjectCardProps {
  href: string;
  /** Subject display name. */
  name: React.ReactNode;
  /** One-line eyebrow (e.g. tutor name, landmark). */
  eyebrow?: React.ReactNode;
  /** Friendly mastery label ("Building", "On grade", "Strong"). */
  masteryLabel: React.ReactNode;
  /** 0-100 mastery progress for the ring. */
  masteryPct: number;
  /** Big-emoji or icon avatar for the subject. */
  icon: React.ReactNode;
  /** Accent color for the ring (CSS color string or var()). */
  accent?: string;
  /** Short "next up" copy. */
  nextAction?: React.ReactNode;
  /** Optional teacher-assigned counter (renders a small badge). */
  teacherAssigned?: number;
  /** Optional support status — appears as a chip (e.g. "Read-aloud on"). */
  support?: React.ReactNode;
  /** When true, the card renders as muted (locked / not unlocked yet). */
  locked?: boolean;
  className?: string;
}

function Ring({ pct, accent }: { pct: number; accent: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const r = 28;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - clamped / 100);
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="shrink-0" aria-hidden="true">
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="var(--aivo-color-surface-muted)"
        strokeWidth="6"
      />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 36 36)"
        style={{ transition: "stroke-dashoffset 400ms ease-out" }}
      />
    </svg>
  );
}

export function SubjectCard({
  href,
  name,
  eyebrow,
  masteryLabel,
  masteryPct,
  icon,
  accent = "var(--aivo-sensory-primary)",
  nextAction,
  teacherAssigned,
  support,
  locked,
  className,
}: SubjectCardProps) {
  return (
    <a
      href={href}
      className={cn(
        "group relative flex flex-col gap-4 rounded-iw-card-lg bg-white border border-iw-border",
        "p-5 transition-all duration-150",
        "hover:-translate-y-0.5 hover:shadow-[0_12px_32px_-12px_rgba(15,23,42,0.18)]",
        "focus:outline-none focus:ring-2 focus:ring-[var(--aivo-sensory-ringFocus)] focus:ring-offset-2 focus:ring-offset-[var(--aivo-color-surface-canvas)]",
        locked && "opacity-60 pointer-events-none",
        className,
      )}
      aria-disabled={locked || undefined}
    >
      <header className="flex items-start justify-between gap-3">
        <span
          className="w-12 h-12 rounded-iw-control inline-flex items-center justify-center text-2xl"
          style={{ backgroundColor: `${accent}1A`, color: accent }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <Ring pct={masteryPct} accent={accent} />
      </header>
      <div className="flex flex-col gap-1">
        {eyebrow ? <p className="iw-label text-iw-text-muted truncate">{eyebrow}</p> : null}
        <h3 className="text-lg font-semibold text-iw-text-strong">{name}</h3>
        <p className="text-sm text-iw-text-muted">
          <span className="font-semibold text-iw-text-strong">{masteryLabel}</span>
        </p>
      </div>
      {(nextAction || support || teacherAssigned) && (
        <footer className="flex flex-col gap-2 mt-1">
          {nextAction ? (
            <p className="text-sm text-iw-text-strong leading-relaxed">
              <span className="iw-label text-iw-text-muted mr-2">Next</span>
              {nextAction}
            </p>
          ) : null}
          <div className="flex items-center gap-2 flex-wrap">
            {support ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-iw-chip text-[11px] font-semibold bg-[var(--aivo-color-aivoTeal-50)] text-[var(--aivo-color-aivoTeal-700)] border border-[var(--aivo-color-aivoTeal-100)]">
                {support}
              </span>
            ) : null}
            {typeof teacherAssigned === "number" && teacherAssigned > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-iw-chip text-[11px] font-semibold bg-[var(--aivo-color-aivoOrange-50)] text-[var(--aivo-color-aivoOrange-700)] border border-[var(--aivo-color-aivoOrange-100)]">
                {teacherAssigned} from teacher
              </span>
            ) : null}
          </div>
        </footer>
      )}
    </a>
  );
}

SubjectCard.displayName = "LearnerHome/SubjectCard";
