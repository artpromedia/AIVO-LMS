/**
 * TutorCharacter.tsx — the tutor host avatar for web. Renders the per-tutor
 * robot portrait (the canonical robot family in `@aivo/brand` TUTORS), tinted
 * by the derived, AA-safe accent ring, and scaled by `tutorState` so the host
 * visibly reacts (idle / speaking / thinking / celebrating). CSS transitions
 * stand in for the React Native `Animated.spring` used in the native variant.
 *
 * Accessibility:
 *   - A stable 88×88px touch area (WCAG 2.5.5) regardless of the inner scale.
 *   - The portrait is decorative (`aria-hidden`); the host's meaning is carried
 *     by the `role="img"` label and the live speech bubble.
 *   - `reducedMotion` swaps in the flat `-reduced.svg` portrait and drops every
 *     transition, so a vestibular-hyper / reduced-motion learner gets a fully
 *     static host.
 *   - The accent ring consumes `--tutor-accent` (suppressed to neutral by the
 *     accessibility shell in high-contrast) and falls back to the tutor's
 *     derived accent so the component is correct even when rendered standalone.
 */
import React from "react";
import { TUTORS, tutorThemeCSSVars, type TutorKey } from "@aivo/brand";
import type { TutorState } from "./types.js";

export interface TutorCharacterProps {
  tutorKey: string;
  tutorState: TutorState;
  speechText?: string;
  reducedMotion?: boolean;
}

const STATE_SCALE: Record<TutorState, number> = {
  idle: 1,
  speaking: 1.05,
  celebrating: 1.15,
  thinking: 0.95,
  encouraging: 1.08,
  pointing: 1.02,
};

/** The shared AIVO companion robot — host fallback for an unknown tutor key. */
const COMPANION_SRC = "/images/mascot/virtual-brain-robot.png";

function isTutorKey(key: string): key is TutorKey {
  return Object.prototype.hasOwnProperty.call(TUTORS, key);
}

export function TutorCharacter({
  tutorKey,
  tutorState,
  speechText,
  reducedMotion = false,
}: TutorCharacterProps) {
  const scale = STATE_SCALE[tutorState] ?? 1;
  const transition = reducedMotion ? "none" : "transform 300ms cubic-bezier(0.34, 1.56, 0.64, 1)";

  const known = isTutorKey(tutorKey);
  const tutor = known ? TUTORS[tutorKey] : null;
  const portrait = tutor ? (reducedMotion ? tutor.avatarReduced : tutor.avatar) : COMPANION_SRC;
  const accent = known ? tutorThemeCSSVars(tutorKey)["--tutor-accent"] : "#7c3aed";
  const label = tutor ? `${tutor.name} is ${tutorState}` : `Tutor is ${tutorState}`;

  return (
    <div
      role="img"
      aria-label={label}
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
            backgroundColor: "var(--tutor-accent-soft, rgba(124,58,237,0.12))",
            border: `2px solid var(--tutor-accent, ${accent})`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            transform: `scale(${scale})`,
            transition,
          }}
        >
          <img
            src={portrait}
            alt=""
            aria-hidden="true"
            width={72}
            height={72}
            style={{ width: 72, height: 72, objectFit: "contain" }}
          />
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
