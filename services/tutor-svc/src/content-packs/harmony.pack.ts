/**
 * Starter content pack for Harmony (Social-Emotional Learning, K–2).
 *
 * Anchors: `casel-sel-k2` skills. Consent-gated by the tutor's policy.
 */
import type { ContentPack } from "@aivo/content-pack";

export const harmonyStarterPack: ContentPack = {
  id: "harmony-sel-k2-starter",
  title: "Harmony — SEL K–2 Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "sel",
  gradeBand: "K",
  skillGraphRefs: ["casel-sel-k2"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "harmony.k2.feelings.intro",
      title: "Name the feeling",
      skillId: "casel.k2.self_awareness.feelings",
      type: "narration",
      prompt:
        "Feelings are normal. Today we'll learn to name some of them — happy, sad, angry, calm.",
      difficulty: "intro",
    },
    {
      id: "harmony.k2.feelings.tap",
      title: "Match the face",
      skillId: "casel.k2.self_awareness.feelings",
      type: "tap",
      prompt: "Tap the face that shows 'happy'.",
      difficulty: "core",
      choices: [
        { id: "smile", label: "😊 smiling", correct: true },
        { id: "frown", label: "😟 frowning", correct: false },
        { id: "angry", label: "😠 angry", correct: false },
      ],
    },
    {
      id: "harmony.k2.calm.mc",
      title: "When I feel angry",
      skillId: "casel.k2.self_management.calm",
      type: "multiple_choice",
      prompt: "When I feel angry and want to calm down, what's a good first step?",
      difficulty: "core",
      choices: [
        { id: "breathe", label: "Take three slow breaths", correct: true },
        { id: "shout", label: "Shout at someone", correct: false },
        { id: "throw", label: "Throw a toy", correct: false },
      ],
    },
    {
      id: "harmony.k2.perspective.stretch",
      title: "How might they feel?",
      skillId: "casel.k2.social_awareness.perspective",
      type: "multiple_choice",
      prompt: "A friend dropped their ice cream. How might they feel?",
      difficulty: "stretch",
      choices: [
        { id: "happy", label: "Excited", correct: false },
        { id: "sad", label: "Sad or disappointed", correct: true },
      ],
    },
  ],
};
