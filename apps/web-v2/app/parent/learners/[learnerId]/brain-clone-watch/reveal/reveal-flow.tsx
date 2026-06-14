/* eslint-disable no-restricted-syntax -- the inline <style> block uses literal
   hex fallbacks behind `var(--iw-*, …)` / `var(--bc-primary, …)` so the flow
   still renders if those design tokens haven't loaded yet (same pattern as
   building-client.tsx). */
"use client";

/**
 * Sprint C-14 — the stitched reveal flow: screens 1 → 3 → 4 as one paged story
 * with a persistent brain sphere, transition copy between beats, and per-screen
 * advance instrumentation. Screen 2 (strengths-first) lives in the cinematic
 * `BrainBuildingSequence` that runs before this; here we lead with a short
 * strengths recap so the order the parent experiences is still strengths-first.
 *
 * One vocabulary, one visual rhythm: the same `PixiBrainSphere` thread that
 * runs through the cinematic and the ceremony rides along the top here too
 * (report §4.1 point 8 — extend the persistent-sphere thread, don't fork it).
 *
 * Reduced motion: no auto-advance, no cross-fade — the parent steps through
 * with the Continue button, and the sphere renders static. The whole path
 * honours the OS preference via the `reducedMotion` flag computed once on mount.
 */
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import PixiBrainSphere from "@/components/brain/pixi-brain-sphere";
import type {
  ContributionSummary,
  OperatingInstruction,
  ShareArtifactContent,
  StartingPoint,
} from "@/lib/learner/reveal-assembly";
import { InputsAssembling } from "./inputs-assembling";
import { HowSheLearns } from "./how-she-learns";
import { WhereWellStart } from "./where-well-start";
import { StrengthsRecap, type StrengthsRecapData } from "./strengths-recap";

export type RevealFlowData = {
  contributions: ContributionSummary;
  strengths: StrengthsRecapData;
  instructions: OperatingInstruction[];
  startingPoints: StartingPoint[];
  /** Present only so the flow can surface a compact details disclosure that
   *  links to the C-05 review screen; the share artifact lives on screen 7. */
  shareContent: ShareArtifactContent;
};

/** The ordered beats of the stitched reveal (screens 1–4). */
const STEPS = ["inputs", "strengths", "learns", "start"] as const;
type Step = (typeof STEPS)[number];

