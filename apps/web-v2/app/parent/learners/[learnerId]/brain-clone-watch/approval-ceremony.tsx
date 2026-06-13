/* eslint-disable no-restricted-syntax -- the inline <style> block uses literal
   hex fallbacks behind `var(--iw-*, …)` / `var(--bc-primary, …)` so the
   ceremony still renders if those design tokens haven't loaded yet (same
   pattern as building-client.tsx). */
"use client";

/**
 * Sprint C-06 — the approval ceremony (storyboard screen 6).
 *
 * The single most consequential act a parent performs in the product, made
 * deliberate and recorded. Replaces the bare Approve button in the recap with,
 * in order:
 *   1. a one-sentence honest recap of what approval means;
 *   2. an expandable Responsible-AI panel rendering the real disclosures
 *      (`getBrainExplainability` content: data sources, bias mitigations,
 *      transparency, human oversight) — passed in as `rai`;
 *   3. an explicit consent checkbox (ConsentRow);
 *   4. a deliberate approve action — a two-step Review → Confirm that is fully
 *      keyboard/switch accessible, with a press-and-hold flourish for pointer
 *      users and a reduced-motion variant (no hold; plain confirm button).
 *
 * The Approve action is disabled until the RAI panel has been opened (or the
 * acknowledgement implied by opening it) AND the consent box is checked. This
 * is a courtesy: the SERVER action re-checks `consentGiven` + `raiAcknowledged`
 * and rejects a forged POST regardless of the UI (defense-in-depth).
 *
 * The "Check & adjust" link routes to the C-05 review screen. Honours
 * `prefers-reduced-motion`.
 */
import * as React from "react";
import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { ConsentRow } from "@aivo/ui/auth";

export type CeremonyRai = {
  sources: string[];
  biasMitigations: string[];
  transparency: string;
  humanOversight: string;
};

/** Sprint C-08 — the "N of M voices" chip shown on the ceremony surface. */
export type CeremonyVoices = {
  invited: number;
  contributed: number;
  /** "Built from {contributed} of {invited} invited voices" (pre-resolved). */
  label: string;
  /** Honest zero-contributor line shown when contributed === 0. */
  zeroLabel: string;
  /** Quiet link text to the team hub, shown when contributed < invited. */
  linkLabel: string;
  /** Href to the team hub. */
  hubHref: string;
};

export type CeremonyStrings = {
  recap: string;
  raiToggle: string;
  raiClose: string;
  raiSourcesTitle: string;
  raiSourcesEmpty: string;
  raiBiasTitle: string;
  raiTransparencyTitle: string;
  raiOversightTitle: string;
  consentTitle: string;
  consentDesc: string;
  gateHint: string;
  review: string;
  confirmTitle: string;
  confirmBody: string;
  confirm: string;
  cancel: string;
  hold: string;
  holdRelease: string;
  holdProgress: string;
  submitting: string;
  amendLabel: string;
  stagedCorrections: string | null;
};

/** The actual submit control — separated so it can read `useFormStatus`. */
function SubmitButton({
  label,
  submittingLabel,
  className,
}: {
  label: string;
  submittingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-disabled={pending}>
      {pending ? submittingLabel : label}
    </button>
  );
}

