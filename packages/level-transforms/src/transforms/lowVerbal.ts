import type { Activity } from "@aivo/content-pack";

/**
 * SUPPORTED → LOW_VERBAL: replace prose-heavy interactions with picture
 * choices and reduce text density. Speech-input activities (`voice`) are
 * rewritten as `tap` over the same expected answer set so a learner who
 * cannot reliably produce expressive speech can still respond.
 *
 *   - `voice` → `tap` over the variants in `expectedAnswer` (split on `|`).
 *     The first variant becomes the only correct choice.
 *   - `multiple_choice` keeps its choices but drops verbose distractors —
 *     anything > 18 characters is shortened with an ellipsis.
 *   - `narration` is preserved (it's already non-interactive).
 *   - On-screen choices clamped to ≤ 2.
 */
export function transformToLowVerbal(a: Activity): Activity {
  let next: Activity = { ...a };

  if (a.type === "voice" && a.expectedAnswer) {
    const variants = a.expectedAnswer.split("|").map((s) => s.trim()).filter(Boolean);
    if (variants.length > 0) {
      const correct = variants[0];
      const distractors = variants.slice(1, 2); // keep at most one alt as a wrong choice (we still mark only `correct` as correct)
      next = {
        ...next,
        type: "tap",
        choices: [
          { id: "c-correct", label: correct, correct: true },
          ...distractors.map((d, i) => ({
            id: `c-${i}`,
            label: d,
            correct: false,
          })),
        ],
        expectedAnswer: undefined,
      };
    }
  } else if (a.choices && a.choices.length > 0) {
    next = {
      ...next,
      choices: a.choices.map((c) => ({
        ...c,
        label: shortenLabel(c.label),
      })),
    };
  }

  next = {
    ...next,
    adaptations: {
      ...(next.adaptations ?? {}),
      maxOnScreenChoices: Math.min(next.adaptations?.maxOnScreenChoices ?? 2, 2),
      forceSubtitles: true,
      extraThinkingTimeMs: Math.max(next.adaptations?.extraThinkingTimeMs ?? 0, 6_000),
    },
    tags: dedupe([...(next.tags ?? []).filter((t) => t !== "level:supported"), "level:low_verbal"]),
  };
  return next;
}

function shortenLabel(label: string): string {
  if (label.length <= 18) return label;
  return label.slice(0, 17) + "…";
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}
