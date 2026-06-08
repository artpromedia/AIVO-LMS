/**
 * Calm Corner persistence — record, list, streak, and parent summary.
 *
 * Map-backed repo mirroring the Homework Helper convention. Streak logic
 * uses UTC calendar-day keys with an injectable `todayIso` so the table
 * of cases below is fully deterministic.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { resetStore } from "@/lib/db/store";
import {
  recordCalmSession,
  listCalmSessionsForLearner,
  getCalmStreak,
  summarizeCalmForParent,
} from "@/lib/db/repos";

const LEARNER = "learner_1";
const TENANT = "tenant_1";

/** Record a session whose `occurredAt` is pinned by mocking the clock. */
async function recordAt(
  occurredAt: string,
  opts: {
    learnerId?: string;
    tenantId?: string;
    activityId?: string;
    activityKind?: string;
    completed?: boolean;
    secondsSpent?: number | null;
  } = {},
) {
  vi.setSystemTime(new Date(occurredAt));
  return await recordCalmSession({
    tenantId: opts.tenantId ?? TENANT,
    learnerId: opts.learnerId ?? LEARNER,
    activityId: opts.activityId ?? "box_breathing",
    activityKind: opts.activityKind ?? "breathing",
    completed: opts.completed ?? true,
    secondsSpent: opts.secondsSpent ?? 60,
  });
}

