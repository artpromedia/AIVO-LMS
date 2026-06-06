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
function recordAt(
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
  return recordCalmSession({
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
    it("persists a record and returns it most-recent-first", () => {
      recordAt("2026-01-01T10:00:00.000Z", { activityId: "stretch_break" });
      recordAt("2026-01-02T10:00:00.000Z", { activityId: "box_breathing" });

      const list = listCalmSessionsForLearner(LEARNER, TENANT);
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

    it("is tenant- and learner-scoped on read", () => {
      recordAt("2026-01-01T10:00:00.000Z", { learnerId: LEARNER, tenantId: TENANT });
      recordAt("2026-01-01T10:00:00.000Z", { learnerId: "other_learner", tenantId: TENANT });
      recordAt("2026-01-01T10:00:00.000Z", { learnerId: LEARNER, tenantId: "other_tenant" });

      const list = listCalmSessionsForLearner(LEARNER, TENANT);
      expect(list).toHaveLength(1);
      expect(list[0].learnerId).toBe(LEARNER);
      expect(list[0].tenantId).toBe(TENANT);
    });

    it("honours limit and sinceIso", () => {
      recordAt("2026-01-01T10:00:00.000Z");
      recordAt("2026-01-02T10:00:00.000Z");
      recordAt("2026-01-03T10:00:00.000Z");

      expect(listCalmSessionsForLearner(LEARNER, TENANT, { limit: 2 })).toHaveLength(2);
      expect(
        listCalmSessionsForLearner(LEARNER, TENANT, { sinceIso: "2026-01-02T00:00:00.000Z" }),
      ).toHaveLength(2);
    });
  });

  describe("getCalmStreak", () => {
    const today = "2026-03-10T12:00:00.000Z";

    it("empty history → 0", () => {
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today })).toEqual({
        currentStreakDays: 0,
        lastSessionAt: null,
      });
    });

    it("a single completed session today → 1", () => {
      recordAt("2026-03-10T08:00:00.000Z");
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today }).currentStreakDays).toBe(1);
    });

    it("counts a streak that ends yesterday → 1", () => {
      recordAt("2026-03-09T08:00:00.000Z");
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today }).currentStreakDays).toBe(1);
    });

    it("today + yesterday → 2", () => {
      recordAt("2026-03-09T08:00:00.000Z");
      recordAt("2026-03-10T08:00:00.000Z");
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today }).currentStreakDays).toBe(2);
    });

    it("multiple sessions on one day count that day once", () => {
      recordAt("2026-03-10T07:00:00.000Z");
      recordAt("2026-03-10T08:00:00.000Z");
      recordAt("2026-03-09T08:00:00.000Z");
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today }).currentStreakDays).toBe(2);
    });

    it("a gap resets the streak", () => {
      recordAt("2026-03-10T08:00:00.000Z"); // today
      recordAt("2026-03-09T08:00:00.000Z"); // yesterday
      recordAt("2026-03-07T08:00:00.000Z"); // gap on the 8th
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today }).currentStreakDays).toBe(2);
    });

    it("incomplete-only days do not count", () => {
      recordAt("2026-03-10T08:00:00.000Z", { completed: false });
      recordAt("2026-03-09T08:00:00.000Z", { completed: false });
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today })).toEqual({
        currentStreakDays: 0,
        lastSessionAt: null,
      });
    });

    it("an incomplete day inside a run breaks the streak", () => {
      recordAt("2026-03-10T08:00:00.000Z", { completed: true }); // today
      recordAt("2026-03-09T08:00:00.000Z", { completed: false }); // breaks here
      recordAt("2026-03-08T08:00:00.000Z", { completed: true });
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today }).currentStreakDays).toBe(1);
    });

    it("a streak older than yesterday does not count", () => {
      recordAt("2026-03-07T08:00:00.000Z");
      recordAt("2026-03-08T08:00:00.000Z");
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today }).currentStreakDays).toBe(0);
    });

    it("reports lastSessionAt for the most recent completed session", () => {
      recordAt("2026-03-09T08:00:00.000Z");
      const last = recordAt("2026-03-10T08:00:00.000Z");
      expect(getCalmStreak(LEARNER, TENANT, { todayIso: today }).lastSessionAt).toBe(
        last.occurredAt,
      );
    });
  });

  describe("summarizeCalmForParent", () => {
    it("returns counts + topActivityId and never leaks records", () => {
      recordAt("2026-01-01T10:00:00.000Z", { activityId: "box_breathing", completed: true });
      recordAt("2026-01-02T10:00:00.000Z", { activityId: "box_breathing", completed: true });
      recordAt("2026-01-03T10:00:00.000Z", { activityId: "stretch_break", completed: false });

      const summary = summarizeCalmForParent(LEARNER, TENANT);
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

    it("returns an empty rollup when there is no history", () => {
      expect(summarizeCalmForParent(LEARNER, TENANT)).toEqual({
        totalMoments: 0,
        completedMoments: 0,
        topActivityId: null,
        lastSessionAt: null,
      });
    });

    it("respects sinceIso", () => {
      recordAt("2026-01-01T10:00:00.000Z");
      recordAt("2026-01-05T10:00:00.000Z");
      const summary = summarizeCalmForParent(LEARNER, TENANT, {
        sinceIso: "2026-01-03T00:00:00.000Z",
      });
      expect(summary.totalMoments).toBe(1);
      expect(summary.lastSessionAt).toBe("2026-01-05T10:00:00.000Z");
    });

    it("is tenant- and learner-scoped", () => {
      recordAt("2026-01-01T10:00:00.000Z", { learnerId: "other_learner" });
      recordAt("2026-01-01T10:00:00.000Z", { tenantId: "other_tenant" });
      expect(summarizeCalmForParent(LEARNER, TENANT).totalMoments).toBe(0);
    });
  });
});
