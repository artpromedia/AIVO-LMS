import * as React from "react";
import { clsx } from "clsx";

import { BRAND, INCLUSIVE_WARM_PALETTE, SEMANTIC } from "@aivo/brand";
/**
 * LearningHero
 *
 * Sprint-4 verbatim acceptance criterion:
 *
 *   "The 3D learning hero replaces the reference screenshot's
 *    medical heart. Greeting: 'Hi, [name]. [Child] is ready for
 *    today's learning.'"
 *
 * Rather than ship a heavy 3D engine (three.js / R3F) for a marketing-
 * feel hero card, we render the composition with CSS gradients, SVG
 * filters, and layered translate/rotate transforms. The result is
 * GPU-cheap, prefers-reduced-motion friendly, and zero net new
 * runtime bytes.
 *
 * Slots:
 *   - greeting    : the localized greeting line (already personalized)
 *   - subhead     : the "[Child] is ready for today's learning." line
 *   - actions     : 1-2 CTA buttons, rendered inside the hero card
 *   - companion   : optional override of the AI companion sparkle
 *
 * Composition (z-stacked, back to front):
 *   1. Soft brand-gradient panel (rounded, large)
 *   2. Subject blocks — math / reading / science / art — tilted
 *   3. Notebook + pencil cluster on the left
 *   4. Brain orb — the focal point, lower-right
 *   5. AI companion sparkle hovering above the orb
 *   6. Text content (greeting, subhead, actions) on the left half
 */
export type LearningHeroProps = {
  greeting: React.ReactNode;
  subhead: React.ReactNode;
  actions?: React.ReactNode;
  companion?: React.ReactNode;
  className?: string;
};

export function LearningHero({
  greeting,
  subhead,
  actions,
  companion,
  className,
}: LearningHeroProps) {
  return (
    <section
      aria-label="Learning hero"
      className={clsx(
        "relative overflow-hidden rounded-iw-card-lg",
        "bg-gradient-to-br from-[var(--aivo-color-aivoPurple-100,#ede9fe)] via-white to-[var(--aivo-color-aivoTeal-100,#ccfbf1)]",
        "ring-1 ring-iw-border/60",
        "px-6 py-8 sm:px-10 sm:py-12 lg:px-14 lg:py-16",
        "grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center",
        className,
      )}
    >
      {/* Text column */}
      <div className="relative z-10 flex flex-col gap-5 max-w-xl">
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-iw-text-strong leading-[1.05]">
          {greeting}
        </h1>
        <p className="text-lg sm:text-xl text-iw-text-muted">{subhead}</p>
        {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
      </div>

      {/* Composition column */}
      <div
        className="relative h-[260px] sm:h-[320px] lg:h-[380px] motion-safe:[--orb-float:8px] motion-reduce:[--orb-float:0px]"
        aria-hidden
      >
        <SubjectBlock label="Math" tone="teal" className="absolute left-2 top-2 -rotate-6" />
        <SubjectBlock label="Reading" tone="purple" className="absolute left-24 top-12 rotate-3" />
        <SubjectBlock label="Science" tone="amber" className="absolute right-32 top-4 rotate-6" />
        <SubjectBlock label="Art" tone="rose" className="absolute right-4 top-20 -rotate-3" />

        <Notebook className="absolute left-6 bottom-6" />

        <BrainOrb className="absolute right-6 bottom-6" />

        <div className="absolute right-12 bottom-44 motion-safe:animate-pulse">
          {companion ?? <AISparkle />}
        </div>
      </div>
    </section>
  );
}
LearningHero.displayName = "Hero/LearningHero";

/* ---------- internal sub-pieces ---------- */

const TONE_MAP = {
  teal: "from-[var(--aivo-color-aivoTeal-100,#ccfbf1)] to-[var(--aivo-color-aivoTeal-700,#0f766e)] text-[var(--aivo-color-aivoTeal-700,#0f766e)]",
  purple:
    "from-[var(--aivo-color-aivoPurple-100,#ede9fe)] to-[var(--aivo-sensory-primary,#7c3aed)] text-[var(--aivo-sensory-primary,#7c3aed)]",
  amber: "from-amber-100 to-amber-500 text-amber-800",
  rose: "from-rose-100 to-rose-500 text-rose-800",
} as const;

function SubjectBlock({
  label,
  tone,
  className,
}: {
  label: string;
  tone: keyof typeof TONE_MAP;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-iw-card bg-gradient-to-br px-3 py-2 shadow-[0_8px_20px_-12px_rgba(15,23,42,0.4)] ring-1 ring-white/60",
        TONE_MAP[tone].split(" ").slice(0, 2).join(" "),
        className,
      )}
    >
      <span className={clsx("text-sm font-bold", TONE_MAP[tone].split(" ").slice(2).join(" "))}>
        {label}
      </span>
    </div>
  );
}

