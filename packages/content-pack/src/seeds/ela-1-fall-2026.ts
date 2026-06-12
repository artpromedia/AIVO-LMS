/**
 * ELA — Grade 1 — Fall 2026 (remediation Sprint 09).
 *
 * Hand-authored CCSS grade-1 literacy: decoding (RF.3), story retelling
 * (RL.2), and conventions (L.1), with a spoken-fluency check. Coverage:
 * 5 activities across 3 grade-1 skills.
 */
import type { ContentPack } from "../types.js";

export const ela1Fall2026: ContentPack = {
  id: "ela-1-fall-2026",
  title: "ELA — Grade 1 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "ela",
  gradeBand: "1",
  skillGraphRefs: ["ccss-ela-1-8"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "ela-1-001",
      title: "Decode a digraph word",
      skillId: "ccss-ela.1.RF.3",
      type: "multiple_choice",
      prompt: 'Which word has the same beginning sound as "chair"?',
      choices: [
        { id: "cheese", label: "cheese", correct: true },
        { id: "car", label: "car", correct: false },
        { id: "shoe", label: "shoe", correct: false },
      ],
      difficulty: "intro",
      tags: ["phonics", "digraphs"],
    },
    {
      id: "ela-1-002",
      title: "Silent-e words",
      skillId: "ccss-ela.1.RF.3",
      type: "multiple_choice",
      prompt: 'Add a silent e to "cap". What word do you get?',
      choices: [
        { id: "cape", label: "cape", correct: true },
        { id: "capp", label: "capp", correct: false },
        { id: "caps", label: "caps", correct: false },
      ],
      difficulty: "core",
      tags: ["phonics", "long-vowels"],
    },
    {
      id: "ela-1-003",
      title: "Retell: what happened first?",
      skillId: "ccss-ela.1.RL.2",
      type: "multiple_choice",
      prompt:
        "In our story, Ana planted a seed, watered it every day, and a flower grew. What happened FIRST?",
      choices: [
        { id: "plant", label: "Ana planted a seed", correct: true },
        { id: "water", label: "Ana watered it", correct: false },
        { id: "grew", label: "A flower grew", correct: false },
      ],
      difficulty: "core",
      tags: ["retelling", "sequence"],
    },
    {
      id: "ela-1-004",
      title: "Choose the correct verb",
      skillId: "ccss-ela.1.L.1",
      type: "multiple_choice",
      prompt: "Which sentence is correct?",
      choices: [
        { id: "a", label: "The dogs run fast.", correct: true },
        { id: "b", label: "The dogs runs fast.", correct: false },
        { id: "c", label: "The dogs running.", correct: false },
      ],
      difficulty: "stretch",
      tags: ["grammar", "agreement"],
    },
    {
      id: "ela-1-005",
      title: "Read it aloud",
      skillId: "ccss-ela.1.RF.3",
      type: "voice",
      prompt: 'Read this sentence out loud: "The brave fox jumps over the log."',
      expectedAnswer: "the brave fox jumps over the log",
      difficulty: "core",
      tags: ["fluency", "voice"],
    },
  ],
};