export function ApprovalCeremony({
  learnerId,
  rai,
  strings,
  voices,
  consentVersion,
  raiVersion,
  approveAction,
}: {
  learnerId: string;
  rai: CeremonyRai;
  strings: CeremonyStrings;
  /** Sprint C-08 — "N of M voices" chip; omitted when no one was invited. */
  voices?: CeremonyVoices | null;
  consentVersion: string;
  raiVersion: string;
  approveAction: (formData: FormData) => void | Promise<void>;
}) {
  const [raiOpen, setRaiOpen] = useState(false);
  // Acknowledgement is satisfied once the parent has opened the RAI panel at
  // least once. (We keep it sticky so closing the panel doesn't re-lock.)
  const [raiSeen, setRaiSeen] = useState(false);
  const [consent, setConsent] = useState(false);
  // Two-step: the recap "Review & approve" reveals the confirm step.
  const [confirming, setConfirming] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  // Press-and-hold progress [0..1] for pointer users (non-reduced-motion).
  const [hold, setHold] = useState(0);
  const holdRaf = useRef<number | null>(null);
  const holdStart = useRef<number | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const panelId = useId();
  const HOLD_MS = 900;

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const ready = raiSeen && consent;

  function openRai() {
    setRaiOpen((o) => !o);
    setRaiSeen(true);
  }

  function submitNow() {
    formRef.current?.requestSubmit();
  }

  // ── press-and-hold (pointer, non-reduced-motion) ──────────────────
  function startHold() {
    if (reducedMotion || !ready) return;
    holdStart.current = performance.now();
    const tick = () => {
      if (holdStart.current == null) return;
      const elapsed = performance.now() - holdStart.current;
      const pct = Math.min(1, elapsed / HOLD_MS);
      setHold(pct);
      if (pct >= 1) {
        cancelHold();
        submitNow();
      } else {
        holdRaf.current = requestAnimationFrame(tick);
      }
    };
    holdRaf.current = requestAnimationFrame(tick);
  }
  function cancelHold() {
    holdStart.current = null;
    if (holdRaf.current != null) cancelAnimationFrame(holdRaf.current);
    holdRaf.current = null;
    setHold(0);
  }
  useEffect(() => () => cancelHold(), []);

  return (
    <div className="bc-ceremony">
      <p className="bc-ceremony-recap">{strings.recap}</p>

      {/* Sprint C-08 — "N of M voices": which sources shaped the profile.
          Honest line when no teammate contributed; a quiet link to the team
          hub while contributed < invited. */}
      {voices ? (
        <p className="bc-ceremony-voices" role="status">
          <span className="bc-ceremony-voices-chip">
            {voices.contributed === 0 ? voices.zeroLabel : voices.label}
          </span>
          {voices.contributed < voices.invited ? (
            <Link href={voices.hubHref} className="bc-ceremony-voices-link">
              {voices.linkLabel}
            </Link>
          ) : null}
        </p>
      ) : null}

      {/* RAI disclosures — expandable, real content. */}
      <div className="bc-ceremony-rai">
        <button
          type="button"
          className="bc-ceremony-rai-toggle"
          aria-expanded={raiOpen}
          aria-controls={panelId}
          onClick={openRai}
        >
          <span aria-hidden="true" className={`bc-ceremony-rai-chevron ${raiOpen ? "is-open" : ""}`}>
            ▸
          </span>
          {raiOpen ? strings.raiClose : strings.raiToggle}
        </button>
        {raiOpen ? (
          <div id={panelId} className="bc-ceremony-rai-panel">
            <section className="bc-ceremony-rai-block">
              <h3 className="bc-ceremony-rai-h">{strings.raiSourcesTitle}</h3>
              {rai.sources.length > 0 ? (
                <ul className="bc-ceremony-rai-list">
                  {rai.sources.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              ) : (
                <p className="bc-ceremony-rai-text">{strings.raiSourcesEmpty}</p>
              )}
            </section>
            <section className="bc-ceremony-rai-block">
              <h3 className="bc-ceremony-rai-h">{strings.raiBiasTitle}</h3>
              <ul className="bc-ceremony-rai-list">
                {rai.biasMitigations.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
            <section className="bc-ceremony-rai-block">
              <h3 className="bc-ceremony-rai-h">{strings.raiTransparencyTitle}</h3>
              <p className="bc-ceremony-rai-text">{rai.transparency}</p>
            </section>
            <section className="bc-ceremony-rai-block">
              <h3 className="bc-ceremony-rai-h">{strings.raiOversightTitle}</h3>
              <p className="bc-ceremony-rai-text">{rai.humanOversight}</p>
            </section>
          </div>
        ) : null}
      </div>

      {/* Explicit consent. */}
      <ConsentRow
        id="bc-ceremony-consent"
        title={strings.consentTitle}
        description={strings.consentDesc}
        checked={consent}
        onChange={setConsent}
      />

      {strings.stagedCorrections ? (
        <p className="bc-ceremony-staged" role="status">
          {strings.stagedCorrections}
        </p>
      ) : null}

      {/* The deliberate approve action. */}
      <form ref={formRef} action={approveAction} className="bc-ceremony-form">
        <input type="hidden" name="learnerId" value={learnerId} />
        <input type="hidden" name="consentGiven" value="true" />
        <input type="hidden" name="raiAcknowledged" value="true" />
        <input type="hidden" name="consentVersion" value={consentVersion} />
        <input type="hidden" name="raiVersion" value={raiVersion} />

        {!confirming ? (
          <>
            {!ready ? (
              <p className="bc-ceremony-hint" id="bc-ceremony-hint">
                {strings.gateHint}
              </p>
            ) : null}
            <div className="bc-ceremony-buttons">
              <Link
                href={`/parent/learners/${learnerId}/brain-review`}
                className="bc-ceremony-amend-btn"
              >
                {strings.amendLabel}
              </Link>
              {/* Step 1: a button (never a submit) — keyboard/switch friendly. */}
              <button
                type="button"
                className="bc-ceremony-review-btn"
                disabled={!ready}
                aria-disabled={!ready}
                aria-describedby={!ready ? "bc-ceremony-hint" : undefined}
                onClick={() => setConfirming(true)}
              >
                {strings.review}
              </button>
            </div>
          </>
        ) : (
          <div className="bc-ceremony-confirm" role="group" aria-label={strings.confirmTitle}>
            <p className="bc-ceremony-confirm-title">{strings.confirmTitle}</p>
            <p className="bc-ceremony-confirm-body">{strings.confirmBody}</p>
            <div className="bc-ceremony-buttons">
              <button
                type="button"
                className="bc-ceremony-cancel-btn"
                onClick={() => {
                  setConfirming(false);
                  cancelHold();
                }}
              >
                {strings.cancel}
              </button>

              {reducedMotion ? (
                // Reduced-motion variant: plain confirm submit, no hold.
                <SubmitButton
                  label={strings.confirm}
                  submittingLabel={strings.submitting}
                  className="bc-ceremony-confirm-btn"
                />
              ) : (
                // Press-and-hold flourish for pointer users. Keyboard users
                // (Enter/Space) get an immediate submit via the same button —
                // onClick is the always-available, fully accessible path.
                <button
                  type="button"
                  className="bc-ceremony-hold-btn"
                  style={{ "--bc-hold": hold } as React.CSSProperties}
                  onClick={submitNow}
                  onPointerDown={startHold}
                  onPointerUp={cancelHold}
                  onPointerLeave={cancelHold}
                  onPointerCancel={cancelHold}
                >
                  <span
                    className="bc-ceremony-hold-fill"
                    aria-hidden="true"
                    style={{ transform: `scaleX(${hold})` }}
                  />
                  <span className="bc-ceremony-hold-label">
                    {hold > 0 && hold < 1 ? strings.holdRelease : strings.confirm}
                  </span>
                  <span className="sr-only" aria-live="polite">
                    {hold > 0 ? `${strings.holdProgress}: ${Math.round(hold * 100)}%` : ""}
                  </span>
                </button>
              )}
            </div>
          </div>
        )}
      </form>

      <style>{`
        .bc-ceremony { display: flex; flex-direction: column; gap: 1rem; }
        .bc-ceremony-recap {
          margin: 0;
          color: var(--iw-ink, #0b1020);
          font-size: 1rem;
          line-height: 1.55;
        }
        .bc-ceremony-voices {
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem 0.75rem;
        }
        .bc-ceremony-voices-chip {
          display: inline-flex;
          align-items: center;
          padding: 0.35rem 0.75rem;
          border-radius: 9999px;
          font-size: 0.85rem;
          font-weight: 600;
          line-height: 1.3;
          color: var(--bc-primary, #5b3df5);
          background: color-mix(in oklch, var(--bc-primary, #5b3df5) 10%, var(--iw-bg, #fff));
          border: 1px solid color-mix(in oklch, var(--bc-primary, #5b3df5) 22%, var(--iw-border, #e2e6f0));
        }
        .bc-ceremony-voices-link {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--bc-primary, #5b3df5);
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .bc-ceremony-voices-link:focus-visible {
          outline: 2px solid var(--bc-primary, #5b3df5);
          outline-offset: 3px;
          border-radius: 4px;
        }
        .bc-ceremony-rai { border-top: 1px solid var(--iw-border, #e2e6f0); padding-top: 0.9rem; }
        .bc-ceremony-rai-toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: transparent;
          border: none;
          padding: 0.25rem 0;
          font-size: 0.95rem;
          font-weight: 600;
          color: var(--bc-primary, #5b3df5);
          cursor: pointer;
        }
        .bc-ceremony-rai-toggle:focus-visible {
          outline: 2px solid var(--bc-primary, #5b3df5);
          outline-offset: 3px;
          border-radius: 4px;
        }
        .bc-ceremony-rai-chevron { transition: transform 200ms ease; display: inline-block; }
        .bc-ceremony-rai-chevron.is-open { transform: rotate(90deg); }
        .bc-ceremony-rai-panel {
          margin-top: 0.75rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          padding: 0.9rem 1rem;
          background: color-mix(in oklch, var(--bc-primary, #5b3df5) 5%, var(--iw-bg, #fff));
          border: 1px solid color-mix(in oklch, var(--bc-primary, #5b3df5) 18%, var(--iw-border, #e2e6f0));
          border-radius: 12px;
        }
        .bc-ceremony-rai-block { margin: 0; }
        .bc-ceremony-rai-h {
          margin: 0 0 0.3rem;
          font-size: 0.82rem;
          font-weight: 700;
          letter-spacing: 0.02em;
          color: var(--iw-ink, #0b1020);
        }
        .bc-ceremony-rai-text {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.5;
          color: var(--iw-ink-muted, #475569);
        }
        .bc-ceremony-rai-list {
          margin: 0;
          padding-left: 1.1rem;
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.9rem;
          line-height: 1.45;
          color: var(--iw-ink-muted, #475569);
        }
        .bc-ceremony-staged {
          margin: 0;
          font-size: 0.875rem;
          color: var(--iw-ink-soft, #475569);
        }
        .bc-ceremony-form { margin: 0; }
        .bc-ceremony-hint {
          margin: 0 0 0.75rem;
          font-size: 0.875rem;
          color: var(--iw-ink-soft, #475569);
        }
        .bc-ceremony-buttons {
          display: flex;
          flex-direction: column-reverse;
          gap: 0.6rem;
        }
        @media (min-width: 540px) {
          .bc-ceremony-buttons { flex-direction: row; justify-content: flex-end; }
        }
        .bc-ceremony-amend-btn,
        .bc-ceremony-cancel-btn,
        .bc-ceremony-review-btn,
        .bc-ceremony-confirm-btn,
        .bc-ceremony-hold-btn {
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
          min-height: 48px;
        }
        .bc-ceremony-review-btn,
        .bc-ceremony-confirm-btn {
          background: var(--bc-primary, #5b3df5);
          color: #fff;
          border-color: var(--bc-primary, #5b3df5);
        }
        .bc-ceremony-review-btn:disabled,
        .bc-ceremony-review-btn[aria-disabled="true"] {
          opacity: 0.55;
          cursor: not-allowed;
        }
        .bc-ceremony-amend-btn:hover,
        .bc-ceremony-cancel-btn:hover { background: var(--iw-raised, #f4f6fb); }
        .bc-ceremony-confirm {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .bc-ceremony-confirm-title {
          margin: 0;
          font-weight: 700;
          color: var(--iw-ink, #0b1020);
          font-size: 1rem;
        }
        .bc-ceremony-confirm-body {
          margin: 0 0 0.6rem;
          color: var(--iw-ink-muted, #475569);
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .bc-ceremony-hold-btn {
          position: relative;
          overflow: hidden;
          background: var(--bc-primary, #5b3df5);
          color: #fff;
          border-color: var(--bc-primary, #5b3df5);
          isolation: isolate;
        }
        .bc-ceremony-hold-fill {
          position: absolute;
          inset: 0;
          transform-origin: left center;
          background: color-mix(in oklch, #000 22%, var(--bc-primary, #5b3df5));
          z-index: -1;
          transition: transform 60ms linear;
        }
        .bc-ceremony-hold-label { position: relative; z-index: 1; }
        .sr-only {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap; border: 0;
        }
        .bc-ceremony-review-btn:focus-visible,
        .bc-ceremony-confirm-btn:focus-visible,
        .bc-ceremony-hold-btn:focus-visible,
        .bc-ceremony-amend-btn:focus-visible,
        .bc-ceremony-cancel-btn:focus-visible {
          outline: 2px solid var(--bc-primary, #5b3df5);
          outline-offset: 3px;
        }
      `}</style>
    </div>
  );
}
