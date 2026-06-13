/* eslint-disable no-restricted-syntax -- the inline <style> block uses literal
   hex fallbacks behind `var(--iw-*, …)` / `var(--bc-primary, …)` so the screen
   still renders if those design tokens haven't loaded yet (same pattern as
   building-client.tsx). */
"use client";

/**
 * Sprint C-14 — storyboard screen 3: how she learns best.
 *
 * The transparency narrative, finally told on screen. Each operating
 * instruction (modality / pacing / sensory / focus) is a card carrying:
 *   - a SOURCE CHIP — "You told us" / "Her baseline showed" / "Ms. Rivera
 *     observed" — derived from the decision's real `source` field;
 *   - a 3-LEVEL CONFIDENCE DOT, shown in plain words ("We're fairly sure" /
 *     "An early signal"), from the pure `deriveConfidence` rule.
 *
 * INVARIANT: a chip or dot never renders without backing data. The view-model
 * (`assembleOperatingInstructions`) only ever produces cards that have a real
 * source + a real confidence, so this component renders exactly what it's
 * given. The empty/partial states are designed.
 */
import * as React from "react";
import { useTranslations } from "next-intl";
import type { OperatingInstruction } from "@/lib/learner/reveal-assembly";
import type { RevealConfidence, RevealSource } from "@/lib/learner/reveal-confidence";

const FACET_LABEL_KEY: Record<OperatingInstruction["facet"], string> = {
  modality: "reveal_learns_facet_modality",
  pacing: "reveal_learns_facet_pacing",
  sensory: "reveal_learns_facet_sensory",
  focus: "reveal_learns_facet_focus",
};

function instructionKey(facet: OperatingInstruction["facet"], valueKey: string): string {
  return `reveal_learns_${facet}_${valueKey}`;
}

function sourceLabelKey(source: RevealSource): string {
  if (source.kind === "collaborator") {
    switch (source.role) {
      case "teacher":
        return "reveal_learns_source_collaborator_teacher";
      case "therapist":
        return "reveal_learns_source_collaborator_therapist";
      case "caregiver":
        return "reveal_learns_source_collaborator_caregiver";
      default:
        return "reveal_learns_source_collaborator_generic";
    }
  }
  return `reveal_learns_source_${source.kind}`;
}

const CONFIDENCE_LABEL_KEY: Record<RevealConfidence, string> = {
  high: "reveal_learns_confidence_high",
  medium: "reveal_learns_confidence_medium",
  low: "reveal_learns_confidence_low",
};

/** Filled-dot count for the 3-level dot (high=3, medium=2, low=1). */
const CONFIDENCE_DOTS: Record<RevealConfidence, number> = { high: 3, medium: 2, low: 1 };

function ConfidenceDot({ confidence }: { confidence: RevealConfidence }) {
  const t = useTranslations("brain_clone");
  const filled = CONFIDENCE_DOTS[confidence];
  const label = t(CONFIDENCE_LABEL_KEY[confidence]);
  return (
    <span className="reveal-confidence" data-level={confidence}>
      <span className="reveal-confidence-dots" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={`reveal-confidence-dot ${i < filled ? "is-filled" : ""}`}
          />
        ))}
      </span>
      <span className="reveal-confidence-label">{label}</span>
      <span className="sr-only">{t("reveal_learns_confidence_aria", { level: label })}</span>
    </span>
  );
}

function InstructionCard({
  instruction,
  learnerName,
}: {
  instruction: OperatingInstruction;
  learnerName: string;
}) {
  const t = useTranslations("brain_clone");
  return (
    <li className="reveal-learns-card">
      <p className="reveal-learns-facet">{t(FACET_LABEL_KEY[instruction.facet])}</p>
      <p className="reveal-learns-instruction">
        {t(instructionKey(instruction.facet, instruction.valueKey), { name: learnerName })}
      </p>
      <div className="reveal-learns-meta">
        <span className="reveal-source-chip">
          {t(sourceLabelKey(instruction.source), { name: learnerName })}
        </span>
        <ConfidenceDot confidence={instruction.confidence} />
      </div>
    </li>
  );
}

export function HowSheLearns({
  learnerName,
  instructions,
}: {
  learnerName: string;
  instructions: OperatingInstruction[];
}) {
  const t = useTranslations("brain_clone");

  return (
    <section className="reveal-learns" aria-labelledby="reveal-learns-title">
      <header className="reveal-screen-head">
        <p className="reveal-screen-eyebrow">
          {t("reveal_learns_eyebrow", { name: learnerName })}
        </p>
        <h2 id="reveal-learns-title" className="reveal-screen-title">
          {t("reveal_learns_title", { name: learnerName })}
        </h2>
        <p className="reveal-screen-caption">{t("reveal_learns_caption")}</p>
      </header>

      {instructions.length === 0 ? (
        <div className="reveal-empty" role="status">
          <p className="reveal-empty-title">
            {t("reveal_learns_empty_title", { name: learnerName })}
          </p>
          <p className="reveal-empty-body">
            {t("reveal_learns_empty_body", { name: learnerName })}
          </p>
        </div>
      ) : (
        <ul className="reveal-learns-grid">
          {instructions.map((ins) => (
            <InstructionCard
              key={`${ins.facet}:${ins.valueKey}`}
              instruction={ins}
              learnerName={learnerName}
            />
          ))}
        </ul>
      )}

      <style>{`
        .reveal-learns-grid {
          list-style: none;
          margin: 1.25rem 0 0;
          padding: 0;
          display: grid;
          gap: 0.7rem;
        }
        @media (min-width: 540px) {
          .reveal-learns-grid { grid-template-columns: 1fr 1fr; }
        }
        .reveal-learns-card {
          padding: 1rem 1.1rem;
          border: 1px solid var(--iw-border, #e2e6f0);
          border-radius: 14px;
          background: var(--iw-raised, #fff);
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }
        .reveal-learns-facet {
          margin: 0;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--bc-primary, #5b3df5);
        }
        .reveal-learns-instruction {
          margin: 0;
          font-size: 0.96rem;
          line-height: 1.45;
          color: var(--iw-ink, #0b1020);
        }
        .reveal-learns-meta {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.5rem 0.75rem;
          margin-top: 0.15rem;
        }
        .reveal-source-chip {
          display: inline-flex;
          align-items: center;
          padding: 0.25rem 0.6rem;
          border-radius: 9999px;
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--iw-ink, #0b1020);
          background: color-mix(in oklch, var(--bc-primary, #5b3df5) 9%, var(--iw-bg, #fff));
          border: 1px solid color-mix(in oklch, var(--bc-primary, #5b3df5) 20%, var(--iw-border, #e2e6f0));
        }
        .reveal-confidence {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
        }
        .reveal-confidence-dots { display: inline-flex; gap: 3px; }
        .reveal-confidence-dot {
          width: 8px;
          height: 8px;
          border-radius: 9999px;
          background: var(--iw-border, #cbd5e1);
        }
        /* AA-contrast fill colours per level (against the white card). */
        .reveal-confidence[data-level="high"] .reveal-confidence-dot.is-filled { background: #15803d; }
        .reveal-confidence[data-level="medium"] .reveal-confidence-dot.is-filled { background: #b45309; }
        .reveal-confidence[data-level="low"] .reveal-confidence-dot.is-filled { background: #6b7280; }
        .reveal-confidence-label {
          font-size: 0.78rem;
          font-weight: 600;
          color: var(--iw-ink-muted, #475569);
        }
        .sr-only {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap; border: 0;
        }
      `}</style>
    </section>
  );
}
