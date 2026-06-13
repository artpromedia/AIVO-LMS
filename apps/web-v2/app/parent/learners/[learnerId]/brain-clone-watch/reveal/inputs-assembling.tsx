/* eslint-disable no-restricted-syntax -- the inline <style> block uses literal
   hex fallbacks behind `var(--iw-*, …)` / `var(--bc-primary, …)` so the screen
   still renders if those design tokens haven't loaded yet (same pattern as
   building-client.tsx). */
"use client";

/**
 * Sprint C-14 — storyboard screen 1: inputs assembling.
 *
 * One card per SOURCE that actually contributed, with the real contribution
 * count ("You answered 11 sections · Her baseline: 23 questions · Ms. Rivera:
 * 2 observations"). This is the first beat of the never-told transparency
 * narrative — the parent sees that the profile was built from real input from
 * real people, nothing fabricated.
 *
 * Empty + partial variants are designed: zero contributors shows a warm
 * "we're still gathering input" state; a single source renders a single card.
 * Honours `prefers-reduced-motion` (cards fade in on a motion-free cadence via
 * the shared `data-reduced-motion` flag passed by the flow).
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import type { ContributionCard, ContributionSummary } from "@/lib/learner/reveal-assembly";

/** Map a collaborator role to its title i18n key (falls back to generic). */
function collaboratorTitleKey(role: string | null): string {
  switch (role) {
    case "teacher":
      return "reveal_inputs_collaborator_title_teacher";
    case "therapist":
      return "reveal_inputs_collaborator_title_therapist";
    case "caregiver":
      return "reveal_inputs_collaborator_title_caregiver";
    default:
      return "reveal_inputs_collaborator_title_generic";
  }
}

function CardIcon({ kind }: { kind: ContributionCard["kind"] }) {
  // Simple, calm glyphs — decorative (aria-hidden); the title carries meaning.
  const glyph =
    kind === "parent" ? "♥" : kind === "baseline" ? "✦" : kind === "iep" ? "▤" : "◎";
  return (
    <span className={`reveal-input-icon reveal-input-icon-${kind}`} aria-hidden="true">
      {glyph}
    </span>
  );
}

function InputCard({
  card,
  learnerName,
  index,
  reducedMotion,
}: {
  card: ContributionCard;
  learnerName: string;
  index: number;
  reducedMotion: boolean;
}) {
  const t = useTranslations("brain_clone");
  let title: string;
  let detail: string;
  switch (card.kind) {
    case "parent":
      title = t("reveal_inputs_parent_title");
      detail = t("reveal_inputs_parent_count", { count: card.count });
      break;
    case "baseline":
      title = t("reveal_inputs_baseline_title", { name: learnerName });
      detail = t("reveal_inputs_baseline_count", { count: card.count });
      break;
    case "iep":
      title = t("reveal_inputs_iep_title", { name: learnerName });
      detail = t("reveal_inputs_iep_detail");
      break;
    case "collaborator":
    default:
      title = t(collaboratorTitleKey(card.role));
      detail = t("reveal_inputs_collaborator_count", { count: card.count });
      break;
  }
  return (
    <li
      className="reveal-input-card"
      data-reduced-motion={reducedMotion ? "true" : "false"}
      style={{ animationDelay: reducedMotion ? "0ms" : `${index * 120}ms` }}
    >
      <CardIcon kind={card.kind} />
      <div className="reveal-input-body">
        <p className="reveal-input-title">{title}</p>
        <p className="reveal-input-detail">{detail}</p>
      </div>
    </li>
  );
}

export function InputsAssembling({
  learnerName,
  contributions,
  reducedMotion,
}: {
  learnerName: string;
  contributions: ContributionSummary;
  reducedMotion: boolean;
}) {
  const t = useTranslations("brain_clone");

  return (
    <section className="reveal-inputs" aria-labelledby="reveal-inputs-title">
      <header className="reveal-screen-head">
        <p className="reveal-screen-eyebrow">{t("reveal_inputs_eyebrow")}</p>
        <h2 id="reveal-inputs-title" className="reveal-screen-title">
          {t("reveal_inputs_title", { name: learnerName })}
        </h2>
        <p className="reveal-screen-caption">
          {t("reveal_inputs_caption", { name: learnerName })}
        </p>
      </header>

      {contributions.isEmpty ? (
        <div className="reveal-empty" role="status">
          <p className="reveal-empty-title">{t("reveal_inputs_empty_title")}</p>
          <p className="reveal-empty-body">
            {t("reveal_inputs_empty_body", { name: learnerName })}
          </p>
        </div>
      ) : (
        <ul className="reveal-inputs-grid">
          {contributions.cards.map((card, i) => (
            <InputCard
              key={card.key}
              card={card}
              learnerName={learnerName}
              index={i}
              reducedMotion={reducedMotion}
            />
          ))}
        </ul>
      )}

      <style>{`
        .reveal-inputs-grid {
          list-style: none;
          margin: 1.25rem 0 0;
          padding: 0;
          display: grid;
          gap: 0.7rem;
        }
        @media (min-width: 540px) {
          .reveal-inputs-grid { grid-template-columns: 1fr 1fr; }
        }
        .reveal-input-card {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.95rem 1.05rem;
          border: 1px solid var(--iw-border, #e2e6f0);
          border-radius: 14px;
          background: var(--iw-raised, #fff);
          opacity: 0;
          transform: translateY(6px);
          animation: revealInputIn 480ms ease forwards;
        }
        .reveal-input-card[data-reduced-motion="true"] {
          opacity: 1;
          transform: none;
          animation: none;
        }
        .reveal-input-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 9999px;
          font-size: 1rem;
          line-height: 1;
          color: var(--bc-primary, #5b3df5);
          background: color-mix(in oklch, var(--bc-primary, #5b3df5) 12%, var(--iw-bg, #fff));
        }
        .reveal-input-body { min-width: 0; }
        .reveal-input-title {
          margin: 0;
          font-weight: 700;
          font-size: 0.95rem;
          color: var(--iw-ink, #0b1020);
        }
        .reveal-input-detail {
          margin: 0.2rem 0 0;
          font-size: 0.88rem;
          color: var(--iw-ink-muted, #475569);
          font-variant-numeric: tabular-nums;
        }
        @keyframes revealInputIn {
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .reveal-input-card { opacity: 1; transform: none; animation: none; }
        }
      `}</style>
    </section>
  );
}
