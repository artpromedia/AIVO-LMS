"use client";

import { useEffect, useState } from "react";

export type FocusObservationState = "focused" | "needs_prompt" | "frustrated" | "needs_break";

export interface SelfRegulationRecommendation {
  prompt: string;
  promptText: string;
  audioAllowed: boolean;
}

export interface SelfRegulationPromptProps {
  state: FocusObservationState;
  reason?: string;
  recommendation?: SelfRegulationRecommendation;
  onDismiss?: () => void;
}

const STATE_TITLE: Record<FocusObservationState, string> = {
  focused: "You are on track.",
  needs_prompt: "Need a tiny hint?",
  frustrated: "Let's slow down for a moment.",
  needs_break: "Time for a quick break.",
};

/**
 * Surfaces a self-regulation prompt when the focus monitor flags the
 * learner. The component respects the sensory profile via the
 * `audioAllowed` flag on the recommendation: if false, the prompt is
 * presented silently with no auto-played audio.
 */
export function SelfRegulationPrompt({
  state,
  reason,
  recommendation,
  onDismiss,
}: SelfRegulationPromptProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(false);
  }, [state, reason]);

  if (state === "focused" || dismissed) return null;
  return (
    <aside
      role="status"
      className="self-regulation-prompt rounded border bg-amber-50 p-3"
      data-state={state}
    >
      <p className="font-medium">{STATE_TITLE[state]}</p>
      {recommendation ? (
        <p className="mt-1 text-sm">{recommendation.promptText}</p>
      ) : (
        <p className="mt-1 text-sm">Take a breath and try a smaller step.</p>
      )}
      {reason ? <p className="mt-1 text-xs text-gray-600">{reason}</p> : null}
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          onDismiss?.();
        }}
        className="mt-2 rounded border border-amber-700 px-2 py-1 text-xs"
      >
        Got it
      </button>
    </aside>
  );
}

export default SelfRegulationPrompt;
