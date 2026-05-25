/**
 * Sprint C — subject-brain-svc contract spec.
 *
 * For every subject the registry exposes, the `/api/subject-brain/context`
 * response must include the canonical fields tutor-svc and learning-svc
 * depend on. This test guards the shape that the LLM evidence check
 * relies on (`subjectBrainEvidenceUsed.relevantSkills` populated by the
 * generator from this response's `relevantSkills`).
 *
 * Exercises the in-process `buildSubjectContext` so it runs without
 * booting Fastify. The HTTP route is a thin wrapper around it.
 */
import { describe, expect, it } from "vitest";
import { buildSubjectContext, getSubjectBrain } from "../services/index.js";
import type { Subject } from "../services/types.js";

const SUBJECTS_TO_CHECK: Subject[] = [
  // Sprint C — fully wired before Pair 2.
  "math",
  "science",
  "ela",
  "world_language",
  "life_skills",
  "social_emotional",
  "executive_function",
  "social_studies",
  // Sprint D — new brains added in Pair 2.
  "coding",
  "speech",
  "creative_arts",
  "stem_engineering",
];

describe("subject-brain-svc contract", () => {
  for (const subject of SUBJECTS_TO_CHECK) {
    it(`${subject}: brain is registered`, () => {
      expect(getSubjectBrain(subject)).toBeDefined();
    });

    it(`${subject}: /context response carries the canonical fields`, () => {
      const response = buildSubjectContext({
        learnerId: "test-learner",
        subject,
        topic: undefined,
        brainContext: {},
      });
      expect(response).toBeDefined();
      if (!response) return;
      expect(response.subject).toBe(subject);
      expect(Array.isArray(response.relevantSkills)).toBe(true);
      expect(Array.isArray(response.prerequisiteSkills)).toBe(true);
      expect(Array.isArray(response.masteryGaps)).toBe(true);
      expect(Array.isArray(response.misconceptionRisks)).toBe(true);
      expect(Array.isArray(response.recommendedSurfaces)).toBe(true);
      expect(Array.isArray(response.recommendedScaffolds)).toBe(true);
      expect(Array.isArray(response.standards)).toBe(true);
      expect(Array.isArray(response.profileAdaptations)).toBe(true);
    });

    it(`${subject}: /context returns at least one relevant skill when called without a topic`, () => {
      const response = buildSubjectContext({
        learnerId: "test-learner",
        subject,
        brainContext: {},
      });
      expect(response?.relevantSkills.length).toBeGreaterThan(0);
    });
  }
});
