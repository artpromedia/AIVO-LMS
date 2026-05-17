/**
 * TutorCharacter.tsx — animated tutor avatar for web. CSS transitions stand
 * in for the React Native `Animated.spring` used in the native variant.
 * Keeps a stable 88×88px touch area (WCAG 2.5.5) regardless of the inner
 * scale transform.
 */
import React from "react";
import type { TutorState } from "./types.js";

export interface TutorCharacterProps {
  tutorKey: string;
  tutorState: TutorState;
  speechText?: string;
  reducedMotion?: boolean;
}

const TUTOR_EMOJIS: Record<string, string> = {
  nova: "🤖",
  sage: "🦉",
  spark: "⚡",
  chrono: "⏱",
  pixel: "💻",
  echo: "🎵",
  harmony: "💜",
  atlas: "🌍",
  cadence: "🎶",
  vigor: "🏃",
  lingua: "🌐",
  forge: "⚙️",
  compass: "🧭",
  muse: "🎨",
};

const STATE_SCALE: Record<TutorState, number> = {
  idle: 1,
  speaking: 1.05,
  celebrating: 1.15,
  thinking: 0.95,
  encouraging: 1.08,
  pointing: 1.02,
};

export function TutorCharacter({ tutorKey, tutorState, speechText, reducedMotion = false }: TutorCharacterProps) {
  const scale = STATE_SCALE[tutorState] ?? 1;
  const emoji = TUTOR_EMOJIS[tutorKey] ?? "🤖";
  const transition = reducedMotion ? "none" : "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)";

  return (
    <div
      role="img"
      aria-label={`Tutor ${tutorKey} is ${tutorState}`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 0",
        gap: 8,
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            backgroundColor: "rgba(124,58,237,0.25)",
            border: "2px solid #7c3aed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 40,
            transform: `scale(${scale})`,
            transition,
          }}
        >
          {emoji}
        </div>
      </div>
      {speechText ? (
        <div
          role="status"
          aria-live="polite"
          aria-label={speechText}
          style={{
            backgroundColor: "#1e1b4b",
            borderRadius: 12,
            padding: 12,
            maxWidth: 280,
            border: "1px solid rgba(124,58,237,0.5)",
            position: "relative",
            color: "#e2e8f0",
            fontSize: 15,
            lineHeight: "1.5em",
            textAlign: "center",
          }}
        >
          {speechText}
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              top: -8,
              left: "50%",
              marginLeft: -6,
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: "8px solid #1e1b4b",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
