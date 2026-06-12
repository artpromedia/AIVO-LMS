/**
 * Sprint 12 — beat model for the lesson player.
 *
 * Pure data layer extracted from the original lesson-player.tsx: the Beat
 * union, the plan → beat-sequence builder (including the `shorterSteps`
 * story omission), and answer normalization. No React, no IO — unit-tested
 * through use-beat-machine.test.ts.
 */
import type { SurfaceRouterItem } from "@aivo/learner-surfaces";
import type { GeneratedLessonPlan } from "@/lib/db/types";

export type LessonBeatMedia = {
  surfaceType: "video" | "audio";
  assets: Array<{
    id: string;
    kind: "video" | "audio" | "captions";
    src: string;
    alt?: string;
    mimeType?: string;
    language?: string;
    label?: string;
    default?: boolean;
  }>;
};

export type Beat =
  | { kind: "welcome"; key: string; body: string }
  | { kind: "goal"; key: string; body: string }
  | { kind: "story"; key: string; body: string }
  | { kind: "micro"; key: string; body: string }
  | { kind: "example"; key: string; prompt: string; explanation: string }
  | {
      kind: "guided";
      key: string;
      gpId: string;
      surfaceType: SurfaceRouterItem["surfaceType"];
      prompt: string;
      expectedAnswer?: string;
      choices?: string[];
      hint: string;
      scaffold: string;
      skillId?: string;
      media?: LessonBeatMedia;
    }
  | {
      kind: "check";
      key: string;
      checkId: string;
      surfaceType: SurfaceRouterItem["surfaceType"];
      prompt: string;
      expectedAnswer?: string;
      choices?: string[];
      supportIfWrong: string;
      media?: LessonBeatMedia;
    }
  | { kind: "celebrate"; key: string; body: string }
  | { kind: "progress"; key: string; body: string }
  | { kind: "next"; key: string; body: string };

export type InteractiveBeat = Extract<Beat, { kind: "guided" | "check" }>;

export function buildBeats(plan: GeneratedLessonPlan, shorter: boolean): Beat[] {
  const beats: Beat[] = [
    { kind: "welcome", key: "welcome", body: plan.tutorGreeting },
    { kind: "goal", key: "goal", body: plan.objective },
    { kind: "story", key: "story", body: plan.storyHook },
    { kind: "micro", key: "micro", body: plan.microLesson },
    {
      kind: "example",
      key: "example",
      prompt: plan.example.prompt,
      explanation: plan.example.explanation,
    },
  ];
  // shorterSteps preference: drop the story-hook beat to slim the lesson.
  const trimmed = shorter ? beats.filter((b) => b.kind !== "story") : beats;
  plan.guidedPractice.forEach((g, i) =>
    trimmed.push({
      kind: "guided",
      key: `gp-${i}`,
      gpId: g.id,
      surfaceType:
        (g as { surfaceType?: SurfaceRouterItem["surfaceType"] }).surfaceType ??
        (g.choices?.length ? "choice_grid" : "math_expression"),
      prompt: g.prompt,
      expectedAnswer: g.expectedAnswer,
      choices: g.choices,
      hint: g.hint,
      scaffold: g.scaffold,
      skillId: g.skillId,
      media: g.media,
    }),
  );
  plan.checksForUnderstanding.forEach((c, i) =>
    trimmed.push({
      kind: "check",
      key: `chk-${i}`,
      checkId: c.id,
      surfaceType:
        (c as { surfaceType?: SurfaceRouterItem["surfaceType"] }).surfaceType ??
        (c.choices?.length ? "choice_grid" : "math_expression"),
      prompt: c.prompt,
      expectedAnswer: c.expectedAnswer,
      choices: c.choices,
      supportIfWrong: c.supportIfWrong,
      media: c.media,
    }),
  );
  trimmed.push({ kind: "celebrate", key: "celebrate", body: plan.encouragement });
  trimmed.push({ kind: "progress", key: "progress", body: plan.parentSummary });
  trimmed.push({ kind: "next", key: "next", body: plan.nextRecommendedStep });
  return trimmed;
}

export function normalizeAnswer(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

export function isCorrect(expected: string | undefined, actual: string): boolean {
  if (!expected) return true; // open-ended response — accept any non-empty answer
  return normalizeAnswer(expected) === normalizeAnswer(actual);
}
