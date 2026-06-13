/* eslint-disable no-restricted-syntax -- the inline <style> block uses literal
   hex fallbacks behind `var(--iw-*, …)` / `var(--bc-primary, …)` so the card
   still renders if those design tokens haven't loaded yet, and a print
   stylesheet that necessarily uses literal print colours. */
"use client";

/**
 * Sprint C-14 — the strengths-ONLY share artifact (storyboard screen 7).
 *
 * A little card of what makes the child shine — safe to send to a grandparent.
 * By construction it shows ONLY the child's first name, their strengths, and
 * their interests. No levels, no accommodations, no diagnoses, no source data:
 * the `ShareArtifactContent` type IS the whole surface and the content-safety
 * test asserts it (`reveal-assembly.test.ts`).
 *
 * Export is a print-safe page (repo has no image-canvas precedent; print → PDF
 * is the most universal, dependency-free "downloadable/shareable card" path —
 * documented as the screenshot-DoD substitution). Creating the card fires the
 * `share-artifact-created` instrumentation event via the passed callback.
 */
import * as React from "react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ShareArtifactContent } from "@/lib/learner/reveal-assembly";

export function ShareArtifact({
  learnerName,
  content,
  hasContent,
  primaryHue,
  onCreate,
}: {
  /** Display name for the screen heading/copy (the CARD itself uses
   *  `content.firstName` only — never this, which may carry extras). */
  learnerName: string;
  content: ShareArtifactContent;
  hasContent: boolean;
  primaryHue: string;
  /** Fired once when the parent generates the card — the instrumentation hook. */
  onCreate?: () => void;
}) {
  const t = useTranslations("brain_clone");
  const [created, setCreated] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  function handleCreate() {
    if (!created) {
      setCreated(true);
      onCreate?.();
    }
  }

  function handlePrint() {
    handleCreate();
    if (typeof window !== "undefined") window.print();
  }

  if (!hasContent) {
    return (
      <section
        className="reveal-share"
        style={{ "--bc-primary": primaryHue } as React.CSSProperties}
        aria-labelledby="reveal-share-title"
      >
        <header className="reveal-screen-head">
          <h2 id="reveal-share-title" className="reveal-screen-title">
            {t("share_title", { name: learnerName })}
          </h2>
        </header>
        <div className="reveal-empty" role="status">
          <p className="reveal-empty-title">{t("share_empty_title", { name: learnerName })}</p>
          <p className="reveal-empty-body">{t("share_empty_body", { name: learnerName })}</p>
        </div>
        <style>{shareStyles}</style>
      </section>
    );
  }

  return (
    <section
      className="reveal-share"
      style={{ "--bc-primary": primaryHue } as React.CSSProperties}
      aria-labelledby="reveal-share-title"
    >
      <header className="reveal-screen-head">
        <h2 id="reveal-share-title" className="reveal-screen-title">
          {t("share_title", { name: learnerName })}
        </h2>
        <p className="reveal-screen-caption">{t("share_caption", { name: learnerName })}</p>
      </header>

      {/* The card itself — the ONLY thing inside `reveal-share-card` renders to
          print, and it carries only firstName + strengths + interests. */}
      <div className="reveal-share-card" ref={cardRef} data-testid="share-artifact-card">
        <p className="reveal-share-card-eyebrow">{t("share_card_eyebrow")}</p>
        <p className="reveal-share-card-name">{content.firstName}</p>
        {content.strengths.length > 0 ? (
          <div className="reveal-share-card-block">
            <p className="reveal-share-card-label">{t("share_card_strengths_label")}</p>
            <ul className="reveal-share-card-list">
              {content.strengths.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {content.interests.length > 0 ? (
          <div className="reveal-share-card-block">
            <p className="reveal-share-card-label">{t("share_card_interests_label")}</p>
            <ul className="reveal-share-card-list">
              {content.interests.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="reveal-share-card-footer">{t("share_card_footer")}</p>
      </div>

      <div className="reveal-share-actions">
        <button type="button" className="reveal-share-print-btn" onClick={handlePrint}>
          {t("share_print")}
        </button>
      </div>
      {created ? (
        <p className="reveal-share-created" role="status">
          {t("share_created_note")}
        </p>
      ) : null}

      <style>{shareStyles}</style>
    </section>
  );
}

const shareStyles = `
  .reveal-share-card {
    margin: 1.25rem auto 0;
    max-width: 420px;
    padding: 1.6rem 1.5rem;
    border-radius: 20px;
    text-align: center;
    color: #fff;
    background-image:
      radial-gradient(ellipse at top, color-mix(in oklch, var(--bc-primary, #5b3df5) 70%, #1a0a3e), transparent 75%),
      linear-gradient(to bottom right, var(--bc-primary, #5b3df5), #0f172a);
    box-shadow: 0 18px 48px color-mix(in oklch, var(--bc-primary, #5b3df5) 24%, transparent);
  }
  .reveal-share-card-eyebrow {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.8;
    font-weight: 700;
  }
  .reveal-share-card-name {
    margin: 0.35rem 0 1rem;
    font-size: clamp(1.8rem, 5vmin, 2.4rem);
    font-weight: 800;
  }
  .reveal-share-card-block { margin-top: 0.85rem; }
  .reveal-share-card-label {
    margin: 0 0 0.35rem;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.85;
  }
  .reveal-share-card-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
  }
  .reveal-share-card-list li {
    padding: 0.3rem 0.7rem;
    border-radius: 9999px;
    font-size: 0.88rem;
    font-weight: 600;
    background: rgba(255, 255, 255, 0.16);
    border: 1px solid rgba(255, 255, 255, 0.28);
  }
  .reveal-share-card-footer {
    margin: 1.2rem 0 0;
    font-size: 0.72rem;
    opacity: 0.7;
    letter-spacing: 0.04em;
  }
  .reveal-share-actions {
    display: flex;
    justify-content: center;
    margin-top: 1.1rem;
  }
  .reveal-share-print-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 48px;
    padding: 0.75rem 1.6rem;
    font-size: 0.95rem;
    font-weight: 600;
    border-radius: 9999px;
    cursor: pointer;
    color: #fff;
    background: var(--bc-primary, #5b3df5);
    border: 1px solid var(--bc-primary, #5b3df5);
  }
  .reveal-share-print-btn:focus-visible {
    outline: 2px solid var(--bc-primary, #5b3df5);
    outline-offset: 3px;
  }
  .reveal-share-created {
    margin: 0.75rem 0 0;
    text-align: center;
    font-size: 0.85rem;
    color: var(--iw-ink-muted, #475569);
  }
  /* Print-safe: only the strengths card prints, centred on the page. */
  @media print {
    body * { visibility: hidden !important; }
    .reveal-share-card, .reveal-share-card * { visibility: visible !important; }
    .reveal-share-card {
      position: absolute;
      left: 50%;
      top: 2rem;
      transform: translateX(-50%);
      box-shadow: none;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .reveal-share-actions, .reveal-share-created, .reveal-screen-head { display: none !important; }
  }
`;
