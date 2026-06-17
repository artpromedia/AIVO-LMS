"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Assessment/SubmittedHero
 *
 * The "Assessment submitted" celebration card. Calm, non-confetti
 * acknowledgement that closes the assessment chapter and points the
 * parent into the baseline-pending screen. Reduced-motion friendly —
 * the only animation is a soft inner-glow pulse on the icon halo.
 */
export interface SubmittedHeroProps {
  /** Eyebrow / role / learner name. */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Bullet list of what AIVO will do next. */
  next?: ReadonlyArray<{ icon?: React.ReactNode; label: React.ReactNode }>;
  /** Primary action — typically a Link to the baseline-pending page. */
  primary?: React.ReactNode;
  /** Optional secondary action. */
  secondary?: React.ReactNode;
  className?: string;
}

export function SubmittedHero({
  eyebrow,
  title,
  body,
  next,
  primary,
  secondary,
  className,
}: SubmittedHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-iw-hero",
        "bg-gradient-to-br from-[var(--aivo-color-aivoPurple-50,#f5f3ff)] via-white to-[var(--aivo-color-aivoTeal-50,#f0fdfa)]",
        "border border-iw-border shadow-[0_24px_64px_-24px_rgba(124,58,237,0.18)]",
        "p-6 md:p-10 flex flex-col gap-6",
        className,
      )}
    >
      <div className="flex items-start gap-4">
        <span
          className={cn(
            "relative shrink-0 w-14 h-14 rounded-iw-control",
            "bg-white shadow-[0_4px_16px_rgba(124,58,237,0.18)]",
            "flex items-center justify-center text-[var(--aivo-sensory-primary,#7c3aed)]",
          )}
          aria-hidden="true"
        >
          <span className="absolute inset-0 rounded-iw-control bg-[var(--aivo-color-aivoPurple-100,#ede9fe)]/40 motion-safe:animate-pulse" />
          <svg
            className="w-7 h-7 relative"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.25"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </span>
        <div className="flex flex-col gap-1.5 min-w-0">
          {eyebrow ? <p className="iw-label text-iw-text-muted truncate">{eyebrow}</p> : null}
          <h1 className="text-2xl md:text-3xl font-semibold text-iw-text-strong leading-snug">
            {title}
          </h1>
          {body ? (
            <p className="text-sm md:text-base text-iw-text-muted leading-relaxed max-w-2xl">
              {body}
            </p>
          ) : null}
        </div>
      </div>

      {next && next.length ? (
        <ul className="grid sm:grid-cols-2 gap-3" aria-label="What happens next">
          {next.map((step, i) => (
            <li
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-iw-card border border-iw-border bg-white/80",
                "backdrop-blur-sm p-3",
              )}
            >
              {step.icon ? (
                <span
                  className="shrink-0 w-8 h-8 rounded-iw-control flex items-center justify-center bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-sensory-primary,#7c3aed)]"
                  aria-hidden="true"
                >
                  {step.icon}
                </span>
              ) : (
                <span
                  className="shrink-0 w-8 h-8 rounded-iw-control bg-[var(--aivo-color-aivoPurple-50,#f5f3ff)] text-[var(--aivo-sensory-primary,#7c3aed)] inline-flex items-center justify-center text-xs font-bold tabular-nums"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
              )}
              <span className="text-sm text-iw-text-strong">{step.label}</span>
            </li>
          ))}
        </ul>
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

SubmittedHero.displayName = "Assessment/SubmittedHero";
