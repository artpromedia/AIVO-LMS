/**
 * Social Studies K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `c3-social-studies-k2` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const socialStudiesKFall2026: ContentPack = {
  id: "social-studies-k-fall-2026",
  title: "Social Studies K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "social_studies",
  gradeBand: "K",
  skillGraphRefs: ["c3-social-studies-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "ss-k-001",
      title: "Ask a question",
      skillId: "c3.k2.D1.Q1",
      type: "multiple_choice",
      prompt: "We want to learn about firefighters. Which is a GOOD question to ask?",
      choices: [
        { id: "a", label: "What do firefighters do at work?", correct: true },
        { id: "b", label: "Is seven a color?", correct: false },
        { id: "c", label: "Why is Tuesday?", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "ss-k-002",
      title: "Then and now",
      skillId: "c3.k2.D2.His.1",
      type: "multiple_choice",
      prompt: "Long ago, children wrote on slates. Today they often write on\u2026",
      choices: [
        { id: "a", label: "Tablets and paper", correct: true },
        { id: "b", label: "Stone walls", correct: false },
        { id: "c", label: "Clouds", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "ss-k-003",
      title: "Community rules",
      skillId: "c3.k2.D2.Civ.1",
      type: "multiple_choice",
      prompt: "Why do we raise a hand before speaking in class?",
      choices: [
        { id: "a", label: "So everyone gets a fair turn", correct: true },
        { id: "b", label: "To exercise", correct: false },
        { id: "c", label: "No reason", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "ss-k-004",
      title: "Use a source",
      skillId: "c3.k2.D3.Src.1",
      type: "multiple_choice",
      prompt: "To find out what school was like long ago, the BEST source is\u2026",
      choices: [
        { id: "a", label: "A photo of a classroom from that time", correct: true },
        { id: "b", label: "A guess", correct: false },
        { id: "c", label: "A cartoon about space", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
