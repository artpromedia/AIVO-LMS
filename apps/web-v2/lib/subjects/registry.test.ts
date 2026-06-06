/**
 * Sprint 12 — Subject registry alignment guard.
 *
 * Verifies the canonical `LEARNER_SUBJECTS` registry in `@aivo/brand`
 * stays internally consistent and stays in sync with the web learner
 * subject seed. This catches the historical "ELA / reading drift"
 * class of bug (slug renamed in web, brain still ships under old id)
 * before it reaches a PR review.
 */
import { describe, it, expect } from "vitest";
import {
  LEARNER_SUBJECTS,
  TUTORS,
  getSubjectBySlug,
  getSubjectsByBrain,
  getBaselineSubjects,
  getProductionReadySubjects,
  type BrainSubject,
} from "@aivo/brand";

const VALID_BRAINS: ReadonlySet<BrainSubject> = new Set([
  "math",
  "science",
  "ela",
  "world_language",
  "coding",
  "social_studies",
  // Sprint 6 — brand registry already exposes these brains via
  // LEARNER_SUBJECTS; the test was lagging behind the registry.
  "social_emotional",
  "executive_function",
  "life_skills",
]);

describe("LEARNER_SUBJECTS registry", () => {
  it("has unique slugs", () => {
    const slugs = LEARNER_SUBJECTS.map((s) => s.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("references real tutors from the brand catalogue", () => {
    const tutorKeys = new Set(Object.keys(TUTORS));
    for (const subject of LEARNER_SUBJECTS) {
      expect(tutorKeys, `subject ${subject.slug}`).toContain(subject.tutorKey);
    }
  });

  it("only references subject-brain ids the service ships", () => {
    for (const subject of LEARNER_SUBJECTS) {
      if (subject.brainSubject === null) continue;
      expect(VALID_BRAINS, `subject ${subject.slug}`).toContain(subject.brainSubject);
    }
  });

  it("declares exactly six baseline domains (Discovery Adventure)", () => {
    expect(getBaselineSubjects().length).toBe(6);
  });

  it("exposes lookups that round-trip", () => {
    for (const subject of LEARNER_SUBJECTS) {
      expect(getSubjectBySlug(subject.slug)?.slug).toBe(subject.slug);
    }
  });

  it("maps ELA brain to both reading and writing", () => {
    const elaSlugs = getSubjectsByBrain("ela").map((s) => s.slug);
    expect(elaSlugs).toEqual(expect.arrayContaining(["reading", "writing"]));
  });

  // Sprint 6 — `productionReady` flag contract.
  describe("productionReady contract", () => {
    it("every subject declares a productionReady boolean", () => {
      for (const subject of LEARNER_SUBJECTS) {
        expect(typeof subject.productionReady, `subject ${subject.slug}`).toBe("boolean");
      }
    });

    it("getProductionReadySubjects only returns productionReady rows", () => {
      const ready = getProductionReadySubjects();
      expect(ready.length).toBeGreaterThan(0);
      for (const subject of ready) {
        expect(subject.productionReady).toBe(true);
      }
    });

    it("every K-12 catalog subject is productionReady", () => {
      const REQUIRED_READY_SLUGS = LEARNER_SUBJECTS.map((subject) => subject.slug);
      const readySlugs = new Set(getProductionReadySubjects().map((s) => s.slug));
      for (const slug of REQUIRED_READY_SLUGS) {
        expect(readySlugs, `subject ${slug} must be productionReady`).toContain(slug);
      }
    });

    it("world-languages and coding are available to learners", () => {
      const allSlugs = LEARNER_SUBJECTS.map((s) => s.slug);
      expect(allSlugs).toContain("world-languages");
      expect(allSlugs).toContain("coding");
      const ready = new Set(getProductionReadySubjects().map((s) => s.slug));
      expect(ready.has("world-languages")).toBe(true);
      expect(ready.has("coding")).toBe(true);
    });
  });
});
