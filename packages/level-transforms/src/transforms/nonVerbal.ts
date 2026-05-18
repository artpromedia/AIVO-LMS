import type { Activity } from "@aivo/content-pack";

/**
 * LOW_VERBAL → NON_VERBAL: switch-scannable, no expressive-speech needed.
 * The activity is rendered as a binary or 2-cell `tap` so a single switch
 * cycles between options and a second activation selects.
 *
 *   - `tap` / `multiple_choice` choices clamped to 2 (correct + 1 distractor).
 *   - `voice` was already rewritten by the LOW_VERBAL transform; if any
 *     `voice` slips through here we degrade to a `tap` "yes/no".
 *   - `drag_drop` becomes `tap` ("does it go here?" yes/no).
 *   - Adaptations: reducedMotion ON; max 2 on-screen choices.
 */
export function transformToNonVerbal(a: Activity): Activity {
  let next: Activity = { ...a };

  if (a.type === "drag_drop" || a.type === "match" || a.type === "voice") {
    next = {
      ...next,
      type: "tap",
      // Recast as a yes/no probe over the original prompt.
      choices: [
        { id: "yes", label: "Yes", correct: true },
        { id: "no", label: "No", correct: false },
      ],
      expectedAnswer: undefined,
    };
  } else if (
    (a.type === "tap" || a.type === "multiple_choice") &&
    a.choices &&
    a.choices.length > 2
  ) {
    const correct = a.choices.find((c) => c.correct);
    const distractor = a.choices.find((c) => !c.correct);
    if (correct && distractor) {
      next = { ...next, choices: [correct, distractor] };
    }
  }

  next = {
    ...next,
    adaptations: {
      ...(next.adaptations ?? {}),
      maxOnScreenChoices: 2,
      forceSubtitles: true,
      reducedMotion: true,
      extraThinkingTimeMs: Math.max(next.adaptations?.extraThinkingTimeMs ?? 0, 8_000),
    },
    tags: dedupe([
      ...(next.tags ?? []).filter((t) => t !== "level:low_verbal"),
      "level:non_verbal",
    ]),
  };
  return next;
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}
