/* eslint-disable no-restricted-syntax -- inline animation CSS uses
   literal fallbacks behind `var(--iw-*, ...)` so the timeline still
   renders if those design tokens haven't loaded yet (e.g. for a parent
   landing here mid-app-shell hydration). */
"use client";

/**
 * Parent-side Brain Clone Building Sequence (client).
 *
 * Renders the seven build stages on a timeline that auto-advances roughly
 * in lockstep with the learner's awakening sequence. Each stage is a
 * card that flips from "computing" → "complete" with the real XAI
 * annotation from `state.xaiExplanation`. The final stage exposes
 * Approve / "Check & adjust" buttons. Approve POSTs back to the server
 * action (folding any corrections the parent staged on the review
 * screen — the approval is recorded as "amended" when corrections are
 * present). "Check & adjust" routes to
 * `/parent/learners/[id]/brain-review`, the Sprint C-05 review & correct
 * screen, where individual inferences are confirmed or corrected inline.
 *
 * The animation is intentionally calm: stage cards fade up + show a
 * brief shimmer while "computing", then settle. No external runtime
 * deps. Honours `prefers-reduced-motion`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import MasterToChildClone from "@/components/brain/master-to-child-clone";
import PixiBrainSphere from "@/components/brain/pixi-brain-sphere";
import BrainBuildingSequence, {
  type MasteryDecisionDTO,
  type AccommodationDecisionDTO,
  type TutorDecisionDTO,
  type StrengthsDTO,
} from "@/components/brain/brain-building-sequence";
import { hasSeenClone } from "@/lib/clone-flags";
import {
  ApprovalCeremony,
  type CeremonyRai,
  type CeremonyStrings,
  type CeremonyVoices,
} from "./approval-ceremony";
import { WhatHappensNext, type NextMission, type NextStepsStrings } from "./what-happens-next";
import { RevealFlow, type RevealFlowData } from "./reveal/reveal-flow";
import { ShareArtifact } from "./reveal/share-artifact";
import { useRevealTelemetry } from "./reveal/use-reveal-telemetry";
import { shareArtifactHasContent } from "@/lib/learner/reveal-assembly";

type StageItem = { label: string; value?: string };
type Stage = {
  key: string;
  title: string;
  detail?: string;
  items?: StageItem[];
  swatches?: string[];
};

export type BuildingSequenceData = {
  strengths: StrengthsDTO;
  masteryDecisions: MasteryDecisionDTO[];
  accommodationDecisions: AccommodationDecisionDTO[];
  tutorDecisions: TutorDecisionDTO[];
  pulseRate: "calm" | "steady" | "energetic";
};

/** Sprint C-14 — strings + content for the screen-7 strengths-only share card. */
export type ShareStrings = {
  primaryHue: string;
  secondaryHues: string[];
};

