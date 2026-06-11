/**
 * Wave B — school-calendar/pacing BFF wire mapping.
 *
 * Verifies the camelCase→snake_case calendar body brain-svc consumes, and
 * the rebuild of the parser-shaped term_scope_sequence from SAVED
 * term-syllabus rows (units grouped by term, ordered, field names mapped) —
 * the seam that makes "generate pacing plan" pace exactly what the
 * parent/teacher reviewed and saved.
 */
import { describe, expect, it } from "vitest";
import {
  buildTermScopeSequence,
  calendarPayloadSchema,
  toBrainCalendarBody,
} from "@/lib/bff/school-calendar";
import type { TermSyllabus, TermSyllabusUnit } from "@/lib/db/types";

function unit(partial: Partial<TermSyllabusUnit>): TermSyllabusUnit {
  return {
    id: "u1",
    syllabusId: "ts1",
    termNumber: 1,
    orderIndex: 0,
    title: "Unit",
    durationWeeks: 1,
    topics: [],
    objectives: [],
    standards: [],
    vocabulary: [],
    validationStatus: "unvalidated",
    validationNotes: null as never,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...partial,
  };
}

function syllabus(units: TermSyllabusUnit[]): TermSyllabus {
  return {
    id: "ts1",
    tenantId: "t1",
    learnerId: "l1",
    uploadedBy: "p1",
    uploaderRole: "parent",
    subject: "math",
    title: "Math — Term 1",
    termCount: 2,
    sourceType: "text",
    fileName: null,
    rawText: null,
    status: "active" as never,
    notes: null,
    units,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("toBrainCalendarBody", () => {
  it("maps the BFF payload onto brain-svc snake_case", () => {
    const parsed = calendarPayloadSchema.parse({
      academicYear: "2026-2027",
      terms: [{ termNumber: 1, title: "Fall", startDate: "2026-09-01", endDate: "2026-12-18" }],
      breaks: [
        { kind: "summer", name: "Summer", startDate: "2027-06-12", endDate: "2027-08-31" },
      ],
    });
    const body = toBrainCalendarBody(parsed);
    expect(body).toEqual({
      name: null,
      academic_year: "2026-2027",
      timezone: "America/Chicago",
      terms: [
        { term_number: 1, title: "Fall", start_date: "2026-09-01", end_date: "2026-12-18" },
      ],
      breaks: [
        { kind: "summer", name: "Summer", start_date: "2027-06-12", end_date: "2027-08-31" },
      ],
    });
  });

  it("rejects malformed dates and unknown break kinds at the schema", () => {
    expect(
      calendarPayloadSchema.safeParse({
        terms: [{ termNumber: 1, startDate: "Sept 1", endDate: "2026-12-18" }],
        breaks: [],
      }).success,
    ).toBe(false);
    expect(
      calendarPayloadSchema.safeParse({
        terms: [{ termNumber: 1, startDate: "2026-09-01", endDate: "2026-12-18" }],
        breaks: [{ kind: "vacation", startDate: "2026-11-25", endDate: "2026-11-27" }],
      }).success,
    ).toBe(false);
  });
});

describe("buildTermScopeSequence", () => {
  it("groups saved units by term, orders them, and maps field names to the parser shape", () => {
    const scope = buildTermScopeSequence(
      syllabus([
        unit({
          id: "u2",
          termNumber: 2,
          orderIndex: 0,
          title: "Decimals",
          durationWeeks: 2,
          topics: ["tenths"],
          objectives: ["compare decimals"],
          standards: ["5.NBT.A.3"],
          vocabulary: ["tenth"],
        }),
        unit({
          id: "u1",
          termNumber: 1,
          orderIndex: 1,
          title: "Fractions II",
          durationWeeks: 1,
          objectives: ["add unlike denominators"],
        }),
        unit({
          id: "u0",
          termNumber: 1,
          orderIndex: 0,
          title: "Fractions I",
          durationWeeks: 1,
          objectives: ["recognise fractions"],
          standards: ["5.NF.A.1"],
        }),
      ]),
    ) as {
      subject: string;
      source: string;
      total_terms: number;
      terms: Array<{
        term_number: number;
        units: Array<{
          title: string;
          duration_weeks: number;
          learning_objectives: string[];
          standards_addressed: string[];
          key_vocabulary: string[];
        }>;
      }>;
    };

    expect(scope.subject).toBe("math");
    expect(scope.source).toBe("uploaded_term_syllabus");
    expect(scope.total_terms).toBe(2);
    expect(scope.terms.map((t) => t.term_number)).toEqual([1, 2]);
    // orderIndex within the term is preserved.
    expect(scope.terms[0]!.units.map((u) => u.title)).toEqual(["Fractions I", "Fractions II"]);
    // Field names are the ai-svc parse-term vocabulary brain-svc normalises.
    expect(scope.terms[0]!.units[0]).toEqual({
      title: "Fractions I",
      duration_weeks: 1,
      topics: [],
      learning_objectives: ["recognise fractions"],
      standards_addressed: ["5.NF.A.1"],
      key_vocabulary: [],
    });
    expect(scope.terms[1]!.units[0]!.duration_weeks).toBe(2);
  });

  it("floors duration_weeks at 1 so a zero-week row still paces", () => {
    const scope = buildTermScopeSequence(
      syllabus([unit({ durationWeeks: 0, objectives: ["x"] })]),
    ) as { terms: Array<{ units: Array<{ duration_weeks: number }> }> };
    expect(scope.terms[0]!.units[0]!.duration_weeks).toBe(1);
  });
});
