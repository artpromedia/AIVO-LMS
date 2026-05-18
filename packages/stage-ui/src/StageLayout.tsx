/**
 * StageLayout.tsx — web (DOM) version. Metro's platform extension
 * resolution prefers `StageLayout.native.tsx` for React Native bundles,
 * so this file is the default export everywhere else (web, Storybook,
 * server-side rendering).
 *
 * The layout is a sensory-adapted full-height flex container. When the
 * learner's adaptations indicate motion-sensitivity we drop the brighter
 * indigo background in favour of a calmer slate palette.
 */
import React from "react";
import type {
  Beat,
  FunctioningLevel,
  SensoryAdaptations,
  SessionPhase,
  TutorState,
} from "./types.js";

export interface StageLayoutProps {
  phase: SessionPhase;
  tutorState: TutorState;
  currentBeat: Beat | null;
  progress: number;
  totalBeats: number;
  currentBeatIndex: number;
  functioningLevel: FunctioningLevel;
  adaptations: SensoryAdaptations;
  children?: React.ReactNode;
  onAnswer?: (correct: boolean) => void;
}

export function StageLayout({ children, adaptations }: StageLayoutProps) {
  const reducedMotion = adaptations?.motionReduced ?? false;
  const background = reducedMotion ? "#0f172a" : "#1e1b4b";

  return (
    <div
      className="aivo-stage-layout"
      role="region"
      aria-label="Stage screen"
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100%",
        backgroundColor: background,
        color: "#f1f5f9",
        padding: "8px 16px",
        boxSizing: "border-box",
        // Honour `prefers-reduced-motion` for users who haven't set adaptations.
        // The reducedMotion flag still wins when explicitly opted-in.
        transition: reducedMotion ? "none" : "background-color 200ms ease",
      }}
    >
      {children}
    </div>
  );
}
