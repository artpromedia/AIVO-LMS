/**
 * Sprint 3 — baseline fallback bank tests.
 *
 * Locks in the contract assessment-svc relies on:
 *   - all 7 baseline subjects have ≥ 14 multiple-choice items
 *   - itemToBaselineQuestion rejects items without choices / matching
 *     correctAnswer rather than emitting malformed payloads
 *   - pickFallbackBaseline returns 42 items by default, deterministically
 *     ordered per (learnerId, subject), preferring the requested grade
 *     band when one is supplied
 *   - gradeBandFromSkillId recognises the K-12 patterns used across
 *     every seed bank
 */
import { describe, expect, it } from "vitest";
import {
  BASELINE_FALLBACK_BANK,
  BASELINE_FALLBACK_SUBJECTS,
  gradeBandFromSkillId,
  itemToBaselineQuestion,
  pickFallbackBaseline,
} from "../seed-baseline-fallback.js";
import { validateItemVariant } from "../validate.js";

describe("baseline fallback bank — coverage", () => {
  it("covers all 7 required baseline subjects", () => {
    expect(BASELINE_FALLBACK_SUBJECTS).toHaveLength(7);
    for (const subject of BASELINE_FALLBACK_SUBJECTS) {
      expect(BASELINE_FALLBACK_BANK[subject]).toBeDefined();
    }
  });

  it.each(BASELINE_FALLBACK_SUBJECTS)("%s has ≥ 14 fallback-usable items", (subject) => {
    const items = BASELINE_FALLBACK_BANK[subject];
    const usable = items.filter((it) => itemToBaselineQuestion(it, subject) !== null);
    expect(usable.length).toBeGreaterThanOrEqual(14);
  });

  it("every variant in every fallback bank validates", () => {
    for (const subject of BASELINE_FALLBACK_SUBJECTS) {
      for (const item of BASELINE_FALLBACK_BANK[subject]) {
        for (const variant of item.variants) {
          const issues = validateItemVariant(variant);
          expect(issues, `${item.id} validation failed`).toEqual([]);
        }
      }
    }
  });
});

describe("gradeBandFromSkillId", () => {
  it.each([
    ["ccss-math.K.CC.A.1", "K"],
    ["ccss-math.3.OA.A.1", "3"],
    ["ccss-math.8.EE.B.5", "8"],
    ["ccss-ela.K.RF.1", "K"],
    ["asha.speech.6.figurative-language.1", "6"],
    ["life-skills.4.money.1", "4"],
    ["executive-function.7.planning.1", "7"],
    ["casel.sel.K.self-awareness.1", "K"],
    ["no.grade.here", null],
    ["", null],
  ])("maps %s → %s", (skillId, expected) => {
    expect(gradeBandFromSkillId(skillId)).toBe(expected);
  });
});

