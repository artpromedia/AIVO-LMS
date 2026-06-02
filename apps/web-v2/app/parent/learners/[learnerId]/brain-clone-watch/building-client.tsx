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
 * Approve / Amend buttons. Approve POSTs back to the server action;
 * Amend routes to `/parent/learners/[id]/brain-profile` where overrides
 * are edited (and the approval is recorded as "amended" afterwards).
 *
 * The animation is intentionally calm: stage cards fade up + show a
 * brief shimmer while "computing", then settle. No external runtime
 * deps. Honours `prefers-reduced-motion`.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import MasterToChildClone from "@/components/brain/master-to-child-clone";
import BrainBuildingSequence, {
  type MasteryDecisionDTO,
  type AccommodationDecisionDTO,
  type TutorDecisionDTO,
} from "@/components/brain/brain-building-sequence";
import { hasSeenClone } from "@/lib/clone-flags";

type StageItem = { label: string; value?: string };
type Stage = {
  key: string;
  title: string;
  detail?: string;
  items?: StageItem[];
  swatches?: string[];
};

export type BuildingSequenceData = {
  enrolledGrade: number;
  functioningLevel: string;
  masteryDecisions: MasteryDecisionDTO[];
  accommodationDecisions: AccommodationDecisionDTO[];
  tutorDecisions: TutorDecisionDTO[];
  pulseRate: "calm" | "steady" | "energetic";
};

export function BrainBuildingClient({
  learnerId,
  learnerName,
  title,
  description,
  doneLabel,
  approveLabel,
  amendLabel,
  backLabel,
  alreadyApprovedLabel,
  replayCloneLabel,
  alreadyApproved,
  stages,
  primaryHue,
  secondaryHues,
  sequence,
  approveAction,
}: {
  learnerId: string;
  learnerName: string;
  title: string;
  description: string;
  doneLabel: string;
  approveLabel: string;
  amendLabel: string;
  backLabel: string;
  alreadyApprovedLabel: string;
  replayCloneLabel: string;
  alreadyApproved: boolean;
  stages: Stage[];
  primaryHue: string;
  secondaryHues: string[];
  sequence: BuildingSequenceData;
  approveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [active, setActive] = useState(0);
  // The master→child clone animation plays first, then reveals the build
  // timeline. Skipped automatically once the parent has seen it in full,
  // and always skipped for an already-approved brain (no first-run moment
  // left to deliver). `null` = undecided until we read localStorage so SSR
  // and first client render agree.
  const [showClone, setShowClone] = useState<boolean | null>(null);
  // The cinematic build sequence plays after the clone intro and before
  // the approval recap. Already-approved brains skip straight to the recap.
  const [sequenceDone, setSequenceDone] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = hasSeenClone(learnerId);
    setShowClone(!alreadyApproved && !seen);
    // If the parent has already lived the moment (or the brain is approved),
    // jump past the cinematic sequence to the recap + approval gate.
    setSequenceDone(alreadyApproved || seen);
  }, [alreadyApproved, learnerId]);

  // The recap timeline below the cinematic sequence shows the finished
  // build steps. Since the cinematic `BrainBuildingSequence` now owns the
  // pacing, the recap renders fully complete once we reach it.
  useEffect(() => {
    if (sequenceDone) setActive(stages.length);
  }, [sequenceDone, stages.length]);

  const allDone = active >= stages.length;

  // Phase 0 — the master→child cloning animation. While `showClone` is
  // undecided (null) we render nothing visible to avoid a flash of the
  // timeline before the clone intro takes over on the client.
  if (showClone === null) return <div className="bc-watch-root" aria-hidden="true" />;
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
          enrolledGrade={sequence.enrolledGrade}
          functioningLevel={sequence.functioningLevel}
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

  return (
    <div className="bc-watch-root" style={{ "--bc-primary": primaryHue } as React.CSSProperties}>
      <header className="bc-watch-header">
        <p className="bc-watch-eyebrow">For {learnerName}</p>
        <h1 className="bc-watch-title">{title}</h1>
        <p className="bc-watch-description">{description}</p>
        <button type="button" onClick={() => setShowClone(true)} className="bc-watch-replay-btn">
          {replayCloneLabel}
        </button>
      </header>

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

      <section className="bc-watch-actions" data-state={allDone ? "done" : "running"}>
        {alreadyApproved ? (
          <p className="bc-watch-approved-note">{alreadyApprovedLabel}</p>
        ) : (
          <>
            <p className="bc-watch-done-label" aria-live="polite">
              {allDone ? doneLabel : `${active} / ${stages.length}`}
            </p>
            <div className="bc-watch-buttons">
              <Link
                href={`/parent/learners/${learnerId}/brain-profile`}
                className="bc-watch-amend-btn"
              >
                {amendLabel}
              </Link>
              <form action={approveAction}>
                <input type="hidden" name="learnerId" value={learnerId} />
                <button
                  type="submit"
                  className="bc-watch-approve-btn"
                  disabled={!allDone}
                  aria-disabled={!allDone}
                >
                  {approveLabel}
                </button>
              </form>
            </div>
            <Link href={`/parent/learners/${learnerId}`} className="bc-watch-back-link">
              {backLabel}
            </Link>
          </>
        )}
      </section>

      <style>{`
        .bc-watch-root {
          max-width: 760px;
          margin: 0 auto;
          padding: 1rem 0 3rem;
        }
        .bc-watch-header { margin-bottom: 1.5rem; }
        .bc-watch-eyebrow {
          font-size: 0.78rem;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--bc-primary);
          margin: 0 0 0.35rem;
          opacity: 0.85;
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
          color: var(--bc-primary);
          background: color-mix(in oklch, var(--bc-primary) 10%, transparent);
          border: 1px solid color-mix(in oklch, var(--bc-primary) 35%, transparent);
          border-radius: 9999px;
          cursor: pointer;
          transition: background 200ms ease;
        }
        .bc-watch-replay-btn:hover {
          background: color-mix(in oklch, var(--bc-primary) 18%, transparent);
        }
        .bc-watch-timeline {
          list-style: none;
          padding: 0;
          margin: 1.5rem 0;
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
        .bc-watch-buttons {
          display: flex;
          flex-direction: column-reverse;
          gap: 0.6rem;
        }
        @media (min-width: 540px) {
          .bc-watch-buttons {
            flex-direction: row;
            justify-content: flex-end;
          }
        }
        .bc-watch-amend-btn,
        .bc-watch-approve-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0.75rem 1.4rem;
          font-size: 0.95rem;
          font-weight: 600;
          border-radius: 9999px;
          text-decoration: none;
          cursor: pointer;
          border: 1px solid var(--iw-border, #e2e6f0);
          background: transparent;
          color: var(--iw-ink, #0b1020);
        }
        .bc-watch-approve-btn {
          background: var(--bc-primary);
          color: #fff;
          border-color: var(--bc-primary);
        }
        .bc-watch-approve-btn:disabled,
        .bc-watch-approve-btn[aria-disabled="true"] {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .bc-watch-amend-btn:hover { background: var(--iw-raised, #f4f6fb); }
        .bc-watch-back-link {
          font-size: 0.9rem;
          color: var(--iw-ink-muted, #4b5573);
          text-align: center;
          text-decoration: none;
        }
        .bc-watch-back-link:hover { text-decoration: underline; }
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
