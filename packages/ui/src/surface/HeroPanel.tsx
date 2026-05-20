"use client";
import * as React from "react";
import { cn } from "../utils/cn";
import type { AivoComponentState, AivoTone } from "../utils/types";
import { GlassCard } from "./GlassCard";

/**
 * Surface/HeroPanel
 *
 * Top-of-page welcome / context panel. One per screen, maximum.
 *
 * - Wraps GlassCard at `hero` radius and `floating` elevation.
 * - Soft gradient wash anchored on the active tone (primary/accent/warm)
 *   to make the page feel like it has a "main subject" without shouting.
 * - Designed for parent / learner / teacher dashboards — the AI greeting,
 *   the next-best-action chip cluster, and a single CTA.
 */
export interface HeroPanelProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  state?: AivoComponentState;
  tone?: Extract<AivoTone, "primary" | "accent" | "warm" | "neutral">;
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Right-rail visual (avatar, illustration, mascot, mini chart). */
  media?: React.ReactNode;
  /** Primary CTA. */
  primaryAction?: React.ReactNode;
  /** Secondary action(s) (link, ghost button). */
  secondaryAction?: React.ReactNode;
  /** Optional row of InsightChip-like items rendered above the actions. */
  chips?: React.ReactNode;
}

const TONE_WASH: Record<HeroPanelProps["tone"] & string, string> = {
  primary:
    "bg-[radial-gradient(120%_120%_at_0%_0%,rgba(124,58,237,0.18)_0%,rgba(124,58,237,0)_55%),linear-gradient(180deg,#ffffff_0%,#fbfaff_100%)]",
  accent:
    "bg-[radial-gradient(120%_120%_at_0%_0%,rgba(20,184,166,0.16)_0%,rgba(20,184,166,0)_55%),linear-gradient(180deg,#ffffff_0%,#f5fbfa_100%)]",
  warm: "bg-[radial-gradient(120%_120%_at_0%_0%,rgba(249,115,22,0.16)_0%,rgba(249,115,22,0)_55%),linear-gradient(180deg,#ffffff_0%,#fff8f3_100%)]",
  neutral:
    "bg-[linear-gradient(180deg,#ffffff_0%,var(--aivo-color-surface-canvas,#f4f6f5)_100%)]",
};

export const HeroPanel = React.forwardRef<HTMLDivElement, HeroPanelProps>(
  function HeroPanel(
    {
      state = "default",
      tone = "primary",
      eyebrow,
      title,
      subtitle,
      media,
      primaryAction,
      secondaryAction,
      chips,
      className,
      ...rest
    },
    ref
  ) {
    return (
      <GlassCard
        ref={ref}
        state={state}
        radius="hero"
        elevation="floating"
        density="comfortable"
        className={cn(TONE_WASH[tone], "overflow-hidden", className)}
        {...rest}
      >
        <div className="flex flex-col-reverse md:flex-row md:items-center gap-6 md:gap-10">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {eyebrow && (
              <span className="iw-label-sm uppercase tracking-wide text-[var(--aivo-sensory-primary,#7c3aed)]">
                {eyebrow}
              </span>
            )}
            <h1 className="iw-display text-[var(--aivo-color-text-default,#0f172a)]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-base md:text-lg text-[var(--aivo-color-text-muted,#475569)] max-w-2xl">
                {subtitle}
              </p>
            )}
            {chips && (
              <div className="flex flex-wrap items-center gap-2">{chips}</div>
            )}
            {(primaryAction || secondaryAction) && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                {primaryAction}
                {secondaryAction}
              </div>
            )}
          </div>
          {media && (
            <div className="shrink-0 md:w-[280px] md:max-w-[40%]">{media}</div>
          )}
        </div>
      </GlassCard>
    );
  }
);
HeroPanel.displayName = "Surface/HeroPanel";
