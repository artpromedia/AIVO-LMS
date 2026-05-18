/**
 * Starter content pack for Sage (English Language Arts, Kindergarten).
 *
 * Anchors: `ccss-ela-k` skills `RF.1`, `RF.2`, `RL.1`.
 */
import type { ContentPack } from "@aivo/content-pack";

export const sageStarterPack: ContentPack = {
  id: "sage-ela-k-starter",
  title: "Sage — ELA K Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "ela",
  gradeBand: "K",
  skillGraphRefs: ["ccss-ela-k"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "sage.k.rf1.intro",
      title: "How books work",
      skillId: "ccss-ela.K.RF.1",
      type: "narration",
      prompt:
        "When we read, we go from the top of the page to the bottom, and from left to right. Let's practice with this story.",
      difficulty: "intro",
    },
    {
      id: "sage.k.rf2.tap",
      title: "Same beginning sound",
      skillId: "ccss-ela.K.RF.2",
      type: "tap",
      prompt: "Which word starts with the same sound as 'sun'? Tap the picture.",
      difficulty: "core",
      choices: [
        { id: "sock", label: "sock", correct: true },
        { id: "moon", label: "moon", correct: false },
        { id: "tree", label: "tree", correct: false },
      ],
    },
    {
      id: "sage.k.rl1.mc",
      title: "Story question",
      skillId: "ccss-ela.K.RL.1",
      type: "multiple_choice",
      prompt: "In the story we just read, who went to the park?",
      difficulty: "core",
      choices: [
        { id: "the_dog", label: "The dog", correct: true },
        { id: "the_cat", label: "The cat", correct: false },
        { id: "the_bird", label: "The bird", correct: false },
      ],
    },
    {
      id: "sage.k.rf2.stretch",
      title: "Rhyming pairs",
      skillId: "ccss-ela.K.RF.2",
      type: "match",
      prompt: "Match the words that rhyme.",
      difficulty: "stretch",
      choices: [
        { id: "cat-hat", label: "cat → hat", correct: true },
        { id: "dog-log", label: "dog → log", correct: true },
      ],
    },
  ],
};
