/**
 * Lesson completion must move skill mastery THROUGH the persistence adapter —
 * memory == postgres (adaptive-learning E2E Sprint 1).
 *
 * Before this sprint, `applyOutcomeToMastery` wrote to the in-memory Map
 * store, so in postgres mode (production) every per-lesson mastery update —
 * and the baseline-derived rows the parent dashboard reads — evaporated.
 * This suite drives the real `completeLessonRun` flow against both backends
 * and asserts the mastery row lands where `getMasteryMap` reads it.
 */
import { it, expect } from "vitest";
import type { LessonOutcome, LessonRun } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { completeLessonRun, getMasteryMap } from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky";

function readyRun(id: string): LessonRun {
  const now = new Date().toISOString();
  return {
    id,
    tenantId: T,
    learnerId: L,
    subjectId: "sub-mastery-parity",
    skillId: "skl-mastery-parity",
    source: "today_mission",
    sourceRefId: null,
    tutorPersona: "Nimbus",
    learnerContextSnapshot: {} as never,
    masterySnapshot: { score: 0.4, level: "emerging" } as never,
    accommodationSnapshot: {
      tags: [],
      supportDefaults: {
        extendedTime: false,
        readAloud: false,
        speechToText: false,
        visualSchedules: false,
        sensoryBreaks: false,
      },
      accessibility: {},
    } as never,
    brainStateSnapshot: {} as never,
    lessonPlanId: null,
    status: "ready",
    retryCount: 0,
    failureReason: null,
    startedAt: now,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  } as unknown as LessonRun;
}

const strongOutcome: LessonOutcome = {
  checksTotal: 4,
  checksCorrect: 4,
  hintsUsed: 0,
  scaffoldsUsed: 0,
  secondsActive: 300,
  abandoned: false,
};

runInBothModes("mastery via lesson completion", () => {
  it("completeLessonRun persists the mastery delta where getMasteryMap reads", async () => {
    await getPersistence().lessonRuns.upsertRun(readyRun("lr-mastery-parity-1"));

    const completed = await completeLessonRun("lr-mastery-parity-1", T, strongOutcome);
    expect(completed?.status).toBe("completed");

    const { skillMasteries } = await getMasteryMap(L, T);
    const row = skillMasteries.find((m) => m.skillId === "skl-mastery-parity");
    expect(row).toBeDefined();
    // EWMA: 0.4 + (1.0 - 0.4) * 0.25 = 0.55
    expect(row!.score).toBeCloseTo(0.55, 5);
    expect(row!.needsReview).toBe(false);
  });

  it("a second lesson keeps moving the SAME row (no duplicates)", async () => {
    await getPersistence().lessonRuns.upsertRun(readyRun("lr-mastery-parity-2"));
    await completeLessonRun("lr-mastery-parity-2", T, strongOutcome);
    await getPersistence().lessonRuns.upsertRun(readyRun("lr-mastery-parity-3"));
    await completeLessonRun("lr-mastery-parity-3", T, strongOutcome);

    const { skillMasteries } = await getMasteryMap(L, T);
    const rows = skillMasteries.filter((m) => m.skillId === "skl-mastery-parity");
    expect(rows).toHaveLength(1);
    // 0.55 after run 2, then 0.55 + (1.0 - 0.55) * 0.25 = 0.6625 after run 3.
    expect(rows[0]!.score).toBeCloseTo(0.6625, 5);
  });

  it("an abandoned run decays the score and flags review", async () => {
    await getPersistence().lessonRuns.upsertRun(readyRun("lr-mastery-parity-4"));
    await completeLessonRun("lr-mastery-parity-4", T, strongOutcome); // -> 0.55
    await getPersistence().lessonRuns.upsertRun(readyRun("lr-mastery-parity-5"));
    await completeLessonRun("lr-mastery-parity-5", T, {
      ...strongOutcome,
      checksTotal: 0,
      checksCorrect: 0,
      abandoned: true,
    });

    const { skillMasteries } = await getMasteryMap(L, T);
    const row = skillMasteries.find((m) => m.skillId === "skl-mastery-parity");
    // Decay toward min(0.55, 0.5): 0.55 + (0.5 - 0.55) * 0.25 = 0.5375
    expect(row!.score).toBeCloseTo(0.5375, 5);
    expect(row!.needsReview).toBe(true);
  });
});
