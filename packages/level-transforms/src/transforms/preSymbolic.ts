import type { Activity } from "@aivo/content-pack";

/**
 * NON_VERBAL → PRE_SYMBOLIC: cause-and-effect tap with observational
 * scoring. At this level we no longer assume the learner can reliably
 * choose between two referents; the activity becomes a single high-
 * contrast tap target that produces a multimodal reward (sound + animation
 * + visual reinforcement).
 *
 *   - All activities collapse to `type: "tap"` with a single "Go" choice.
 *   - The runtime/scoring layer marks the response observationally — there
 *     is no "wrong" answer at this level (`correct` removed).
 *   - `tags` includes `score:observational` so scoring/services know to
 *     treat the response as evidence-of-engagement rather than accuracy.
 */
export function transformToPreSymbolic(a: Activity): Activity {
  return {
    ...a,
    type: "tap",
    choices: [{ id: "go", label: "▶" }],
    expectedAnswer: undefined,
    adaptations: {
      ...(a.adaptations ?? {}),
      maxOnScreenChoices: 1,
      forceSubtitles: false,
      reducedMotion: true,
      extraThinkingTimeMs: Math.max(a.adaptations?.extraThinkingTimeMs ?? 0, 12_000),
    },
    tags: dedupe([
      ...(a.tags ?? []).filter((t) => t !== "level:non_verbal"),
      "level:pre_symbolic",
      "score:observational",
    ]),
  };
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}