export function RevealFlow({
  learnerName,
  primaryHue,
  secondaryHues,
  pulseRate,
  sphereAriaLabel,
  data,
  onScreenAdvance,
  onComplete,
}: {
  learnerName: string;
  primaryHue: string;
  secondaryHues: string[];
  pulseRate: "calm" | "steady" | "energetic";
  sphereAriaLabel: string;
  data: RevealFlowData;
  /** Fired with the 1-based screen number each time a beat becomes active. */
  onScreenAdvance?: (screen: number) => void;
  /** Fired when the parent advances past the last beat → reveal the ceremony. */
  onComplete: () => void;
}) {
  const t = useTranslations("brain_clone");
  const [index, setIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const seen = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);

  // Fire a per-screen advance event the first time each beat becomes active.
  // Screen numbers: inputs=1, strengths=2, learns=3, start=4.
  useEffect(() => {
    const screen = index + 1;
    if (!seen.current.has(screen)) {
      seen.current.add(screen);
      onScreenAdvance?.(screen);
    }
  }, [index, onScreenAdvance]);

  const step: Step = STEPS[index]!;
  const isLast = index === STEPS.length - 1;

  const transitionCopy = useMemo<Record<Step, string | null>>(
    () => ({
      inputs: null,
      strengths: t("reveal_transition_strengths", { name: learnerName }),
      learns: t("reveal_transition_learns", { name: learnerName }),
      start: t("reveal_transition_start", { name: learnerName }),
    }),
    [t, learnerName],
  );

  function advance() {
    if (isLast) {
      onComplete();
      return;
    }
    setIndex((i) => Math.min(STEPS.length - 1, i + 1));
  }

  return (
    <div
      className="reveal-flow"
      style={{ "--bc-primary": primaryHue } as React.CSSProperties}
      data-step={step}
      data-testid="reveal-flow"
    >
      {/* Persistent sphere thread — the same living brain from the cinematic. */}
      <div className="reveal-flow-sphere">
        <PixiBrainSphere
          primaryHue={primaryHue}
          secondaryHues={secondaryHues}
          pulseRate={pulseRate}
          intensity={0.85}
          size={92}
          ariaLabel={sphereAriaLabel}
        />
      </div>

      {/* Progress dots across the four beats. */}
      <div className="reveal-flow-dots" aria-hidden="true">
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`reveal-flow-dot ${i < index ? "is-done" : i === index ? "is-active" : ""}`}
          />
        ))}
      </div>

      {transitionCopy[step] ? (
        <p className="reveal-flow-transition" aria-live="polite">
          {transitionCopy[step]}
        </p>
      ) : null}

      <div
        className={`reveal-flow-stage ${reducedMotion ? "is-static" : ""}`}
        key={step /* remount per beat so the fade-in re-runs */}
      >
        {step === "inputs" ? (
          <InputsAssembling
            learnerName={learnerName}
            contributions={data.contributions}
            reducedMotion={reducedMotion}
          />
        ) : null}
        {step === "strengths" ? (
          <StrengthsRecap learnerName={learnerName} data={data.strengths} />
        ) : null}
        {step === "learns" ? (
          <HowSheLearns learnerName={learnerName} instructions={data.instructions} />
        ) : null}
        {step === "start" ? (
          <WhereWellStart learnerName={learnerName} startingPoints={data.startingPoints} />
        ) : null}
      </div>

      <div className="reveal-flow-actions">
        <button type="button" className="reveal-flow-continue" onClick={advance}>
          {t("reveal_continue")}
        </button>
      </div>

      <style>{`
        .reveal-flow {
          max-width: 760px;
          margin: 0 auto;
          padding: 1rem 0 2rem;
        }
        .reveal-flow-sphere {
          display: flex;
          justify-content: center;
          margin-bottom: 0.5rem;
        }
        .reveal-flow-dots {
          display: flex;
          justify-content: center;
          gap: 0.45rem;
          margin-bottom: 1rem;
        }
        .reveal-flow-dot {
          width: 9px;
          height: 9px;
          border-radius: 9999px;
          background: var(--iw-border, #cbd5e1);
          transition: all 400ms ease;
        }
        .reveal-flow-dot.is-done { background: var(--bc-primary, #5b3df5); opacity: 0.55; }
        .reveal-flow-dot.is-active { background: var(--bc-primary, #5b3df5); transform: scale(1.3); }
        .reveal-flow-transition {
          margin: 0 0 0.75rem;
          text-align: center;
          font-size: 0.82rem;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--bc-primary, #5b3df5);
        }
        .reveal-flow-stage {
          animation: revealStageIn 420ms ease;
        }
        .reveal-flow-stage.is-static { animation: none; }
        .reveal-screen-head { text-align: center; }
        .reveal-screen-eyebrow {
          margin: 0 0 0.3rem;
          font-size: 0.74rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          font-weight: 700;
          /* AA: --bc-primary is the learner's brain-palette hue and can be
             light; mix toward near-black so eyebrow text always clears
             4.5:1 on the light reveal canvas. */
          color: color-mix(in oklab, var(--bc-primary, #4338ca) 50%, #14082e);
        }
        .reveal-screen-title {
          margin: 0;
          font-size: clamp(1.4rem, 3vmin, 1.9rem);
          font-weight: 800;
          color: var(--iw-ink, #0b1020);
        }
        .reveal-screen-caption {
          margin: 0.5rem auto 0;
          max-width: 52ch;
          font-size: 0.98rem;
          line-height: 1.5;
          color: var(--iw-ink-muted, #475569);
        }
        .reveal-empty {
          margin: 1.25rem 0 0;
          padding: 1.4rem 1.2rem;
          text-align: center;
          border: 1px dashed var(--iw-border, #cbd5e1);
          border-radius: 14px;
          background: var(--iw-raised, #fff);
        }
        .reveal-empty-title {
          margin: 0;
          font-weight: 700;
          color: var(--iw-ink, #0b1020);
        }
        .reveal-empty-body {
          margin: 0.4rem auto 0;
          max-width: 44ch;
          font-size: 0.9rem;
          line-height: 1.5;
          color: var(--iw-ink-muted, #475569);
        }
        .reveal-flow-actions {
          display: flex;
          justify-content: center;
          margin-top: 1.5rem;
        }
        .reveal-flow-continue {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          padding: 0.8rem 2.2rem;
          font-size: 1rem;
          font-weight: 700;
          border-radius: 9999px;
          cursor: pointer;
          color: #fff;
          /* AA: clamp the learner-palette hue dark enough that white label
             text clears 4.5:1 regardless of the brain colour. */
          background: color-mix(in oklab, var(--bc-primary, #4338ca) 72%, #14082e);
          border: 1px solid color-mix(in oklab, var(--bc-primary, #4338ca) 72%, #14082e);
          transition: transform 180ms ease;
        }
        .reveal-flow-continue:hover { transform: translateY(-1px); }
        .reveal-flow-continue:focus-visible {
          outline: 2px solid var(--bc-primary, #5b3df5);
          outline-offset: 3px;
        }
        @keyframes revealStageIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal-flow-stage { animation: none; }
          .reveal-flow-continue { transition: none; }
          .reveal-flow-dot { transition: none; }
        }
      `}</style>
    </div>
  );
}
