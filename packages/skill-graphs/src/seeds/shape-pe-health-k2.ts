import type { SkillGraph } from "../types.js";

/**
 * SHAPE America — National Standards for K-12 Physical Education,
 * Grades K–2 starter slice for Vigor.
 * Source: SHAPE America (Society of Health and Physical Educators),
 * National Standards & Grade-Level Outcomes (2014).
 *
 * Vigor's three tracks (general PE, health, DAPE) ride this graph; the
 * DAPE-specific objectives are intentionally light here and live in the
 * adapted-content pack so the IEP team can author per-learner targets.
 */
export const shapePeHealthK2: SkillGraph = {
  id: "shape-pe-health-k2",
  title: "Physical Education & Health — Grades K–2 (SHAPE-aligned)",
  version: "1.0.0",
  source: "SHAPE America National Standards & Grade-Level Outcomes (2014)",
  framework: "SHAPE",
  subject: "pe_health",
  gradeBand: "K",
  skills: [
    {
      id: "shape.k2.s1.locomotor",
      title: "Move in different ways (walk, run, hop, gallop)",
      description: "I can walk, run, hop, and gallop without bumping into things.",
      subject: "pe_health",
      gradeBand: "K",
      frameworkRefs: [{ framework: "SHAPE", code: "S1.E1.K" }],
      prerequisites: [],
    },
    {
      id: "shape.k2.s1.balance",
      title: "Balance on one foot",
      description: "I can balance on one foot for a few seconds.",
      subject: "pe_health",
      gradeBand: "K",
      frameworkRefs: [{ framework: "SHAPE", code: "S1.E7.K" }],
      prerequisites: ["shape.k2.s1.locomotor"],
    },
    {
      id: "shape.k2.s1.toss_catch",
      title: "Toss and catch a soft object",
      description: "I can toss and catch a soft ball or beanbag with two hands.",
      subject: "pe_health",
      gradeBand: "K",
      frameworkRefs: [{ framework: "SHAPE", code: "S1.E13.K" }],
      prerequisites: ["shape.k2.s1.locomotor"],
    },
    {
      id: "shape.k2.s3.warmup",
      title: "Get my body ready to move",
      description: "I can stretch and warm up before being active.",
      subject: "pe_health",
      gradeBand: "K",
      frameworkRefs: [{ framework: "SHAPE", code: "S3.E1.K" }],
      prerequisites: [],
    },
    {
      id: "shape.k2.health.choose",
      title: "Choose a healthy snack or habit",
      description: "I can pick a healthy snack and tell why it's good for me.",
      subject: "pe_health",
      gradeBand: "K",
      frameworkRefs: [{ framework: "SHAPE", code: "S3.E2.K" }],
      prerequisites: ["shape.k2.s3.warmup"],
    },
  ],
};
