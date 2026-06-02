"use client";
import * as React from "react";
import { cn } from "../utils/cn";
import type { AivoComponentState, AivoDensity, AivoElevation, AivoRadius } from "../utils/types";

/**
 * Surface/GlassCard
 *
 * The base panel of the AIVO calm system. Soft white-with-tint background,
 * rounded corners from the iw-card / iw-card-lg / iw-hero scale, and an
 * optional inner glow on `floating` elevation. Every more-specialised
 * surface (MetricCard, HeroPanel, ModalSheet) composes on top of this.
 *
 * State contract:
 *  - default  → quiet card, full-opacity content
 *  - hover    → translates 1px up + softens shadow (decorative, no
 *               functional behaviour change)
 *  - focus    → 2px primary focus ring via --aivo-sensory-ringFocus
 *  - disabled → 50% opacity, pointer-events: none, aria-disabled set
 *  - loading  → background shimmer (.aivo-motion-baseline-gen), content
 *               kept readable so layout doesn't collapse
 *  - error    → red-tinted left rim, role="alert" wrapper
 *  - empty    → muted text colour, dashed iw-border outline
 */
export interface GlassCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  state?: AivoComponentState;
  density?: AivoDensity;
  elevation?: AivoElevation;
  radius?: AivoRadius;
  /** When true, swap solid background for translucent glass (backdrop blur). */
  glass?: boolean;
  /** Optional headline rendered at the top of the card. */
  title?: React.ReactNode;
  /** Optional sub-headline / supporting copy under `title`. */
  description?: React.ReactNode;
  /** Right-aligned actions slot (button group, menu, etc). */
  actions?: React.ReactNode;
}

const RADIUS_CLASS: Record<AivoRadius, string> = {
  control: "rounded-iw-control",
  card: "rounded-iw-card",
  "card-lg": "rounded-iw-card-lg",
  hero: "rounded-iw-hero",
  chip: "rounded-iw-chip",
  "sheet-top": "rounded-iw-sheet-top",
};

const PAD_CLASS: Record<AivoDensity, string> = {
  compact: "p-4 md:p-5",
  base: "p-5 md:p-6",
  comfortable: "p-6 md:p-8",
};

const ELEVATION_CLASS: Record<AivoElevation, string> = {
  flat: "shadow-none border border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.06))]",
  raised:
    "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] border border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.06))]",
  floating:
    "shadow-[0_4px_12px_rgba(15,23,42,0.06),0_24px_48px_-20px_rgba(15,23,42,0.12)] border border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.05))]",
  overlay:
    "shadow-[0_24px_64px_-12px_rgba(15,23,42,0.24)] border border-[var(--aivo-color-border-subtle,rgba(15,23,42,0.08))]",
};

export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(function GlassCard(
  {
    state = "default",
    density = "base",
    elevation = "raised",
    radius = "card-lg",
    glass = false,
    title,
    description,
    actions,
    className,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = state === "disabled";
  const isError = state === "error";
  const isEmpty = state === "empty";
  const isLoading = state === "loading";

  const wrapperRole = isError ? "alert" : rest.role;

  return (
    <div
      ref={ref}
      data-state={state}
      aria-disabled={isDisabled || undefined}
      aria-busy={isLoading || undefined}
      role={wrapperRole}
      {...rest}
      className={cn(
        "relative isolate flex flex-col gap-3 transition-[transform,box-shadow,opacity] duration-200 ease-out",
        RADIUS_CLASS[radius],
        PAD_CLASS[density],
        ELEVATION_CLASS[elevation],
        glass ? "bg-white/70 backdrop-blur-xl" : "bg-[var(--aivo-color-surface-card,#ffffff)]",
        state === "hover" && "-translate-y-px shadow-lg",
        state === "focus" &&
          "outline-none ring-2 ring-offset-2 ring-[var(--aivo-sensory-ringFocus,#7c3aed)] ring-offset-[var(--aivo-color-surface-canvas,#f4f6f5)]",
        isDisabled && "opacity-50 pointer-events-none select-none",
        isLoading && "aivo-motion-baseline-gen",
        isError &&
          "border-l-4 border-l-[var(--aivo-color-status-error-strong,#dc2626)] bg-[var(--aivo-color-status-error-subtle,#fef2f2)]",
        isEmpty && "border-dashed text-[var(--aivo-color-text-muted,#64748b)]",
        className,
      )}
    >
      {(title || description || actions) && (
        <header className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex flex-col gap-1">
            {title && (
              <h3 className="iw-label text-[var(--aivo-color-text-default,#0f172a)] truncate">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-sm text-[var(--aivo-color-text-muted,#64748b)] truncate">
                {description}
              </p>
            )}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </div>
  );
});
GlassCard.displayName = "Surface/GlassCard";
