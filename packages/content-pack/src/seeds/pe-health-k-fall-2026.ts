/**
 * Pe Health K — Fall 2026 (remediation — all subjects carry REAL authored packs).
 *
 * Hand-authored, standards-aligned activities referencing real
 * `shape-pe-health-k2` skill-graph nodes. Coverage: 4 activities.
 */
import type { ContentPack } from "../types.js";

export const peHealthKFall2026: ContentPack = {
  id: "pe-health-k-fall-2026",
  title: "Pe Health K — Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "pe_health",
  gradeBand: "K",
  skillGraphRefs: ["shape-pe-health-k2"],
  publisher: { name: "AIVO Curriculum Team", email: "curriculum@aivo.local" },
  license: "CC-BY-4.0",
  publishedAt: "2026-09-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "pe-k-001",
      title: "Moving safely",
      skillId: "shape.k2.s1.locomotor",
      type: "multiple_choice",
      prompt: "When we skip around the gym, we keep our eyes\u2026",
      choices: [
        { id: "a", label: "Up, watching our space", correct: true },
        { id: "b", label: "Closed", correct: false },
        { id: "c", label: "On our shoes only", correct: false },
      ],
      difficulty: "intro",
    },
    {
      id: "pe-k-002",
      title: "Balance",
      skillId: "shape.k2.s1.balance",
      type: "multiple_choice",
      prompt: "Which helps you balance on one foot?",
      choices: [
        { id: "a", label: "Arms out, eyes forward", correct: true },
        { id: "b", label: "Spinning fast", correct: false },
        { id: "c", label: "Holding your breath", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "pe-k-003",
      title: "Warm up first",
      skillId: "shape.k2.s3.warmup",
      type: "multiple_choice",
      prompt: "Before running fast, we first\u2026",
      choices: [
        { id: "a", label: "Warm up our muscles", correct: true },
        { id: "b", label: "Eat candy", correct: false },
        { id: "c", label: "Sit very still", correct: false },
      ],
      difficulty: "core",
    },
    {
      id: "pe-k-004",
      title: "Catch it",
      skillId: "shape.k2.s1.toss_catch",
      type: "multiple_choice",
      prompt: "To catch a beanbag, watch the beanbag and\u2026",
      choices: [
        { id: "a", label: "Reach with both hands ready", correct: true },
        { id: "b", label: "Turn around", correct: false },
        { id: "c", label: "Close your eyes", correct: false },
      ],
      difficulty: "stretch",
    },
  ],
};
