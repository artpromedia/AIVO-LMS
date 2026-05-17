import type { Activity } from "@aivo/content-pack";

/**
 * STANDARD → SUPPORTED: keep the same activity shape but add scaffolding
 * cues. The runtime should reveal the cue if the learner hesitates.
 *
 *   - Limit on-screen choices to ≤ 3 to reduce visual load.
 *   - Surface the prompt as both spoken narration and on-screen text.
 *   - Allow extra thinking time before the runtime escalates a hint.
 */
export function transformToSupported(a: Activity): Activity {
  const next: Activity = {
    ...a,
    adaptations: {
      ...(a.adaptations ?? {}),
      maxOnScreenChoices: Math.min(a.adaptations?.maxOnScreenChoices ?? 4, 3),
      forceSubtitles: true,
      extraThinkingTimeMs: Math.max(a.adaptations?.extraThinkingTimeMs ?? 0, 4_000),
    },
    tags: dedupe([...(a.tags ?? []), "level:supported"]),
  };
  return next;
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}
