/**
 * Sprint 2.1 — seed regression test.
 *
 * Asserts that the in-memory store seeded by `ensureSeeded()` exposes
 * every learner-visible subject (all 12 slugs from
 * `LEARNER_SUBJECTS`), and that the three newly added subjects
 * (social-studies, world-languages, coding) each carry at least one
 * grade-K placeholder skill so the learner subjects grid doesn't
 * crash when those cards are opened.
 *
 * Also pins the Sprint 2.3 K–8 expansion: Math, ELA (reading slug),
 * Science, Writing should each have ≥40 seeded skills spread across
 * grades K through 8.
 */
import { describe, expect, it, beforeEach } from "vitest";
import { LEARNER_SUBJECTS } from "@aivo/brand";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore, getStore } from "@/lib/db/store";

describe("web-v2 seed", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("seeds every slug from LEARNER_SUBJECTS", () => {
    const seededSlugs = new Set(Array.from(getStore().subjects.values()).map((s) => s.slug));
    for (const s of LEARNER_SUBJECTS) {
      expect(seededSlugs, `subject "${s.slug}" missing from store`).toContain(s.slug);
    }
    expect(seededSlugs.size).toBeGreaterThanOrEqual(12);
  });

  it("attaches at least one placeholder skill to each new (Sprint 2.1) subject", () => {
    const NEW_SUBJECTS = ["social-studies", "world-languages", "coding"];
    const subjects = Array.from(getStore().subjects.values());
    const skills = Array.from(getStore().skills.values());
    for (const slug of NEW_SUBJECTS) {
      const subject = subjects.find((s) => s.slug === slug);
      expect(subject, `subject "${slug}" not seeded`).toBeDefined();
      const subjectSkills = skills.filter((sk) => sk.subjectId === subject!.id);
      expect(subjectSkills.length, `subject "${slug}" has no skills`).toBeGreaterThan(0);
      const hasKindergarten = subjectSkills.some((sk) => /K(\b|-)/.test(sk.gradeBand));
      expect(hasKindergarten, `subject "${slug}" missing a K skill`).toBe(true);
    }
  });

  it("seeds ≥40 K–8 skills for each core subject (Sprint 2.3)", () => {
    const CORE_SUBJECTS = ["math", "reading", "science", "writing"];
    const subjects = Array.from(getStore().subjects.values());
    const skills = Array.from(getStore().skills.values());
    for (const slug of CORE_SUBJECTS) {
      const subject = subjects.find((s) => s.slug === slug);
      expect(subject).toBeDefined();
      const subjectSkills = skills.filter((sk) => sk.subjectId === subject!.id);
      expect(
        subjectSkills.length,
        `core subject "${slug}" should have ≥40 K-8 skills (had ${subjectSkills.length})`,
      ).toBeGreaterThanOrEqual(40);
    }
  });
});
