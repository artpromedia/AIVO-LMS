/* eslint-disable no-restricted-syntax -- the inline <style> block uses literal
   hex fallbacks behind `var(--iw-*, …)` / `var(--bc-primary, …)` so the screen
   still renders if those design tokens haven't loaded yet (same pattern as
   building-client.tsx). */
"use client";

/**
 * Sprint C-14 — storyboard screen 4: where we'll start.
 *
 * Qualitative, growth-framed starting points per subject ("Reading: building —
 * we'll start gently and move at her pace"). NEVER a grade-equivalent or any
 * score×grade math (C-03 deleted `scoreToGradeEquiv`; Decision D4(b) would
 * permit grade language ONLY from the curriculum-svc catalogue, which is not
 * wired into web-v2 — so per the pre-decided fallback we ship qualitative
 * framing only and surface curriculum grounding as a follow-up).
 *
 * The footnote restates the frame the parent of a newly-diagnosed child most
 * needs to hear: these are starting points, not labels.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import type { StartingPoint } from "@/lib/learner/reveal-assembly";

const ESTIMATE_KEY: Record<StartingPoint["estimate"], string> = {
  new: "reveal_start_estimate_new",
  growing: "reveal_start_estimate_growing",
  confident: "reveal_start_estimate_confident",
  advanced: "reveal_start_estimate_advanced",
};

export function WhereWellStart({
  learnerName,
  startingPoints,
}: {
  learnerName: string;
  startingPoints: StartingPoint[];
}) {
  const t = useTranslations("brain_clone");

  return (
    <section className="reveal-start" aria-labelledby="reveal-start-title">
      <header className="reveal-screen-head">
        <p className="reveal-screen-eyebrow">{t("reveal_start_eyebrow")}</p>
        <h2 id="reveal-start-title" className="reveal-screen-title">
          {t("reveal_start_title", { name: learnerName })}
        </h2>
        <p className="reveal-screen-caption">
          {t("reveal_start_caption", { name: learnerName })}
        </p>
      </header>

      {startingPoints.length === 0 ? (
        <div className="reveal-empty" role="status">
          <p className="reveal-empty-title">
            {t("reveal_start_empty_title", { name: learnerName })}
          </p>
          <p className="reveal-empty-body">
            {t("reveal_start_empty_body", { name: learnerName })}
          </p>
        </div>
      ) : (
        <>
          <ul className="reveal-start-list">
            {startingPoints.map((p) => (
              <li key={p.subjectId} className="reveal-start-row" data-estimate={p.estimate}>
                <span className="reveal-start-subject">{p.subjectName}</span>
                <span className="reveal-start-estimate">
                  {t(ESTIMATE_KEY[p.estimate], { name: learnerName })}
                </span>
              </li>
            ))}
          </ul>
          <p className="reveal-start-footnote">
            {t("reveal_start_footnote", { name: learnerName })}
          </p>
        </>
      )}

      <style>{`
        .reveal-start-list {
          list-style: none;
          margin: 1.25rem 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .reveal-start-row {
          display: flex;
          flex-wrap: wrap;
          align-items: baseline;
          gap: 0.4rem 0.75rem;
          padding: 0.85rem 1.05rem;
          border: 1px solid var(--iw-border, #e2e6f0);
          border-left-width: 4px;
          border-radius: 12px;
          background: var(--iw-raised, #fff);
        }
        /* Warm, growth-positive accents per estimate (left border only). */
        .reveal-start-row[data-estimate="new"] { border-left-color: #8b5cf6; }
        .reveal-start-row[data-estimate="growing"] { border-left-color: #0ea5e9; }
        .reveal-start-row[data-estimate="confident"] { border-left-color: #10b981; }
        .reveal-start-row[data-estimate="advanced"] { border-left-color: #f59e0b; }
        .reveal-start-subject {
          font-weight: 700;
          font-size: 0.98rem;
          color: var(--iw-ink, #0b1020);
        }
        .reveal-start-estimate {
          font-size: 0.92rem;
          color: var(--iw-ink-muted, #475569);
        }
        .reveal-start-footnote {
          margin: 1rem 0 0;
          font-size: 0.85rem;
          line-height: 1.5;
          color: var(--iw-ink-muted, #475569);
        }
      `}</style>
    </section>
  );
}
