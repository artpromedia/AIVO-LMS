/**
 * Sprint 6 (whole-term syllabus): pure helpers that turn an ai-svc
 * parse-term result into persistable units + a preview summary, and
 * validate it. No network.
 */
import { describe, it, expect } from "vitest";
import {
  flattenToUnits,
  summarizeTerm,
  validateTermParse,
  type TermParseResult,
} from "@/lib/learner/term-syllabus";

function buildResult(weeks: number): TermParseResult {
  const units = Array.from({ length: weeks }, (_, i) => ({
    title: `Week ${i + 1}`,
    duration_weeks: 1,
    topics: [`topic ${i + 1}`],
    learning_objectives: [`students will do ${i + 1}`],
    standards_addressed: [`3.NBT.A.${i + 1}`],
    key_vocabulary: ["digit"],
  }));
  return {
    subject: "math",
    source: "uploaded_term_syllabus",
    total_terms: 1,
    unit_count: weeks,
    terms: [{ term_number: 1, title: "Term 1", units }],
  };
}

describe("flattenToUnits", () => {
  it("flattens a 12-week term into 12 ordered units", () => {
    const units = flattenToUnits(buildResult(12));
    expect(units).toHaveLength(12);
    expect(units.map((u) => u.orderIndex)).toEqual([...Array(12).keys()]);
    expect(units[0].objectives).toEqual(["students will do 1"]);
    expect(units[0].standards).toEqual(["3.NBT.A.1"]);
    expect(units[0].termNumber).toBe(1);
  });

  it("clamps duration_weeks to at least 1", () => {
    const r = buildResult(1);
    r.terms[0].units[0].duration_weeks = 0;
    expect(flattenToUnits(r)[0].durationWeeks).toBe(1);
  });

  it("preserves order across multiple terms", () => {
    const r = buildResult(2);
    r.terms.push({
      term_number: 2,
      title: "Term 2",
      units: [
        {
          title: "T2 Week 1",
          duration_weeks: 2,
          topics: [],
          learning_objectives: [],
          standards_addressed: [],
          key_vocabulary: [],
        },
      ],
    });
    const units = flattenToUnits(r);
    expect(units).toHaveLength(3);
    expect(units[2].termNumber).toBe(2);
    expect(units[2].orderIndex).toBe(2);
    expect(units[2].durationWeeks).toBe(2);
  });
});

describe("summarizeTerm", () => {
  it("counts units, weeks and distinct standards", () => {
    const s = summarizeTerm(buildResult(12));
    expect(s.unitCount).toBe(12);
    expect(s.totalWeeks).toBe(12);
    expect(s.termCount).toBe(1);
    expect(s.standardsCount).toBe(12);
  });
});

describe("validateTermParse", () => {
  it("rejects an empty parse", () => {
    const empty: TermParseResult = {
      subject: "math",
      source: "uploaded_term_syllabus",
      total_terms: 0,
      unit_count: 0,
      terms: [],
    };
    expect(validateTermParse(empty)).toContain("The document produced no week/unit content.");
    expect(validateTermParse(null)).toHaveLength(1);
  });

  it("accepts a real 12-week parse", () => {
    expect(validateTermParse(buildResult(12))).toHaveLength(0);
  });
});
