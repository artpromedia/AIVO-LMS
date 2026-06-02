"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Baseline/AICompanionHero
 *
 * Large hero panel that holds an AI companion orb (or any other
 * decorative learning object) and a calm headline. Used on the
 * baseline intro screen and on AI-personalization explainers.
 *
 * The orb is pure CSS — soft layered gradients + a slow shimmer
 * animation that collapses under prefers-reduced-motion. No 3D
 * library is required, but the slot accepts a custom `companion`
 * node so a real 3D scene can be dropped in later.
 *
 * Pairs with PersonalizationChip in the floating strip slot to
 * surface the personalization signals.
 */
export interface AICompanionHeroProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  body?: React.ReactNode;
  /** Floating chip strip below the title. */
  chips?: React.ReactNode;
  /** Action row (typically a single big "Start" link). */
  actions?: React.ReactNode;
  /** Custom companion to replace the default orb. */
  companion?: React.ReactNode;
  /** Tutor avatar (emoji or image) shown alongside the orb. */
  tutorAvatar?: React.ReactNode;
  className?: string;
}

function DefaultOrb() {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "relative w-40 h-40 md:w-56 md:h-56 rounded-full",
        "bg-[radial-gradient(circle_at_30%_30%,var(--aivo-color-aivoPurple-200),var(--aivo-sensory-primary)_55%,var(--aivo-color-aivoOrange-300)_100%)]",
        "shadow-[0_24px_64px_-12px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.35)]",
        "motion-safe:aivo-motion-ai-thinking",
      )}
    >
      <span className="absolute inset-3 rounded-full bg-white/15 backdrop-blur-md" />
      <span className="absolute inset-8 rounded-full bg-[var(--aivo-color-aivoPurple-50)]/30" />
      <span className="absolute top-8 left-10 w-6 h-6 rounded-full bg-white/60 blur-[2px]" />
    </div>
  );
}

export function AICompanionHero({
  eyebrow,
  title,
  body,
  chips,
  actions,
  companion,
  tutorAvatar,
  className,
}: AICompanionHeroProps) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-iw-hero",
        "bg-gradient-to-br from-[var(--aivo-color-aivoPurple-50)] via-white to-[var(--aivo-color-aivoTeal-50)]",
        "border border-iw-border shadow-[0_24px_64px_-24px_rgb(from_var(--aivo-sensory-primary)_r_g_b_/_0.18)]",
        "p-6 md:p-10",
        className,
      )}
    >
      <div className="grid gap-6 md:grid-cols-[1fr,auto] items-center">
        <div className="flex flex-col gap-4 max-w-2xl">
          {eyebrow ? <p className="iw-label text-iw-text-muted">{eyebrow}</p> : null}
          <h1 className="text-3xl md:text-4xl leading-snug font-semibold text-iw-text-strong">
            {title}
          </h1>
          {body ? (
            <p className="text-base md:text-lg text-iw-text-muted leading-relaxed">{body}</p>
          ) : null}
          {chips ? <div className="flex flex-wrap gap-2 mt-1">{chips}</div> : null}
          {actions ? <div className="flex flex-wrap gap-3 mt-2">{actions}</div> : null}
        </div>
        <div className="relative flex items-center justify-center">
          {companion ?? <DefaultOrb />}
          {tutorAvatar ? (
            <span
              className="absolute -bottom-2 -right-2 w-14 h-14 md:w-16 md:h-16 rounded-full bg-white shadow-lg border border-iw-border flex items-center justify-center text-2xl md:text-3xl"
              aria-hidden="true"
            >
              {tutorAvatar}
            </span>
          ) : null}
        </div>
      </div>
    </section>
  );
}

AICompanionHero.displayName = "Baseline/AICompanionHero";
