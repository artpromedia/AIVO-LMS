/**
 * Remediation Sprint 12 — engagement is REAL: XP math, streak transitions,
 * and the exactly-once award on lesson completion.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { LessonOutcome } from "@/lib/db/types";
import { XP_BASE, XP_INDEPENDENCE_BONUS, XP_PER_CORRECT_CHECK, nextStreak, xpForOutcome } from "./engagement-award";

const outcome = (over: Partial<LessonOutcome> = {}): LessonOutcome => ({
  checksTotal: 2,
  checksCorrect: 2,
  hintsUsed: 0,
  scaffoldsUsed: 0,
  secondsActive: 300,
  abandoned: false,
  ...over,
});

describe("xpForOutcome", () => {
  it("pays base + per-correct + independence", () => {
    expect(xpForOutcome(outcome())).toBe(XP_BASE + 2 * XP_PER_CORRECT_CHECK + XP_INDEPENDENCE_BONUS);
  });
  it("drops the independence bonus when help was used", () => {
    expect(xpForOutcome(outcome({ hintsUsed: 1 }))).toBe(XP_BASE + 2 * XP_PER_CORRECT_CHECK);
  });
  it("abandoned runs still earn showing-up XP only", () => {
    expect(xpForOutcome(outcome({ abandoned: true }))).toBe(XP_BASE);
  });
});

describe("nextStreak", () => {
  it("consecutive days increment", () => {
    expect(
      nextStreak({ currentStreakDays: 3, lastSessionAt: "2026-06-10T20:00:00Z" }, "2026-06-11T08:00:00Z"),
    ).toBe(4);
  });
  it("same day never double-counts", () => {
    expect(
      nextStreak({ currentStreakDays: 4, lastSessionAt: "2026-06-11T08:00:00Z" }, "2026-06-11T21:00:00Z"),
    ).toBe(4);
  });
  it("a missed day resets to 1", () => {
    expect(
      nextStreak({ currentStreakDays: 9, lastSessionAt: "2026-06-08T08:00:00Z" }, "2026-06-11T08:00:00Z"),
    ).toBe(1);
  });
});

describe("award on completion (exactly once, persisted)", () => {
  beforeAll(() => {
    process.env.AIVO_SEED_DEMO_JOURNEY = "1";
  });

  it("writes XP/streak through the persistence adapter and never double-awards", { timeout: 60_000 }, async () => {
    const { ensureSeeded } = await import("@/lib/db/seed");
    const { getPersistence } = await import("@/lib/db/persistence");
    const { createLessonRun, completeLessonRun } = await import("@/lib/db/repos");
    ensureSeeded();
    const persistence = getPersistence();

    const math = (await persistence.curriculum.listSubjects()).find((s) => s.slug === "math")!;
    const skill = (await persistence.curriculum.listSkills(math.id))[0];
    const created = await createLessonRun({
      learnerId: "lrn_demo_sky",
      tenantId: "t_demo",
      subjectId: math.id,
      skillId: skill.id,
      source: "subject_path",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const before = await persistence.engagement.getEngagement("lrn_demo_sky");
    const xpBefore = before?.totalXp ?? 0;

    const completed = await completeLessonRun(created.lessonRun.id, "t_demo", {
      checksTotal: 2,
      checksCorrect: 2,
      hintsUsed: 0,
      scaffoldsUsed: 0,
      secondsActive: 240,
      abandoned: false,
    });
    expect(completed?.status).toBe("completed");

    const after = await persistence.engagement.getEngagement("lrn_demo_sky");
    expect(after).toBeTruthy();
    expect(after!.totalXp).toBe(xpBefore + xpForOutcome(outcome()));
    expect(after!.lastSessionAt).toBeTruthy();
    expect(after!.currentStreakDays).toBeGreaterThanOrEqual(1);

    // Re-completing the same run is a no-op for engagement too.
    await completeLessonRun(created.lessonRun.id, "t_demo");
    const again = await persistence.engagement.getEngagement("lrn_demo_sky");
    expect(again!.totalXp).toBe(after!.totalXp);
  });
});