export function BrainBuildingClient({
  learnerId,
  learnerName,
  title,
  description,
  eyebrowLabel,
  sphereAriaLabel,
  doneLabel,
  backLabel,
  alreadyApprovedLabel,
  replayCloneLabel,
  privacyNoteLabel,
  privacyLinkLabel,
  detailsToggleLabel,
  alreadyApproved,
  celebrate,
  stages,
  primaryHue,
  secondaryHues,
  sequence,
  reveal,
  ceremony,
  nextSteps,
  approveAction,
}: {
  learnerId: string;
  learnerName: string;
  title: string;
  description: string;
  eyebrowLabel: string;
  sphereAriaLabel: string;
  doneLabel: string;
  backLabel: string;
  alreadyApprovedLabel: string;
  replayCloneLabel: string;
  privacyNoteLabel: string;
  privacyLinkLabel: string;
  /** Sprint C-14 — label for the demoted "review the details" disclosure. */
  detailsToggleLabel: string;
  alreadyApproved: boolean;
  /** Sprint C-06: true immediately after approval — render the ignition +
   *  "what happens next" screen instead of the recap/ceremony. */
  celebrate: boolean;
  stages: Stage[];
  primaryHue: string;
  secondaryHues: string[];
  sequence: BuildingSequenceData;
  /** Sprint C-14: the stitched reveal screens 1–4 data + the screen-7 share
   *  artifact content (built server-side, safe by construction). */
  reveal: RevealFlowData;
  /** Sprint C-06: the approval-ceremony content (RAI disclosures + strings). */
  ceremony: {
    rai: CeremonyRai;
    strings: CeremonyStrings;
    /** Sprint C-08: "N of M voices" chip; null when no teammate was invited. */
    voices: CeremonyVoices | null;
    consentVersion: string;
    raiVersion: string;
  };
  /** Sprint C-06: screen-7 content (first mission, active supports, strings). */
  nextSteps: {
    mission: NextMission;
    supports: string[];
    strings: NextStepsStrings;
  };
  approveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [active, setActive] = useState(0);
  // The master→child clone animation plays first, then reveals the build
  // timeline. Skipped automatically once the parent has seen it in full,
  // and always skipped for an already-approved brain (no first-run moment
  // left to deliver). `null` = undecided until we read localStorage so SSR
  // and first client render agree.
  //
  // `prefers-reduced-motion` also suppresses the auto-playing clone intro
  // AND the cinematic build sequence entirely — large auto-playing
  // cross-fades are exactly the kind of "calm" motion the OS-level
  // reduce-motion preference asks us to avoid. Reduced-motion users land
  // straight on the recap, which renders the persistent brain sphere from
  // first paint (see the recap header below), so they get the same living
  // brain affordance as everyone else and our e2e gate can assert it
  // without driving a multi-second cinematic intro.
  const [showClone, setShowClone] = useState<boolean | null>(null);
  // The cinematic build sequence plays after the clone intro and before
  // the approval recap. Already-approved brains skip straight to the recap.
  const [sequenceDone, setSequenceDone] = useState(false);
  // Sprint C-14 — the stitched reveal flow (screens 1–4) plays after the
  // cinematic build and before the recap/ceremony. An already-approved brain
  // skips it (the moment already happened); a first-time parent steps through
  // it. `null` until we decide on the client so SSR + first paint agree.
  const [revealDone, setRevealDone] = useState<boolean | null>(null);

  // Sprint C-14 — reveal instrumentation (audit-backed; see use-reveal-telemetry).
  const track = useRevealTelemetry(learnerId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = hasSeenClone(learnerId);
    const reducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setShowClone(!alreadyApproved && !seen && !reducedMotion);
    // Jump past the cinematic sequence straight to the recap + approval gate
    // when the parent has already lived the moment, the brain is approved, or
    // reduced motion is requested (the recap shows the same persistent brain
    // sphere, minus the auto-playing build animation).
    setSequenceDone(alreadyApproved || seen || reducedMotion);
    // The stitched reveal is the first-run experience: an approved brain or a
    // parent who has already seen the clone goes straight to the recap. Reduced
    // motion still STEPS THROUGH the reveal (it is button-paced, not animated)
    // so those parents get the transparency narrative too.
    setRevealDone(alreadyApproved || seen);
  }, [alreadyApproved, learnerId]);

  // The recap timeline below the cinematic sequence shows the finished
  // build steps. Since the cinematic `BrainBuildingSequence` now owns the
  // pacing, the recap renders fully complete once we reach it.
  useEffect(() => {
    if (sequenceDone) setActive(stages.length);
  }, [sequenceDone, stages.length]);

  const allDone = active >= stages.length;

  // Sprint C-14 — the ceremony surface is reached once the reveal is done, the
  // build timeline is complete, and the brain is not already approved (the
  // approval gate is live). Fired once for the funnel's ceremony→approval leg.
  const ceremonyLive = revealDone === true && allDone && !alreadyApproved && !celebrate;
  useEffect(() => {
    if (ceremonyLive) track("ceremony_reached", { once: true });
  }, [ceremonyLive, track]);

  // Sprint C-06 — on approval success the page redirects back here with
  // `?celebrate=1`. Render the ignition + "what happens next" screen straight
  // away, bypassing the cinematic recap entirely (the moment already happened).
  if (celebrate && alreadyApproved) {
    return (
      <div className="bc-watch-root">
        <WhatHappensNext
          learnerId={learnerId}
          primaryHue={primaryHue}
          secondaryHues={secondaryHues}
          pulseRate={sequence.pulseRate}
          mission={nextSteps.mission}
          supports={nextSteps.supports}
          strings={nextSteps.strings}
        />
        {/* Sprint C-14 — the strengths-ONLY share artifact closes screen 7. */}
        <ShareArtifact
          learnerName={learnerName}
          content={reveal.shareContent}
          hasContent={shareArtifactHasContent(reveal.shareContent)}
          primaryHue={primaryHue}
          onCreate={() => track("share_artifact_created", { once: true })}
        />
      </div>
    );
  }

  // Phase 0 — the master→child cloning animation. While `showClone` /
  // `revealDone` are undecided (null) we render nothing visible to avoid a
  // flash of the timeline before the client decides which phase to show.
  if (showClone === null || revealDone === null)
    return <div className="bc-watch-root" aria-hidden="true" />;
  if (showClone) {
    return (
      <div className="bc-watch-root">
        <MasterToChildClone
          learnerName={learnerName}
          learnerId={learnerId}
          primaryHue={primaryHue}
          secondaryHues={secondaryHues}
          onComplete={() => setShowClone(false)}
        />
      </div>
    );
  }

  // Phase 1 — the cinematic build sequence (grade ladders, accommodations,
  // the living WebGL brain activating, tutor calibration). On completion we
  // reveal the recap timeline + approval gate below.
  if (!sequenceDone) {
    return (
      <div className="bc-watch-root">
        <BrainBuildingSequence
          learnerName={learnerName}
          strengths={sequence.strengths}
          masteryDecisions={sequence.masteryDecisions}
          accommodationDecisions={sequence.accommodationDecisions}
          tutorDecisions={sequence.tutorDecisions}
          primaryHue={primaryHue}
          secondaryHues={secondaryHues}
          pulseRate={sequence.pulseRate}
          onSequenceComplete={() => {
            setActive(stages.length);
            setSequenceDone(true);
          }}
        />
      </div>
    );
  }

  // Phase 2 (Sprint C-14) — the stitched reveal: inputs assembling → strengths
  // recap → how she learns best → where we'll start. One paged story leading to
  // the approval ceremony. Fires reveal_started on mount + per-screen advances.
  if (!revealDone) {
    return (
      <div className="bc-watch-root" style={{ "--bc-primary": primaryHue } as React.CSSProperties}>
        <RevealFlow
          learnerName={learnerName}
          primaryHue={primaryHue}
          secondaryHues={secondaryHues}
          pulseRate={sequence.pulseRate}
          sphereAriaLabel={sphereAriaLabel}
          data={reveal}
          onScreenAdvance={(screen) => {
            if (screen === 1) track("reveal_started", { once: true });
            track("screen_advanced", { screen });
          }}
          onComplete={() => setRevealDone(true)}
        />
      </div>
    );
  }

  return (
    <div className="bc-watch-root" style={{ "--bc-primary": primaryHue } as React.CSSProperties}>
      <header className="bc-watch-header">
        <div className="bc-watch-sphere">
          <PixiBrainSphere
            primaryHue={primaryHue}
            secondaryHues={secondaryHues}
            pulseRate={sequence.pulseRate}
            intensity={1}
            size={160}
            ariaLabel={sphereAriaLabel}
          />
        </div>
        <p className="bc-watch-eyebrow">{eyebrowLabel}</p>
        <h1 className="bc-watch-title">{title}</h1>
        <p className="bc-watch-description">{description}</p>
        <button type="button" onClick={() => setShowClone(true)} className="bc-watch-replay-btn">
          {replayCloneLabel}
        </button>
      </header>

      {/* Sprint C-14 — the legacy recap timeline is DEMOTED from the primary
          post-build surface (the stitched reveal screens 1–4 now tell the
          story). It survives as a compact "review the details" disclosure for
          parents who want the full step-by-step list view. The data rendering
          is unchanged — only its prominence. */}
      <details className="bc-watch-details">
        <summary className="bc-watch-details-summary">{detailsToggleLabel}</summary>
        <ol className="bc-watch-timeline">
          {stages.map((s, idx) => {
            const status: "pending" | "active" | "done" =
              idx < active ? "done" : idx === active ? "active" : "pending";
            return (
              <li key={s.key} data-status={status} className="bc-watch-stage">
                <div className="bc-watch-stage-marker" aria-hidden="true">
                  <span className="bc-watch-stage-dot" />
                </div>
                <div className="bc-watch-stage-card">
                  <p className="bc-watch-stage-title">{s.title}</p>
                  {s.detail ? <p className="bc-watch-stage-detail">{s.detail}</p> : null}
                  {s.swatches ? (
                    <div className="bc-watch-swatches">
                      {s.swatches.map((c, i) => (
                        <span
                          key={i}
                          className="bc-watch-swatch"
                          style={{ background: c }}
                          title={c}
                        />
                      ))}
                    </div>
                  ) : null}
                  {s.items && s.items.length > 0 ? (
                    <ul className="bc-watch-stage-items">
                      {s.items.map((it, i) => (
                        <li key={i}>
                          <span className="bc-watch-stage-item-label">{it.label}</span>
                          {it.value ? (
                            <span className="bc-watch-stage-item-value">{it.value}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </details>

      <section className="bc-watch-actions" data-state={allDone ? "done" : "running"}>
        {alreadyApproved ? (
          <>
            <p className="bc-watch-approved-note">{alreadyApprovedLabel}</p>
            <Link href={`/parent/learners/${learnerId}`} className="bc-watch-back-link">
              {backLabel}
            </Link>
          </>
        ) : !allDone ? (
          <p className="bc-watch-done-label" aria-live="polite">
            {`${active} / ${stages.length}`}
          </p>
        ) : (
          <>
            <p className="bc-watch-done-label">{doneLabel}</p>
            {/* Sprint C-06 — the approval ceremony replaces the bare button:
                recap line, RAI panel, consent, deliberate two-step approve. */}
            <ApprovalCeremony
              learnerId={learnerId}
              rai={ceremony.rai}
              strings={ceremony.strings}
              voices={ceremony.voices}
              consentVersion={ceremony.consentVersion}
              raiVersion={ceremony.raiVersion}
              approveAction={approveAction}
              onAmend={() => track("corrections_opened", { once: true })}
            />
            <Link href={`/parent/learners/${learnerId}`} className="bc-watch-back-link">
              {backLabel}
            </Link>
          </>
        )}
      </section>

      {/* Truthful privacy footnote (C-03): replaces the deleted encryption /
          versioning claims with a statement the backend honors, linking to
          the parent privacy centre for the full picture. */}
      <p className="bc-watch-privacy">
        {privacyNoteLabel}{" "}
        <Link href="/parent/privacy" className="bc-watch-privacy-link">
          {privacyLinkLabel}
        </Link>
      </p>

      <style>{`
        .bc-watch-root {
          max-width: 760px;
          margin: 0 auto;
          padding: 1rem 0 3rem;
        }
        .bc-watch-header { margin-bottom: 1.5rem; }
        .bc-watch-sphere {
          display: flex;
          justify-content: center;
          margin-bottom: 0.75rem;
        }
        .bc-watch-eyebrow {
          font-size: 0.78rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          /* AA: --bc-primary is the learner's brain-palette hue and can be
             light; clamp toward near-black so it clears 4.5:1 on the light
             canvas. Opacity dropped to 1 so it does not re-lighten the text. */
          color: color-mix(in oklab, var(--bc-primary, #4338ca) 50%, #14082e);
          margin: 0 0 0.35rem;
          opacity: 1;
          font-weight: 600;
        }
        .bc-watch-title {
          font-size: clamp(1.6rem, 3.4vmin, 2.2rem);
          font-weight: 700;
          color: var(--iw-ink, #0b1020);
          margin: 0;
        }
        .bc-watch-description {
          margin: 0.5rem 0 0;
          color: var(--iw-ink-muted, #4b5573);
          font-size: 1rem;
          line-height: 1.5;
        }
        .bc-watch-replay-btn {
          margin-top: 0.75rem;
          padding: 0.4rem 0.9rem;
          font-size: 0.82rem;
          font-weight: 600;
          /* AA: clamp the palette hue toward near-black for the button label. */
          color: color-mix(in oklab, var(--bc-primary, #4338ca) 50%, #14082e);
          background: color-mix(in oklch, var(--bc-primary) 10%, transparent);
          border: 1px solid color-mix(in oklch, var(--bc-primary) 35%, transparent);
          border-radius: 9999px;
          cursor: pointer;
          transition: background 200ms ease;
        }
        .bc-watch-replay-btn:hover {
          background: color-mix(in oklch, var(--bc-primary) 18%, transparent);
        }
        .bc-watch-details {
          margin: 1.5rem 0;
          border: 1px solid var(--iw-border, #e2e6f0);
          border-radius: 14px;
          background: var(--iw-raised, #fff);
          padding: 0 1rem;
        }
        .bc-watch-details-summary {
          cursor: pointer;
          padding: 0.9rem 0;
          font-size: 0.9rem;
          font-weight: 600;
          /* AA: clamp the palette hue toward near-black for the summary text. */
          color: color-mix(in oklab, var(--bc-primary, #4338ca) 50%, #14082e);
          list-style: none;
        }
        .bc-watch-details-summary::-webkit-details-marker { display: none; }
        .bc-watch-details-summary::before {
          content: "▸";
          display: inline-block;
          margin-right: 0.5rem;
          transition: transform 200ms ease;
        }
        .bc-watch-details[open] .bc-watch-details-summary::before { transform: rotate(90deg); }
        .bc-watch-details-summary:focus-visible {
          outline: 2px solid var(--bc-primary);
          outline-offset: 3px;
          border-radius: 4px;
        }
        .bc-watch-timeline {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
          position: relative;
        }
        .bc-watch-stage {
          display: grid;
          grid-template-columns: 32px 1fr;
          gap: 0.9rem;
          align-items: flex-start;
        }
        .bc-watch-stage-marker {
          position: relative;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .bc-watch-stage-marker::before {
          content: "";
          position: absolute;
          left: 50%;
          top: 22px;
          bottom: -10px;
          width: 2px;
          background: var(--iw-border, #e2e6f0);
          transform: translateX(-50%);
        }
        .bc-watch-stage:last-child .bc-watch-stage-marker::before { display: none; }
        .bc-watch-stage-dot {
          position: relative;
          z-index: 1;
          width: 14px;
          height: 14px;
          margin-top: 4px;
          border-radius: 9999px;
          background: var(--iw-border, #e2e6f0);
          border: 2px solid var(--iw-bg, #fff);
          box-shadow: 0 0 0 0 transparent;
          transition: background 300ms ease, box-shadow 600ms ease;
        }
        .bc-watch-stage[data-status="active"] .bc-watch-stage-dot {
          background: var(--bc-primary);
          box-shadow: 0 0 0 6px color-mix(in oklch, var(--bc-primary) 25%, transparent);
          animation: bcWatchPulse 1.6s ease-in-out infinite;
        }
        .bc-watch-stage[data-status="done"] .bc-watch-stage-dot {
          background: var(--bc-primary);
        }
        .bc-watch-stage-card {
          background: var(--iw-raised, #fff);
          border: 1px solid var(--iw-border, #e2e6f0);
          border-radius: 14px;
          padding: 1rem 1.1rem;
          opacity: 0.5;
          transform: translateY(4px);
          transition: opacity 500ms ease, transform 500ms ease, border-color 500ms ease;
        }
        .bc-watch-stage[data-status="active"] .bc-watch-stage-card,
        .bc-watch-stage[data-status="done"] .bc-watch-stage-card {
          opacity: 1;
          transform: translateY(0);
          border-color: color-mix(in oklch, var(--bc-primary) 35%, var(--iw-border, #e2e6f0));
        }
        .bc-watch-stage-title {
          margin: 0;
          font-weight: 600;
          color: var(--iw-ink, #0b1020);
          font-size: 0.98rem;
        }
        .bc-watch-stage-detail {
          margin: 0.4rem 0 0;
          color: var(--iw-ink-muted, #4b5573);
          font-size: 0.92rem;
          line-height: 1.45;
        }
        .bc-watch-stage-items {
          margin: 0.6rem 0 0;
          padding: 0;
          list-style: none;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }
        .bc-watch-stage-items li {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          font-size: 0.9rem;
          color: var(--iw-ink, #0b1020);
        }
        .bc-watch-stage-item-value {
          color: var(--iw-ink-muted, #4b5573);
          font-variant-numeric: tabular-nums;
        }
        .bc-watch-swatches {
          display: flex;
          gap: 0.4rem;
          margin: 0.6rem 0 0;
        }
        .bc-watch-swatch {
          width: 22px;
          height: 22px;
          border-radius: 9999px;
          border: 1px solid var(--iw-border, #e2e6f0);
        }
        .bc-watch-actions {
          margin-top: 1.5rem;
          padding: 1.2rem;
          border: 1px solid var(--iw-border, #e2e6f0);
          border-radius: 16px;
          background: var(--iw-raised, #fff);
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
          align-items: stretch;
        }
        .bc-watch-actions[data-state="done"] {
          border-color: color-mix(in oklch, var(--bc-primary) 45%, var(--iw-border, #e2e6f0));
          box-shadow: 0 16px 40px color-mix(in oklch, var(--bc-primary) 12%, transparent);
        }
        .bc-watch-done-label {
          margin: 0;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--iw-ink, #0b1020);
        }
        /* Approve / amend button styles now live in the ApprovalCeremony
           component (C-06), which owns the recap's approval gate. */
        .bc-watch-back-link {
          font-size: 0.9rem;
          color: var(--iw-ink-muted, #4b5573);
          text-align: center;
          text-decoration: none;
        }
        .bc-watch-back-link:hover { text-decoration: underline; }
        .bc-watch-privacy {
          margin: 0.9rem 0 0;
          text-align: center;
          font-size: 0.82rem;
          color: var(--iw-ink-muted, #4b5573);
        }
        .bc-watch-privacy-link {
          color: var(--iw-ink, #0b1020);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .bc-watch-approved-note {
          margin: 0;
          color: var(--iw-ink, #0b1020);
          font-size: 0.95rem;
        }
        @keyframes bcWatchPulse {
          0%, 100% { box-shadow: 0 0 0 0 color-mix(in oklch, var(--bc-primary) 30%, transparent); }
          50%      { box-shadow: 0 0 0 10px color-mix(in oklch, var(--bc-primary) 0%, transparent); }
        }
      `}</style>
    </div>
  );
}