describe("calm-sessions repo", () => {
  beforeEach(() => {
    resetStore();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe("recordCalmSession + listCalmSessionsForLearner", () => {
    it("persists a record and returns it most-recent-first", async () => {
      await recordAt("2026-01-01T10:00:00.000Z", { activityId: "stretch_break" });
      await recordAt("2026-01-02T10:00:00.000Z", { activityId: "box_breathing" });

      const list = await listCalmSessionsForLearner(LEARNER, TENANT);
      expect(list).toHaveLength(2);
      expect(list[0].activityId).toBe("box_breathing");
      expect(list[1].activityId).toBe("stretch_break");
      expect(list[0]).toMatchObject({
        learnerId: LEARNER,
        tenantId: TENANT,
        completed: true,
        secondsSpent: 60,
      });
    });

    it("is tenant- and learner-scoped on read", async () => {
      await recordAt("2026-01-01T10:00:00.000Z", { learnerId: LEARNER, tenantId: TENANT });
      await recordAt("2026-01-01T10:00:00.000Z", { learnerId: "other_learner", tenantId: TENANT });
      await recordAt("2026-01-01T10:00:00.000Z", { learnerId: LEARNER, tenantId: "other_tenant" });

      const list = await listCalmSessionsForLearner(LEARNER, TENANT);
      expect(list).toHaveLength(1);
      expect(list[0].learnerId).toBe(LEARNER);
      expect(list[0].tenantId).toBe(TENANT);
    });

    it("honours limit and sinceIso", async () => {
      await recordAt("2026-01-01T10:00:00.000Z");
      await recordAt("2026-01-02T10:00:00.000Z");
      await recordAt("2026-01-03T10:00:00.000Z");

      expect(await listCalmSessionsForLearner(LEARNER, TENANT, { limit: 2 })).toHaveLength(2);
      expect(
        await listCalmSessionsForLearner(LEARNER, TENANT, { sinceIso: "2026-01-02T00:00:00.000Z" }),
      ).toHaveLength(2);
    });
  });

  describe("getCalmStreak", () => {
    const today = "2026-03-10T12:00:00.000Z";

    it("empty history → 0", async () => {
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today }))).toEqual({
        currentStreakDays: 0,
        lastSessionAt: null,
      });
    });

    it("a single completed session today → 1", async () => {
      await recordAt("2026-03-10T08:00:00.000Z");
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today })).currentStreakDays).toBe(1);
    });

    it("counts a streak that ends yesterday → 1", async () => {
      await recordAt("2026-03-09T08:00:00.000Z");
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today })).currentStreakDays).toBe(1);
    });

    it("today + yesterday → 2", async () => {
      await recordAt("2026-03-09T08:00:00.000Z");
      await recordAt("2026-03-10T08:00:00.000Z");
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today })).currentStreakDays).toBe(2);
    });

    it("multiple sessions on one day count that day once", async () => {
      await recordAt("2026-03-10T07:00:00.000Z");
      await recordAt("2026-03-10T08:00:00.000Z");
      await recordAt("2026-03-09T08:00:00.000Z");
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today })).currentStreakDays).toBe(2);
    });

    it("a gap resets the streak", async () => {
      await recordAt("2026-03-10T08:00:00.000Z"); // today
      await recordAt("2026-03-09T08:00:00.000Z"); // yesterday
      await recordAt("2026-03-07T08:00:00.000Z"); // gap on the 8th
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today })).currentStreakDays).toBe(2);
    });

    it("incomplete-only days do not count", async () => {
      await recordAt("2026-03-10T08:00:00.000Z", { completed: false });
      await recordAt("2026-03-09T08:00:00.000Z", { completed: false });
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today }))).toEqual({
        currentStreakDays: 0,
        lastSessionAt: null,
      });
    });

    it("an incomplete day inside a run breaks the streak", async () => {
      await recordAt("2026-03-10T08:00:00.000Z", { completed: true }); // today
      await recordAt("2026-03-09T08:00:00.000Z", { completed: false }); // breaks here
      await recordAt("2026-03-08T08:00:00.000Z", { completed: true });
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today })).currentStreakDays).toBe(1);
    });

    it("a streak older than yesterday does not count", async () => {
      await recordAt("2026-03-07T08:00:00.000Z");
      await recordAt("2026-03-08T08:00:00.000Z");
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today })).currentStreakDays).toBe(0);
    });

    it("reports lastSessionAt for the most recent completed session", async () => {
      await recordAt("2026-03-09T08:00:00.000Z");
      const last = await recordAt("2026-03-10T08:00:00.000Z");
      expect((await getCalmStreak(LEARNER, TENANT, { todayIso: today })).lastSessionAt).toBe(
        last.occurredAt,
      );
    });
  });

  describe("summarizeCalmForParent", () => {
    it("returns counts + topActivityId and never leaks records", async () => {
      await recordAt("2026-01-01T10:00:00.000Z", { activityId: "box_breathing", completed: true });
      await recordAt("2026-01-02T10:00:00.000Z", { activityId: "box_breathing", completed: true });
      await recordAt("2026-01-03T10:00:00.000Z", { activityId: "stretch_break", completed: false });

      const summary = await summarizeCalmForParent(LEARNER, TENANT);
      expect(summary).toEqual({
        totalMoments: 3,
        completedMoments: 2,
        topActivityId: "box_breathing",
        lastSessionAt: "2026-01-03T10:00:00.000Z",
      });
      // Shape guard: counts only, no raw records / free-text leaked.
      expect(Object.keys(summary).sort()).toEqual([
        "completedMoments",
        "lastSessionAt",
        "topActivityId",
        "totalMoments",
      ]);
    });

    it("returns an empty rollup when there is no history", async () => {
      expect((await summarizeCalmForParent(LEARNER, TENANT))).toEqual({
        totalMoments: 0,
        completedMoments: 0,
        topActivityId: null,
        lastSessionAt: null,
      });
    });

    it("respects sinceIso", async () => {
      await recordAt("2026-01-01T10:00:00.000Z");
      await recordAt("2026-01-05T10:00:00.000Z");
      const summary = await summarizeCalmForParent(LEARNER, TENANT, {
        sinceIso: "2026-01-03T00:00:00.000Z",
      });
      expect(summary.totalMoments).toBe(1);
      expect(summary.lastSessionAt).toBe("2026-01-05T10:00:00.000Z");
    });

    it("is tenant- and learner-scoped", async () => {
      await recordAt("2026-01-01T10:00:00.000Z", { learnerId: "other_learner" });
      await recordAt("2026-01-01T10:00:00.000Z", { tenantId: "other_tenant" });
      expect((await summarizeCalmForParent(LEARNER, TENANT)).totalMoments).toBe(0);
    });
  });
});
