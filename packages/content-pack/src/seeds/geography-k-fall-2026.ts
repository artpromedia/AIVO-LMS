/**
 * Geography K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `ncge-geography-k2` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const geographyKFall2026: ContentPack = {
  id: "geography-k-fall-2026",
  title: "Geography K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "geography",
  gradeBand: "K",
  skillGraphRefs: ["ncge-geography-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "geo-k-001",
      title: "Maps show places",
      skillId: "ncge.k2.S1.1",
      type: "multiple_choice",
      prompt: "Which tool shows where places are?",
      choices: [
        { id: "a", label: "A map", correct: true },
        { id: "b", label: "A spoon", correct: false },
        { id: "c", label: "A drum", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "geo-k-002",
      title: "Land and water",
      skillId: "ncge.k2.S2.1",
      type: "multiple_choice",
      prompt: "On most maps, the BLUE areas show\u2026",
      choices: [
        { id: "a", label: "Water", correct: true },
        { id: "b", label: "Forests", correct: false },
        { id: "c", label: "Roads", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "geo-k-003",
      title: "Find the school",
      skillId: "ncge.k2.S3.1",
      type: "multiple_choice",
      prompt: "A map symbol of a small building with a flag usually means\u2026",
      choices: [
        { id: "a", label: "A school", correct: true },
        { id: "b", label: "An ocean", correct: false },
        { id: "c", label: "A cloud", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "geo-k-004",
      title: "Near and far",
      skillId: "ncge.k2.S4.1",
      type: "multiple_choice",
      prompt: "The library is next door; the zoo is across town. Which is NEARER?",
      choices: [
        { id: "a", label: "The library", correct: true },
        { id: "b", label: "The zoo", correct: false },
        { id: "c", label: "They are the same", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
