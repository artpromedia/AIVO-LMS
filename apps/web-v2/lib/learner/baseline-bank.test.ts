import { describe, it, expect } from "vitest";
import {
  selectBaselineFromBank,
  bankHasItems,
  type BaselineBankItem,
} from "./baseline-bank";
import type { Subject, Skill } from "@/lib/db/types";

function subjectAndSkill(slug: string): { subject: Subject; skill: Skill } {
  return {
    subject: { id: `sub_${slug}`, slug, name: slug, description: "", iconKey: "x" },
    skill: {
      id: `sk_${slug}`,
      subjectId: `sub_${slug}`,
      slug: `${slug}-anchor`,
      name: `${slug} anchor`,
      gradeBand: "6-8",
      prerequisites: [],
    },
  };
}

function buildScope(slugs: string[]): { subjects: Subject[]; skills: Skill[] } {
  const subjects: Subject[] = [];
  const skills: Skill[] = [];
  for (const s of slugs) {
    const { subject, skill } = subjectAndSkill(s);
    subjects.push(subject);
    skills.push(skill);
  }
  return { subjects, skills };
}

const DEFAULT_SLUGS = [
  "math",
  "reading",
  "science",
  "social",
  "speech",
  "executive-function",
];

describe("selectBaselineFromBank — committed seed bank", () => {
  it("has seed items", () => {
    expect(bankHasItems()).toBe(true);
  });

  it("covers every default subject for a 6-8 STANDARD learner", () => {
    const { subjects, skills } = buildScope(DEFAULT_SLUGS);
    const qs = selectBaselineFromBank({
      baselineId: "bas_test_1",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: ["read_aloud"],
    });
    expect(qs.length).toBeGreaterThan(0);
    const covered = new Set(qs.map((q) => q.subjectId));
    expect(covered.size).toBe(subjects.length);
  });

  it("every question's expectedAnswer is one of its choices", () => {
    const { subjects, skills } = buildScope(DEFAULT_SLUGS);
    const qs = selectBaselineFromBank({
      baselineId: "bas_test_choices",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: [],
    });
    for (const q of qs) {
      expect(q.choices).toBeDefined();
      expect(q.choices).toContain(q.expectedAnswer);
    }
  });

  it("propagates accommodation tags onto every question", () => {
    const { subjects, skills } = buildScope(["math"]);
    const qs = selectBaselineFromBank({
      baselineId: "bas_test_acc",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: ["large_text", "extended_time"],
    });
    expect(qs.length).toBeGreaterThan(0);
    for (const q of qs) expect(q.accommodationTags).toEqual(["large_text", "extended_time"]);
  });

  it("is deterministic for the same baselineId (seeded PRNG)", () => {
    const { subjects, skills } = buildScope(DEFAULT_SLUGS);
    const args = {
      baselineId: "bas_stable",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: [] as string[],
    };
    const a = selectBaselineFromBank(args).map((q) => q.prompt);
    const b = selectBaselineFromBank(args).map((q) => q.prompt);
    expect(a).toEqual(b);
  });

  it("fills a sparse grade band (3-5) from neighbouring cells rather than failing", () => {
    // The seed has no speech/executive_function items at 3-5; the distance
    // fallback should borrow them from adjacent bands so coverage holds.
    const { subjects, skills } = buildScope(DEFAULT_SLUGS);
    const qs = selectBaselineFromBank({
      baselineId: "bas_3_5",
      gradeBand: "3-5",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: [],
    });
    const covered = new Set(qs.map((q) => q.subjectId));
    expect(covered.size).toBe(subjects.length);
  });

  it("returns nothing when no requested subject maps to the bank (fail-open)", () => {
    const { subjects, skills } = buildScope(["music", "geography"]);
    const qs = selectBaselineFromBank({
      baselineId: "bas_unmapped",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: [],
    });
    expect(qs).toEqual([]);
  });

  it("normalizes an unknown functioning level to STANDARD without throwing", () => {
    const { subjects, skills } = buildScope(["math"]);
    const qs = selectBaselineFromBank({
      baselineId: "bas_unknown_level",
      gradeBand: "6-8",
      functioningLevel: "WHO_KNOWS",
      subjects,
      skills,
      accommodationTags: [],
    });
    expect(qs.length).toBeGreaterThan(0);
  });
});

describe("selectBaselineFromBank — synthetic bank (spread, dynamic, caps)", () => {
  function mathItem(
    difficulty: BaselineBankItem["difficulty"],
    prompt: string,
  ): BaselineBankItem {
    return {
      subject: "math",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      difficulty,
      prompt,
      choices: ["a", "b"],
      expectedAnswer: "a",
    };
  }

  const bankItems: BaselineBankItem[] = [
    mathItem("foundational", "f1"),
    mathItem("foundational", "f2"),
    mathItem("approaching", "a1"),
    mathItem("approaching", "a2"),
    mathItem("grade_level", "g1"),
    mathItem("stretch", "s1"),
  ];

  it("spreads across difficulty bands (easy → hard)", () => {
    const { subjects, skills } = buildScope(["math"]);
    const qs = selectBaselineFromBank({
      baselineId: "bas_spread",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: [],
      perSubject: 4,
      bankItems,
      rng: () => 0.999,
    });
    expect(qs).toHaveLength(4);
    // First four picks are one-per-band in difficulty order.
    expect(qs.map((q) => q.difficulty)).toEqual([
      "foundational",
      "approaching",
      "grade_level",
      "stretch",
    ]);
  });

  it("respects the perSubject cap", () => {
    const { subjects, skills } = buildScope(["math"]);
    const qs = selectBaselineFromBank({
      baselineId: "bas_cap",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: [],
      perSubject: 2,
      bankItems,
    });
    expect(qs).toHaveLength(2);
  });

  it("is dynamic: different RNGs vary the within-band pick", () => {
    const { subjects, skills } = buildScope(["math"]);
    const base = {
      baselineId: "bas_dyn",
      gradeBand: "6-8",
      functioningLevel: "STANDARD",
      subjects,
      skills,
      accommodationTags: [] as string[],
      perSubject: 1,
      bankItems,
    };
    const pickA = selectBaselineFromBank({ ...base, rng: () => 0 })[0]?.prompt;
    const pickB = selectBaselineFromBank({ ...base, rng: () => 0.999 })[0]?.prompt;
    // Both come from the foundational band (f1/f2) but the shuffle differs.
    expect(pickA).not.toEqual(pickB);
  });
});
