import { describe, expect, it } from "vitest";
import { buildParentExport } from "../services/export-builder.js";

const SAMPLE = {
  learnerId: "l1",
  learnerProfileSummary: { name: "Alex", grade: "3", iepText: "raw IEP content" },
  brainProfileSummary: { masteryLevels: { math: 0.7 }, parentPrivateNotes: "secret" },
  approvedAccommodations: ["extended_time"],
  recommendationHistory: [{ id: "rec1", type: "accommodation_add", status: "APPROVED" }],
  baselineSummaries: [{ id: "b1", summary: "Baseline A" }],
  lessonProgressSummaries: [{ id: "ls1", subject: "math", mastery: 0.7 }],
  homeworkSummaries: [{ id: "h1", status: "completed" }],
  problemSessionSummaries: [{ id: "ps1", subject: "math", attempts: 3, successRate: 0.67 }],
  parentDecisions: [{ at: "2026-05-01T00:00:00Z", action: "approve" }],
  teacherObservationsVisibleToParent: [{ id: "o1", summary: "Strong with diagrams." }],
  auditSummary: { profile_recommendation_approved: 1 },
};

describe("buildParentExport", () => {
  it("produces JSON, Markdown, and CSV artifacts", () => {
    const job = buildParentExport(SAMPLE);
    const formats = job.artifacts.map((a) => a.format).sort();
    expect(formats).toEqual(["csv_summary", "json", "markdown"]);
  });

  it("strips raw IEP text and parent private notes from artifacts", () => {
    const job = buildParentExport(SAMPLE);
    for (const artifact of job.artifacts) {
      expect(artifact.contents.toLowerCase()).not.toContain("raw iep content");
      expect(artifact.contents.toLowerCase()).not.toContain("secret");
    }
  });

  it("includes approved accommodations and audit summary", () => {
    const job = buildParentExport(SAMPLE);
    const json = job.artifacts.find((a) => a.format === "json")!.contents;
    const parsed = JSON.parse(json);
    expect(parsed.approvedAccommodations).toContain("extended_time");
    expect(parsed.auditSummary.profile_recommendation_approved).toBe(1);
  });
});