function Notebook({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={clsx("h-24 w-28 drop-shadow-lg", className)}
      role="presentation"
    >
      <defs>
        <linearGradient id="aivo-hero-nb" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor={SEMANTIC.color.surface.card} />
          <stop offset="100%" stopColor="#e2e8f0" />
        </linearGradient>
      </defs>
      <rect
        x="10"
        y="10"
        width="100"
        height="80"
        rx="8"
        fill="url(#aivo-hero-nb)"
        stroke="#cbd5e1"
      />
      <line x1="22" y1="30" x2="98" y2="30" stroke="#94a3b8" strokeWidth="2" />
      <line x1="22" y1="46" x2="98" y2="46" stroke="#cbd5e1" strokeWidth="2" />
      <line x1="22" y1="62" x2="98" y2="62" stroke="#cbd5e1" strokeWidth="2" />
      <line x1="22" y1="78" x2="78" y2="78" stroke="#cbd5e1" strokeWidth="2" />
      {/* pencil */}
      <g transform="translate(72 4) rotate(35)">
        <rect x="0" y="0" width="6" height="50" fill={BRAND.colors.accent} />
        <polygon points="0,50 6,50 3,58" fill="#1f2937" />
        <rect x="0" y="-6" width="6" height="6" fill={INCLUSIVE_WARM_PALETTE.danger} />
      </g>
    </svg>
  );
}

function BrainOrb({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "relative h-32 w-32 sm:h-40 sm:w-40 lg:h-48 lg:w-48",
        "motion-safe:animate-[orbFloat_6s_ease-in-out_infinite]",
        className,
      )}
      style={{
        // inline keyframes so consumers don't need a Tailwind plugin
        animationName: "aivoOrbFloat",
      }}
    >
      <style>{`
        @keyframes aivoOrbFloat {
          0%,100% { transform: translateY(0) }
          50%     { transform: translateY(-8px) }
        }
      `}</style>
      <svg viewBox="0 0 200 200" className="h-full w-full">
        <defs>
          <radialGradient id="aivo-hero-orb" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#f5d0fe" />
            <stop offset="55%" stopColor={SEMANTIC.color.subject.art} />
            <stop offset="100%" stopColor="#4c1d95" />
          </radialGradient>
          <radialGradient id="aivo-hero-orb-hl" cx="30%" cy="25%">
            <stop offset="0%" stopColor={SEMANTIC.color.surface.card} stopOpacity="0.85" />
            <stop offset="60%" stopColor={SEMANTIC.color.surface.card} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="100" cy="100" r="92" fill="url(#aivo-hero-orb)" />
        {/* brain folds */}
        <g stroke={SEMANTIC.color.surface.card} strokeOpacity="0.5" strokeWidth="2" fill="none">
          <path d="M40 100 Q70 60 100 80 T160 100" />
          <path d="M40 120 Q70 80 100 100 T160 120" />
          <path d="M50 140 Q80 110 110 130 T160 140" />
        </g>
        <circle cx="100" cy="100" r="92" fill="url(#aivo-hero-orb-hl)" />
      </svg>
    </div>
  );
}

function AISparkle() {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-7 w-7 text-[var(--aivo-sensory-primary,#7c3aed)] drop-shadow"
    >
      <path d="M16 2 L19 13 L30 16 L19 19 L16 30 L13 19 L2 16 L13 13 Z" fill="currentColor" />
    </svg>
  );
}
