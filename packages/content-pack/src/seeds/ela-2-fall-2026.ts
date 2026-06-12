/**
 * ELA — Grade 2 — Fall 2026 (remediation Sprint 09).
 *
 * Hand-authored CCSS grade-2 literacy: fluency (RF.4), main idea of an
 * informational text (RI.2), and vocabulary strategies (L.4). Coverage:
 * 5 activities across 3 grade-2 skills.
 */
import type { ContentPack } from "../types.js";

export const ela2Fall2026: ContentPack = {
  id: "ela-2-fall-2026",
  title: "ELA — Grade 2 — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "ela",
  gradeBand: "2",
  skillGraphRefs: ["ccss-ela-1-8"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "ela-2-001",
      title: "Main idea of a paragraph",
      skillId: "ccss-ela.2.RI.2",
      type: "multiple_choice",
      prompt:
        "Bees visit flowers to collect nectar. They carry pollen from flower to flower, helping new plants grow. What is this paragraph mostly about?",
      choices: [
        { id: "a", label: "How bees help plants", correct: true },
        { id: "b", label: "What flowers smell like", correct: false },
        { id: "c", label: "Where bees sleep", correct: false },
      ],
      difficulty: "intro",
      tags: ["main-idea", "informational"],
    },
    {
      id: "ela-2-002",
      title: "Use context clues",
      skillId: "ccss-ela.2.L.4",
      type: "multiple_choice",
      prompt:
        '"The icy wind made us shiver, so we wore our warmest coats." What does "shiver" mean?',
      choices: [
        { id: "a", label: "Shake from the cold", correct: true },
        { id: "b", label: "Laugh loudly", correct: false },
        { id: "c", label: "Run quickly", correct: false },
      ],
      difficulty: "core",
      tags: ["vocabulary", "context-clues"],
    },
    {
      id: "ela-2-003",
      title: "Prefixes change meaning",
      skillId: "ccss-ela.2.L.4",
      type: "multiple_choice",
      prompt: 'What does "rewrite" mean?',
      choices: [
        { id: "a", label: "Write again", correct: true },
        { id: "b", label: "Write before", correct: false },
        { id: "c", label: "Never write", correct: false },
      ],
      difficulty: "core",
      tags: ["vocabulary", "prefixes"],
    },
    {
      id: "ela-2-004",
      title: "Key detail check",
      skillId: "ccss-ela.2.RI.2",
      type: "multiple_choice",
      prompt:
        "Octopuses can change color to hide from danger. Which detail supports that octopuses are good at hiding?",
      choices: [
        { id: "a", label: "They change color", correct: true },
        { id: "b", label: "They live in water", correct: false },
        { id: "c", label: "They have eight arms", correct: false },
      ],
      difficulty: "stretch",
      tags: ["key-details"],
    },
    {
      id: "ela-2-005",
      title: "Read with expression",
      skillId: "ccss-ela.2.RF.4",
      type: "voice",
      prompt: 'Read this sentence with feeling: "What a wonderful surprise this is!"',
      expectedAnswer: "what a wonderful surprise this is",
      difficulty: "core",
      tags: ["fluency", "voice"],
    },
  ],
};
