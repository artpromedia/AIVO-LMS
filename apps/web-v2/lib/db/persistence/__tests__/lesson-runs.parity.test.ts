/**
 * lessonRuns — memory == postgres parity (Sprint 1).
 * Upsert + tenant-scoped fetch + listForLearner + countForLearner.
 */
import { it, expect } from "vitest";
import type { LessonRun } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
// A fresh learner with no seeded lesson runs, so counts are deterministic
// and identical across backends.
const L = "lrn-lessonrun-parity";

function run(id: string): LessonRun {
  const now = new Date().toISOString();
  return {
    id,
    tenantId: T,
    learnerId: L,
    subjectId: `sub-${id}`,
    skillId: `skl-${id}`,
    source: "today_mission",
    sourceRefId: null,
    tutorPersona: "Nimbus",
    learnerContextSnapshot: {} as never,
    masterySnapshot: {} as never,
    accommodationSnapshot: {} as never,
    brainStateSnapshot: {} as never,
    lessonPlanId: null,
    status: "ready",
    retryCount: 0,
    failureReason: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as LessonRun;
}

runInBothModes("lessonRuns", () => {
  it("upsert + getRunById is tenant-scoped", async () => {
    const s = getPersistence().lessonRuns;
    await s.upsertRun(run("lr-parity-1"));
    expect((await s.getRunById("lr-parity-1", T))?.id).toBe("lr-parity-1");
    expect(await s.getRunById("lr-parity-1", "t_other")).toBeNull();
  });

  it("listForLearner + countForLearner reflect inserts", async () => {
    const s = getPersistence().lessonRuns;
    expect(await s.countForLearner(L, T)).toBe(0);
    await s.upsertRun(run("lr-parity-2"));
    await s.upsertRun(run("lr-parity-3"));
    const listed = await s.listForLearner(L, T);
    expect(listed.some((r) => r.id === "lr-parity-2")).toBe(true);
    expect(listed.some((r) => r.id === "lr-parity-3")).toBe(true);
    expect(await s.countForLearner(L, T)).toBe(2);
  });
});
