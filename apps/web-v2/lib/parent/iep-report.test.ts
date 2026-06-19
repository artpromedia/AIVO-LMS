/**
 * Unit tests for the IEP report PDF layout (`renderIepReportPdf`).
 *
 * Asserts the pure renderer turns report data into a valid PDF that contains
 * the expected (ASCII-folded) report copy, and that empty data degrades to
 * honest "nothing yet" lines rather than blanks.
 */
import { describe, it, expect } from "vitest";
import { renderIepReportPdf, type IepReportData } from "./iep-report";

const FULL: IepReportData = {
  learnerName: "José Ñoño",
  gradeLabel: "Grade 3",
  generatedAtLabel: "Jun 19, 2026",
  overallMasteryPct: 71,
  overallMasteryDeltaPct: 6,
  completedCount: 18,
  completedDeltaPct: 4,
  iepSupportsCount: 4,
  iepActive: true,
  subjectProgress: [
    { subjectId: "s1", subject: "Reading", pct: 80 },
    { subjectId: "s2", subject: "Mathematics", pct: 65 },
  ],
  accommodations: ["Extended time on assessments", "Frequent movement breaks"],
  recentLessons: [{ subject: "Mathematics", dateLabel: "Jun 10, 2026" }],
};

const EMPTY: IepReportData = {
  learnerName: "Sky",
  gradeLabel: null,
  generatedAtLabel: "Jun 19, 2026",
  overallMasteryPct: 0,
  overallMasteryDeltaPct: null,
  completedCount: 0,
  completedDeltaPct: null,
  iepSupportsCount: 0,
  iepActive: false,
  subjectProgress: [],
  accommodations: [],
  recentLessons: [],
};

describe("renderIepReportPdf", () => {
  it("produces a valid PDF containing the report copy (ASCII-folded)", () => {
    const s = renderIepReportPdf(FULL).toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.endsWith("%%EOF")).toBe(true);
    expect(s).toContain("(IEP Progress Report) Tj");
    expect(s).toContain("Jose Nono"); // transliterated name in the subtitle
    expect(s).toContain("Overall mastery: 71%");
    expect(s).toContain("Lessons completed: 18");
    expect(s).toContain("IEP supports: 4 active");
    expect(s).toContain("(Reading) Tj");
    expect(s).toContain("Extended time on assessments");
    // A mastery bar draws two rectangles (track + fill).
    expect((s.match(/ re\nf/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it("renders honest empty-state lines when there is no data yet", () => {
    const s = renderIepReportPdf(EMPTY).toString("latin1");
    expect(s).toContain("No subject mastery recorded yet.");
    expect(s).toContain("No supports on file yet.");
    expect(s).toContain("No completed lessons yet.");
    expect(s).toContain("IEP supports: none on file");
  });
});
