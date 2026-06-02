import { describe, expect, it } from "vitest";
import { LEARNER_SUBJECTS, TUTORS } from "@aivo/brand";
import { tutorNameForSubject } from "./lesson-plan";
import { tutorForSubjectSlug } from "./baseline-tutors";

/**
 * Sprint 2 (subject/tutor UX): the web lesson flow must surface the real brand
 * tutor catalog (Sage, Nova, Spark, …), never the old hardcoded fictional
 * personas (Nimbus, Zara, Penn, …).
 */
const BRAND_TUTOR_NAMES = new Set(Object.values(TUTORS).map((t) => t.name));
const RETIRED_PERSONAS = ["Nimbus", "Zara", "Penn", "Dr. Sprout", "Lumi", "Hue"];

describe("lesson tutor identity", () => {
  it("resolves every subject's lesson persona to a real brand tutor name", () => {
    for (const s of LEARNER_SUBJECTS) {
      const name = tutorNameForSubject(s.slug);
      expect(
        BRAND_TUTOR_NAMES.has(name),
        `subject "${s.slug}" persona "${name}" is not a brand tutor`,
      ).toBe(true);
    }
  });

  it("matches the subject's declared tutorKey", () => {
    for (const s of LEARNER_SUBJECTS) {
      expect(tutorNameForSubject(s.slug)).toBe(TUTORS[s.tutorKey].name);
    }
  });

  it("never returns a retired fictional persona", () => {
    for (const s of LEARNER_SUBJECTS) {
      const name = tutorNameForSubject(s.slug);
      for (const retired of RETIRED_PERSONAS) {
        expect(name.includes(retired)).toBe(false);
      }
    }
  });

  it("falls back to a real tutor for an unknown subject slug", () => {
    expect(BRAND_TUTOR_NAMES.has(tutorNameForSubject("not-a-real-subject"))).toBe(true);
  });
});

describe("tutorForSubjectSlug", () => {
  it("returns a brand-backed tutor for every catalog subject", () => {
    for (const s of LEARNER_SUBJECTS) {
      const tutor = tutorForSubjectSlug(s.slug);
      expect(tutor, `no tutor for subject "${s.slug}"`).not.toBeNull();
      expect(BRAND_TUTOR_NAMES.has(tutor!.name)).toBe(true);
      // color + emoji come from the brand catalog, so they are populated for
      // non-baseline subjects too (used by the subjects grid eyebrow/accent).
      expect(tutor!.color).toBe(TUTORS[s.tutorKey].color);
      expect(tutor!.emoji).toBe(TUTORS[s.tutorKey].icon);
    }
  });
});
