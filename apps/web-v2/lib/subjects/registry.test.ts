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
  type BrainSubject,
} from "@aivo/brand";

const VALID_BRAINS: ReadonlySet<BrainSubject> = new Set([
  "math",
  "science",
  "ela",
  "world_language",
  "coding",
  "social_studies",
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
});
