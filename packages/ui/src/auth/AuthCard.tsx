"use client";
import * as React from "react";
import { cn } from "../utils/cn";

/**
 * Auth/AuthCard
 *
 * The single soft-glass card every auth / consent / onboarding screen
 * lives inside. Renders an optional eyebrow + title + subtitle header,
 * the form body, and an actions row pinned to the bottom.
 *
 * Use one card per logical step. If a flow has 4 steps, render 4
 * cards across 4 pages (or 4 stacked cards inside a wizard, but only
 * one visible at a time).
 */
export interface AuthCardProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional element rendered before the title (e.g. AivoIcon). */
  icon?: React.ReactNode;
  /** Form fields, consent rows, etc. */
  children: React.ReactNode;
  /** Action row (typically primary CTA + secondary link). */
  actions?: React.ReactNode;
  /** Optional reassurance card slot rendered between body and actions. */
  reassurance?: React.ReactNode;
  className?: string;
}

export function AuthCard({
  eyebrow,
  title,
  subtitle,
  icon,
  children,
  actions,
  reassurance,
  className,
}: AuthCardProps) {
  return (
    <section
      className={cn(
        "rounded-iw-card-lg bg-iw-card border border-iw-border",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_48px_-28px_rgba(15,23,42,0.18)]",
        "p-6 md:p-8 flex flex-col gap-6",
        className,
      )}
    >
      <header className="flex flex-col gap-2">
        {icon ? <div className="mb-1">{icon}</div> : null}
        {eyebrow ? <p className="iw-label text-iw-text-muted">{eyebrow}</p> : null}
        <h1 className="font-iw-display text-3xl md:text-4xl font-semibold tracking-tight text-iw-text-strong">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-sm md:text-base text-iw-text-muted leading-relaxed">{subtitle}</p>
        ) : null}
      </header>
      <div className="flex flex-col gap-4">{children}</div>
      {reassurance ? <div>{reassurance}</div> : null}
      {actions ? <div className="flex flex-col gap-3 pt-2">{actions}</div> : null}
    </section>
  );
}

AuthCard.displayName = "Auth/AuthCard";
