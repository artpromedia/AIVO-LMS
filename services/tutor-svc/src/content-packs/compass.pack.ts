/**
 * Starter content pack for Compass (Life Skills & Executive Function, 6+).
 *
 * Anchors: `cec-life-skills-6-plus` skills. Consent-gated by the tutor's
 * policy because transition-planning content can be sensitive.
 */
import type { ContentPack } from "@aivo/content-pack";

export const compassStarterPack: ContentPack = {
  id: "compass-life-skills-6-plus-starter",
  title: "Compass — Life Skills & EF 6+ Starter",
  version: "0.1.0",
  schemaVersion: 1,
  subject: "life_skills",
  gradeBand: "6",
  skillGraphRefs: ["cec-life-skills-6-plus"],
  publisher: { name: "AIVO Curriculum (scaffold)" },
  license: "Proprietary",
  publishedAt: "2026-04-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "compass.6.plan.intro",
      title: "Plan a small goal",
      skillId: "cec.ls.6.ef.plan",
      type: "narration",
      prompt: "Executive function is the brain's manager — it helps us plan, start, and finish tasks. Today we'll set one small goal for the week.",
      difficulty: "intro",
    },
    {
      id: "compass.6.plan.tap",
      title: "Break it down",
      skillId: "cec.ls.6.ef.plan",
      type: "tap",
      prompt: "Goal: 'finish my book report by Friday'. Which is a smaller step you can do today?",
      difficulty: "core",
      choices: [
        { id: "step", label: "Read 10 pages of the book", correct: true },
        { id: "vague", label: "Work on the project", correct: false },
        { id: "unrelated", label: "Watch a movie", correct: false },
      ],
    },
    {
      id: "compass.6.time.mc",
      title: "Estimate time",
      skillId: "cec.ls.6.ef.time",
      type: "multiple_choice",
      prompt: "About how long does it take to brush your teeth carefully?",
      difficulty: "core",
      choices: [
        { id: "2min", label: "Around 2 minutes", correct: true },
        { id: "30min", label: "Around 30 minutes", correct: false },
        { id: "5sec", label: "Around 5 seconds", correct: false },
      ],
    },
    {
      id: "compass.6.routine.stretch",
      title: "My morning routine",
      skillId: "cec.ls.6.daily.routine",
      type: "draw",
      prompt: "Draw 4 boxes showing the steps of your morning routine in order.",
      difficulty: "stretch",
    },
  ],
};
