/**
 * StageContent.tsx — web (DOM) version of the active beat content area.
 * Mirrors the native variant's behaviour for narration text, prompt headers
 * and an optional always-visible subtitle band when the learner has the
 * `useSubtitles` adaptation enabled.
 */
import React from "react";
import type { Beat, SensoryAdaptations } from "./types.js";

export interface StageContentProps {
  currentBeat: Beat | null;
  adaptations: SensoryAdaptations;
}

export function StageContent({ currentBeat, adaptations }: StageContentProps) {
  if (!currentBeat) return null;

  const fontSize = adaptations?.contrastBoost ? 20 : 16;
  const showSubtitles = adaptations?.useSubtitles ?? false;

  return (
    <div
      className="aivo-stage-content"
      aria-label="Stage content area"
      style={{
        flex: 1,
        overflowY: "auto",
        padding: 16,
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      {currentBeat.narration ? (
        <p
          aria-label={currentBeat.narration}
          style={{
            color: "#e2e8f0",
            fontSize,
            lineHeight: "1.6em",
            fontWeight: 400,
            margin: 0,
          }}
        >
          {currentBeat.narration}
        </p>
      ) : null}

      {currentBeat.interaction?.prompt ? (
        <h2
          style={{
            color: "#f8fafc",
            fontSize: fontSize + 2,
            lineHeight: "1.5em",
            fontWeight: 700,
            marginTop: 8,
            margin: 0,
          }}
        >
          {currentBeat.interaction.prompt}
        </h2>
      ) : null}

      {showSubtitles && currentBeat.narration ? (
        <div
          aria-hidden="true"
          style={{
            backgroundColor: "rgba(0,0,0,0.7)",
            borderRadius: 8,
            padding: 8,
            marginTop: 8,
            color: "#fff",
            fontSize: 14,
            textAlign: "center",
          }}
        >
          {currentBeat.narration}
        </div>
      ) : null}
    </div>
  );
}
