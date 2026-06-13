/**
 * assessments — memory == postgres parity (Sprint 1).
 * Parent assessment upsert/find, baseline "most-recent-active", question
 * ordering, and the latest-attempt-wins semantic baked into the store.
 */
import { it, expect } from "vitest";
import type {
  BaselineAssessment,
  BaselineAttempt,
  BaselineQuestion,
  ParentAssessment,
  TeacherAssessmentDraft,
} from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
// A fresh learner with no seeded baselines/assessments, so "most-recent
// active" and round-trip assertions are deterministic across backends.
const L = "lrn-assess-parity";

runInBothModes("assessments", () => {
  it("parent assessment upsert + find round-trips", async () => {
    const a = getPersistence().assessments;
    const pa = {
      id: "pa-parity-1",
      learnerId: L,
      tenantId: T,
      completedSections: [],
      submittedAt: null,
    } as unknown as ParentAssessment;
    await a.upsertParentAssessment(pa);
    expect((await a.findParentAssessment(L, T))?.id).toBe("pa-parity-1");
  });

  it("teacher assessment draft upsert + find round-trips, scoped per teacher", async () => {
    const a = getPersistence().assessments;
    const draft = {
      id: "tad-parity-1",
      learnerId: L,
      tenantId: T,
      submittedByUserId: "tch-parity",
      answers: { context: { teacherRole: "special_ed", gradeLevel: "3-5" } },
      completedSections: ["context"],
      startedAtMs: 1_700_000_000_000,
      startedAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      submittedAt: null,
    } as TeacherAssessmentDraft;
    await a.upsertTeacherAssessmentDraft(draft);
    const got = await a.findTeacherAssessmentDraft(L, T, "tch-parity");
    expect(got?.id).toBe("tad-parity-1");
    expect(got?.completedSections).toEqual(["context"]);
    // A different teacher on the same learner sees no draft.
    expect(await a.findTeacherAssessmentDraft(L, T, "other-tch")).toBeNull();
  });

  it("getActiveBaseline returns the most recent, scoped by tenant", async () => {
    const a = getPersistence().assessments;
    const b = (id: string, createdAt: string) =>
      ({ id, learnerId: L, tenantId: T, createdAt }) as unknown as BaselineAssessment;
    await a.upsertBaseline(b("bp1", "2026-01-01"));
    await a.upsertBaseline(b("bp2", "2026-01-03"));
    expect((await a.getBaselineById("bp1", T))?.id).toBe("bp1");
    expect(await a.getBaselineById("bp1", "other")).toBeNull();
    expect((await a.getActiveBaselineForLearner(L, T))?.id).toBe("bp2");
  });

  it("sorts questions by order and keeps the latest attempt per (question, learner)", async () => {
    const a = getPersistence().assessments;
    await a.upsertBaseline({
      id: "bp_q",
      learnerId: L,
      tenantId: T,
      createdAt: "2026-02-01",
    } as unknown as BaselineAssessment);
    const q = (id: string, order: number) =>
      ({ id, baselineId: "bp_q", order }) as unknown as BaselineQuestion;
    await a.appendBaselineQuestions([q("q2", 2), q("q1", 1)]);
    expect((await a.listBaselineQuestions("bp_q")).map((x) => x.id)).toEqual(["q1", "q2"]);

    const attempt = (id: string) =>
      ({
        id,
        baselineId: "bp_q",
        tenantId: T,
        questionId: "q1",
        learnerId: L,
      }) as unknown as BaselineAttempt;
    await a.recordBaselineAttempt(attempt("att1"), { questionId: "q1", learnerId: L });
    await a.recordBaselineAttempt(attempt("att2"), { questionId: "q1", learnerId: L });
    const attempts = await a.listBaselineAttempts("bp_q", T);
    expect(attempts.map((x) => x.id)).toEqual(["att2"]);
  });
});