describe("itemToBaselineQuestion", () => {
  it("maps a choice_grid item into the expected shape", () => {
    const item = BASELINE_FALLBACK_BANK.sel[0];
    const q = itemToBaselineQuestion(item, "sel");
    expect(q).not.toBeNull();
    expect(q!.subject).toBe("sel");
    expect(q!.questionText.length).toBeGreaterThan(0);
    expect(q!.options.length).toBeGreaterThanOrEqual(2);
    expect(q!.options.map((o) => o.value)).toEqual(
      Array.from({ length: q!.options.length }, (_, i) => ["a", "b", "c", "d", "e", "f"][i]),
    );
    expect(q!.options.find((o) => o.value === q!.correctAnswer)).toBeDefined();
    expect(q!.skillId).toBe(item.skillId);
  });

  it("returns null for free-response items with a non-numeric answer", () => {
    // Auto-distractor synthesis covers numeric/fraction answers; a
    // free-text answer ("triangle") cannot be auto-distractored and
    // must be rejected rather than served as a single-choice question.
    const bad = {
      id: "bad.no-choices.text",
      skillId: "test.K.x.1",
      variants: [
        {
          id: "bad.no-choices.text@1.0.0",
          itemId: "bad.no-choices.text",
          version: "1.0.0" as const,
          status: "active" as const,
          cohortWeight: 1,
          publishedAt: "2026-05-25T00:00:00Z",
          body: { stem: "What shape has 3 sides?", correctAnswer: "triangle" },
          defectCount: 0,
          surfaceType: "math_expression" as const,
        },
      ],
    };
    expect(itemToBaselineQuestion(bad, "math")).toBeNull();
  });

  it("auto-synthesises distractors for numeric free-response items", () => {
    const numeric = {
      id: "numeric.fallback.example",
      skillId: "test.K.x.1",
      variants: [
        {
          id: "numeric.fallback.example@1.0.0",
          itemId: "numeric.fallback.example",
          version: "1.0.0" as const,
          status: "active" as const,
          cohortWeight: 1,
          publishedAt: "2026-05-25T00:00:00Z",
          body: { stem: "8 + 5 = ?", correctAnswer: "13" },
          defectCount: 0,
          surfaceType: "math_expression" as const,
        },
      ],
    };
    const q = itemToBaselineQuestion(numeric, "math");
    expect(q).not.toBeNull();
    expect(q!.options.length).toBeGreaterThanOrEqual(2);
    expect(q!.options.find((o) => o.label === "13")).toBeDefined();
    expect(q!.options.find((o) => o.value === q!.correctAnswer)?.label).toBe("13");
  });

  it("returns null when correctAnswer is not among choices", () => {
    const bad = {
      id: "bad.mismatch",
      skillId: "test.K.x.1",
      variants: [
        {
          id: "bad.mismatch@1.0.0",
          itemId: "bad.mismatch",
          version: "1.0.0" as const,
          status: "active" as const,
          cohortWeight: 1,
          publishedAt: "2026-05-25T00:00:00Z",
          body: { stem: "Pick one", choices: ["A", "B"], correctAnswer: "Z" },
          defectCount: 0,
          surfaceType: "choice_grid" as const,
        },
      ],
    };
    expect(itemToBaselineQuestion(bad, "math")).toBeNull();
  });
});

describe("pickFallbackBaseline", () => {
  it("returns exactly 42 items by default (6 per subject × 7)", () => {
    const out = pickFallbackBaseline({ learnerId: "lr-1" });
    expect(out.questions).toHaveLength(42);
    expect(out.source).toBe("fallback");
    expect(out.subjects).toEqual(BASELINE_FALLBACK_SUBJECTS);
    // Every subject contributes the requested count.
    for (const subject of BASELINE_FALLBACK_SUBJECTS) {
      const inSubject = out.questions.filter((q) => q.subject === subject);
      expect(inSubject, `${subject} count`).toHaveLength(6);
    }
  });

  it("deterministic per (learnerId, subject)", () => {
    const a = pickFallbackBaseline({ learnerId: "lr-1" });
    const b = pickFallbackBaseline({ learnerId: "lr-1" });
    expect(a.questions.map((q) => q.id)).toEqual(b.questions.map((q) => q.id));
  });

  it("different learners receive different orderings", () => {
    const a = pickFallbackBaseline({ learnerId: "lr-1" });
    const b = pickFallbackBaseline({ learnerId: "lr-very-different" });
    // Same SET, different ORDER for at least some subjects.
    const aIds = a.questions.map((q) => q.id).join("|");
    const bIds = b.questions.map((q) => q.id).join("|");
    expect(aIds).not.toEqual(bIds);
  });

  it("prefers the requested grade band when one is supplied", () => {
    const out = pickFallbackBaseline({ learnerId: "lr-1", gradeBand: "3" });
    // For math, 3rd-grade items should appear when available.
    const math3 = out.questions.filter(
      (q) => q.subject === "math" && gradeBandFromSkillId(q.skillId) === "3",
    );
    expect(math3.length).toBeGreaterThan(0);
  });

  it("honours a custom countPerSubject", () => {
    const out = pickFallbackBaseline({ learnerId: "lr-2", countPerSubject: 3 });
    expect(out.questions).toHaveLength(21);
  });
});
