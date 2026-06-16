/* eslint-disable no-restricted-syntax -- the inline <style> block uses literal
   hex fallbacks behind `var(--iw-*, …)` / `var(--bc-primary, …)` so the screen
   still renders if those design tokens haven't loaded yet (same pattern as
   building-client.tsx). */
"use client";

/**
 * Sprint C-14 — storyboard screen 2 recap: strengths first.
 *
 * The cinematic `BrainBuildingSequence` already plays the full strengths
 * reveal before this flow; here we lead the paged reveal with a compact recap
 * so the order the parent steps through is still strengths-first (report §4.1
 * point 3). Each strength keeps the parent's own words.
 *
 * Where the baseline surfaced an observed-behaviour strength ("She self-
 * corrected 4 times — that's persistence"), we show it as a highlighted first
 * card. The web-v2 brain state does not currently carry baseline process
 * signals (`surfaceSignalSummary`), so this degrades gracefully: when no
 * observed-behaviour strength is available, the card is simply omitted and the
 * parent's strengths stand on their own (no fabrication).
 */
import * as React from "react";
import { useTranslations } from "next-intl";

export type StrengthsRecapData = {
  /** "Good at" entries from the parent assessment (the parent's own words). */
  goodAt: string[];
  /** "What they love" free text ("" when unset). */
  loves: string;
  /** Subjects where the baseline estimate is confident/advanced. */
  strongSubjects: string[];
  /**
   * Optional observed-behaviour strength from the baseline's process signals
   * ("self-corrected 4 times — that's persistence"). Null when the pipeline
   * did not surface one (the common web-v2 case today) — the card degrades out.
   */
  observedStrength: string | null;
};

export function StrengthsRecap({
  learnerName,
  data,
}: {
  learnerName: string;
  data: StrengthsRecapData;
}) {
  const t = useTranslations("brain_clone");

  const chips = [...data.goodAt, ...data.strongSubjects].slice(0, 6);
  const hasAny = chips.length > 0 || data.loves.length > 0 || Boolean(data.observedStrength);

  return (
    <section className="reveal-strengths" aria-labelledby="reveal-strengths-title">
      <header className="reveal-screen-head">
        <h2 id="reveal-strengths-title" className="reveal-screen-title">
          {t("building_strengths_title", { name: learnerName })}
        </h2>
        <p className="reveal-screen-caption">{t("building_strengths_caption")}</p>
      </header>

      {!hasAny ? (
        <div className="reveal-empty" role="status">
          <p className="reveal-empty-body">
            {t("building_strengths_empty", { name: learnerName })}
          </p>
        </div>
      ) : (
        <div className="reveal-strengths-body">
          {data.observedStrength ? (
            <p className="reveal-strengths-observed">{data.observedStrength}</p>
          ) : null}
          {chips.length > 0 ? (
            <ul className="reveal-strengths-chips">
              {chips.map((c, i) => (
                <li key={i} className="reveal-strengths-chip">
                  {c}
                </li>
              ))}
            </ul>
          ) : null}
          {data.loves ? (
            <p className="reveal-strengths-loves">
              <span className="reveal-strengths-loves-label">
                {t("building_strengths_loves_label", { name: learnerName })}
              </span>{" "}
              {data.loves}
            </p>
          ) : null}
        </div>
      )}

      <style>{`
        .reveal-strengths-body { margin-top: 1.25rem; text-align: center; }
        .reveal-strengths-observed {
          margin: 0 auto 0.9rem;
          max-width: 48ch;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          font-size: 0.96rem;
          font-weight: 600;
          line-height: 1.45;
          color: var(--iw-ink, #0b1020);
          background: color-mix(in oklch, var(--bc-primary, #5b3df5) 9%, var(--iw-bg, #fff));
          border: 1px solid color-mix(in oklch, var(--bc-primary, #5b3df5) 22%, var(--iw-border, #e2e6f0));
        }
        .reveal-strengths-chips {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.5rem;
        }
        .reveal-strengths-chip {
          padding: 0.45rem 0.9rem;
          border-radius: 9999px;
          font-size: 0.92rem;
          font-weight: 600;
          /* AA: clamp the palette hue toward near-black for the chip label. */
          color: color-mix(in oklab, var(--bc-primary, #4338ca) 50%, #14082e);
          background: color-mix(in oklch, var(--bc-primary, #5b3df5) 10%, transparent);
          border: 1px solid color-mix(in oklch, var(--bc-primary, #5b3df5) 28%, transparent);
        }
        .reveal-strengths-loves {
          margin: 1rem auto 0;
          max-width: 48ch;
          font-size: 0.95rem;
          line-height: 1.5;
          color: var(--iw-ink, #0b1020);
        }
        .reveal-strengths-loves-label {
          font-weight: 700;
          color: var(--iw-ink-muted, #475569);
        }
      `}</style>
    </section>
  );
}
