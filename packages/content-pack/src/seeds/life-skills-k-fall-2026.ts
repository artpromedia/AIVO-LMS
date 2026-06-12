/**
 * Life Skills K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `cec-life-skills-k-5` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const lifeSkillsKFall2026: ContentPack = {
  id: "life-skills-k-fall-2026",
  title: "Life Skills K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "life_skills",
  gradeBand: "K",
  skillGraphRefs: ["cec-life-skills-k-5"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "life-k-001",
      title: "Morning routine",
      skillId: "life-skills.K.independence",
      type: "multiple_choice",
      prompt: "What comes FIRST in the morning routine: shoes on, or socks on?",
      choices: [
        { id: "a", label: "Socks on", correct: true },
        { id: "b", label: "Shoes on", correct: false },
        { id: "c", label: "Neither", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "life-k-002",
      title: "Safe choice",
      skillId: "life-skills.K.independence",
      type: "multiple_choice",
      prompt: "A pot on the stove is steaming. What is the SAFE choice?",
      choices: [
        { id: "a", label: "Stay back and tell an adult", correct: true },
        { id: "b", label: "Touch it", correct: false },
        { id: "c", label: "Pull it down", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "life-k-003",
      title: "Ask for help",
      skillId: "life-skills.K.independence",
      type: "multiple_choice",
      prompt: "You can't reach your coat hook. What can you say?",
      choices: [
        { id: "a", label: "Can you help me reach my hook, please?", correct: true },
        { id: "b", label: "Nothing \u2014 give up", correct: false },
        { id: "c", label: "Throw the coat", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "life-k-004",
      title: "Tell the routine",
      skillId: "life-skills.K.independence",
      type: "voice",
      prompt: "Tell me two things you do to get ready for school.",
      expectedAnswer: "i",
      difficulty: "stretch",
    },
  ],
};
