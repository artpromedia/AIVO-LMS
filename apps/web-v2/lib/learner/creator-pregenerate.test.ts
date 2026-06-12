/**
 * Remediation Sprint 06 — Creator pre-generation against the REAL lesson
 * path (seeded demo store, deterministic provider): generates a ready run,
 * is idempotent, and the learner home's mission picker RESUMES the
 * pre-generated run instead of generating again.
 */
import { beforeAll, describe, expect, it } from "vitest";

const SKY = "lrn_demo_sky";
const TENANT = "t_demo";

beforeAll(() => {
  process.env.AIVO_SEED_DEMO_JOURNEY = "1";
});

describe("pregenerateNextLessons", () => {
  it(
    "pre-generates a ready run the mission picker then resumes",
    { timeout: 60_000 },
    async () => {
      const { ensureSeeded } = await import("@/lib/db/seed");
      const { getPersistence } = await import("@/lib/db/persistence");
      const { pregenerateNextLessons } = await import("./creator-pregenerate");
      const { pickTodaysMission } = await import("./today");
      ensureSeeded();

      const persistence = getPersistence();
      const before = await persistence.lessonRuns.listForLearner(SKY, TENANT, { limit: 100 });
      const hadOpenRun = before.some((r) => r.status === "ready" || r.status === "in_progress");

      const first = await pregenerateNextLessons({ tenantIds: [TENANT] });
      expect(first.scanned).toBeGreaterThan(0);
      if (hadOpenRun) {
        // Seeded demo learners may already carry an open run — the Creator
        // must skip them, never stack a duplicate.
        expect(first.skippedExistingRun).toBeGreaterThan(0);
      } else {
        expect(first.generated).toBeGreaterThan(0);
      }

      // Whatever the first pass did, the learner now has an open run …
      const after = await persistence.lessonRuns.listForLearner(SKY, TENANT, { limit: 100 });
      const openRun = after.find((r) => r.status === "ready" || r.status === "in_progress");
      expect(openRun, "an open (pre-generated or pre-existing) run must exist").toBeTruthy();

      // … so a second pass is a no-op for this learner (idempotent).
      const second = await pregenerateNextLessons({ tenantIds: [TENANT] });
      expect(second.generated).toBe(0);
      expect(second.skippedExistingRun).toBeGreaterThan(0);

      // And the learner home picks the open run up as a RESUME — the seam
      // that makes pre-generated lessons playable with zero player changes.
      const mission = await pickTodaysMission(SKY, TENANT);
      expect(mission.ready).toBe(true);
      if (mission.ready) {
        expect(mission.mission.existingRunId).toBeTruthy();
      }
    },
  );

  it(
    "prepares the WHOLE week: one weekly_creator run per subject, never duplicates",
    { timeout: 60_000 },
    async () => {
      const { ensureSeeded } = await import("@/lib/db/seed");
      const { getPersistence } = await import("@/lib/db/persistence");
      const { enumerateWeekTargets, pregenerateNextLessons, MAX_WEEK_LESSONS_PER_LEARNER } =
        await import("./creator-pregenerate");
      ensureSeeded();
      const persistence = getPersistence();

      const targets = await enumerateWeekTargets(SKY, TENANT);
      expect(targets.length).toBeGreaterThan(0);
      expect(targets.length).toBeLessThanOrEqual(MAX_WEEK_LESSONS_PER_LEARNER);
      // One target per subject.
      const subjects = targets.map((t) => t.subjectId);
      expect(new Set(subjects).size).toBe(subjects.length);

      await pregenerateNextLessons({ tenantIds: [TENANT] });
      const runs = await persistence.lessonRuns.listForLearner(SKY, TENANT, { limit: 100 });
      const open = runs.filter((r) => r.status === "ready" || r.status === "in_progress");
      // Per-subject idempotency: at most one open run per subject, however
      // many passes have run before this test.
      const openSubjects = open.map((r) => r.subjectId);
      expect(new Set(openSubjects).size).toBe(openSubjects.length);
      // Creator-created runs carry the auditable weekly_creator source.
      const creatorRuns = runs.filter((r) => r.source === "weekly_creator");
      for (const run of creatorRuns) expect(run.status).not.toBe("failed");

      // Re-running tops up nothing new for already-open subjects.
      const again = await pregenerateNextLessons({ tenantIds: [TENANT] });
      expect(again.generated).toBe(0);
    },
  );
});
