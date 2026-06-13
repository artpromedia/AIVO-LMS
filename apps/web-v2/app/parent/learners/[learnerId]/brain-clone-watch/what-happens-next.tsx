/* eslint-disable no-restricted-syntax -- the inline <style> block uses literal
   hex fallbacks behind `var(--iw-*, …)` / `var(--bc-primary, …)` so screen 7
   still renders if those design tokens haven't loaded yet (same pattern as
   building-client.tsx). */
"use client";

/**
 * Sprint C-06 — ignition + "what happens next" (storyboard screen 7).
 *
 * Rendered on approval SUCCESS (the page lands here with `?celebrate=1` once
 * `cloneStage === "approved"`). The ignition is a calm intensity ramp on the
 * living brain sphere — reusing PixiBrainSphere's own motion (the same
 * `intensity` prop the building sequence's activation stage drives), not a
 * forked animation. Under reduced motion the sphere renders at full intensity
 * immediately (no ramp).
 *
 * Then the panel: the learner's first step (handles ready/blocked), the active
 * supports summary, and an "invite teacher" CTA. The reassurance line now claims
 * the change-notification promise C-13 makes true ("You'll get a note when this
 * profile meaningfully changes — and you can review it anytime").
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import PixiBrainSphere from "@/components/brain/pixi-brain-sphere";

export type NextMission =
  | { ready: true; caption: string }
  | { ready: false };

export type NextStepsStrings = {
  eyebrow: string;
  title: string;
  subtitle: string;
  missionTitle: string;
  missionBlocked: string;
  supportsTitle: string;
  supportsEmpty: string;
  inviteTitle: string;
  inviteBody: string;
  inviteCta: string;
  reassure: string;
  done: string;
  sphereAriaLabel: string;
};

export function WhatHappensNext({
  learnerId,
  primaryHue,
  secondaryHues,
  pulseRate,
  mission,
  supports,
  strings,
}: {
  learnerId: string;
  primaryHue: string;
  secondaryHues: string[];
  pulseRate: "calm" | "steady" | "energetic";
  mission: NextMission;
  /** Already-humanised active support labels (e.g. "Read-aloud"). */
  supports: string[];
  strings: NextStepsStrings;
}) {
  // Ignition: ramp intensity 0.55 → 1 shortly after mount. Reduced motion
  // starts (and stays) at full intensity — no ramp.
  const [ignited, setIgnited] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      setIgnited(true);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setIgnited(true);
      return;
    }
    const t = setTimeout(() => setIgnited(true), 120);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="bc-next-root"
      style={{ "--bc-primary": primaryHue } as React.CSSProperties}
      data-testid="brain-approval-next"
    >
      <header className="bc-next-header">
        <div className={`bc-next-sphere ${ignited ? "is-ignited" : ""}`}>
          <PixiBrainSphere
            primaryHue={primaryHue}
            secondaryHues={secondaryHues}
            pulseRate={pulseRate}
            intensity={ignited ? 1 : 0.55}
            size={180}
            ariaLabel={strings.sphereAriaLabel}
          />
        </div>
        <p className="bc-next-eyebrow">{strings.eyebrow}</p>
        <h1 className="bc-next-title">{strings.title}</h1>
        <p className="bc-next-subtitle">{strings.subtitle}</p>
      </header>

      <section className="bc-next-card">
        <h2 className="bc-next-card-title">{strings.missionTitle}</h2>
        {mission.ready ? (
          <p className="bc-next-card-body">{mission.caption}</p>
        ) : (
          <p className="bc-next-card-body bc-next-muted">{strings.missionBlocked}</p>
        )}
      </section>

      <section className="bc-next-card">
        <h2 className="bc-next-card-title">{strings.supportsTitle}</h2>
        {supports.length > 0 ? (
          <ul className="bc-next-supports">
            {supports.map((s, i) => (
              <li key={i} className="bc-next-support-chip">
                {s}
              </li>
            ))}
          </ul>
        ) : (
          <p className="bc-next-card-body bc-next-muted">{strings.supportsEmpty}</p>
        )}
      </section>

      <section className="bc-next-card bc-next-invite">
        <div>
          <h2 className="bc-next-card-title">{strings.inviteTitle}</h2>
          <p className="bc-next-card-body bc-next-muted">{strings.inviteBody}</p>
        </div>
        <Link href={`/parent/learners/${learnerId}/team`} className="bc-next-invite-cta">
          {strings.inviteCta}
        </Link>
      </section>

      <p className="bc-next-reassure">{strings.reassure}</p>

      <Link href={`/parent/learners/${learnerId}`} className="bc-next-done">
        {strings.done}
      </Link>

      <style>{`
        .bc-next-root {
          max-width: 640px;
          margin: 0 auto;
          padding: 1rem 0 3rem;
          text-align: center;
        }
        .bc-next-header { margin-bottom: 1.75rem; }
        .bc-next-sphere {
          display: flex;
          justify-content: center;
          margin-bottom: 0.85rem;
          opacity: 0.85;
          transition: opacity 900ms ease, filter 900ms ease;
          filter: saturate(0.9);
        }
        .bc-next-sphere.is-ignited { opacity: 1; filter: saturate(1.05); }
        @media (prefers-reduced-motion: reduce) {
          .bc-next-sphere { transition: none; }
        }
        .bc-next-eyebrow {
          font-size: 0.78rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--bc-primary, #5b3df5);
          margin: 0 0 0.35rem;
          font-weight: 700;
        }
        .bc-next-title {
          font-size: clamp(1.6rem, 3.4vmin, 2.2rem);
          font-weight: 700;
          color: var(--iw-ink, #0b1020);
          margin: 0;
        }
        .bc-next-subtitle {
          margin: 0.5rem auto 0;
          max-width: 460px;
          color: var(--iw-ink-muted, #475569);
          font-size: 1rem;
          line-height: 1.5;
        }
        .bc-next-card {
          text-align: left;
          margin-top: 1rem;
          padding: 1.1rem 1.2rem;
          border: 1px solid var(--iw-border, #e2e6f0);
          border-radius: 16px;
          background: var(--iw-raised, #fff);
        }
        .bc-next-card-title {
          margin: 0 0 0.4rem;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--iw-ink, #0b1020);
        }
        .bc-next-card-body {
          margin: 0;
          font-size: 0.95rem;
          line-height: 1.5;
          color: var(--iw-ink, #0b1020);
        }
        .bc-next-muted { color: var(--iw-ink-muted, #475569); }
        .bc-next-supports {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .bc-next-support-chip {
          font-size: 0.85rem;
          font-weight: 600;
          padding: 0.3rem 0.75rem;
          border-radius: 9999px;
          color: var(--bc-primary, #5b3df5);
          background: color-mix(in oklch, var(--bc-primary, #5b3df5) 10%, transparent);
          border: 1px solid color-mix(in oklch, var(--bc-primary, #5b3df5) 28%, transparent);
        }
        .bc-next-invite {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        @media (min-width: 540px) {
          .bc-next-invite { flex-direction: row; align-items: center; justify-content: space-between; }
        }
        .bc-next-invite-cta {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          white-space: nowrap;
          padding: 0.7rem 1.3rem;
          font-size: 0.9rem;
          font-weight: 600;
          border-radius: 9999px;
          text-decoration: none;
          color: var(--bc-primary, #5b3df5);
          background: transparent;
          border: 1px solid color-mix(in oklch, var(--bc-primary, #5b3df5) 45%, var(--iw-border, #e2e6f0));
          min-height: 44px;
        }
        .bc-next-invite-cta:hover { background: color-mix(in oklch, var(--bc-primary, #5b3df5) 8%, transparent); }
        .bc-next-reassure {
          margin: 1.25rem 0 0;
          font-size: 0.9rem;
          color: var(--iw-ink-muted, #475569);
        }
        .bc-next-done {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          margin-top: 1rem;
          padding: 0.8rem 1.6rem;
          font-size: 0.95rem;
          font-weight: 600;
          border-radius: 9999px;
          text-decoration: none;
          background: var(--bc-primary, #5b3df5);
          color: #fff;
          min-height: 48px;
        }
        .bc-next-invite-cta:focus-visible,
        .bc-next-done:focus-visible {
          outline: 2px solid var(--bc-primary, #5b3df5);
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
