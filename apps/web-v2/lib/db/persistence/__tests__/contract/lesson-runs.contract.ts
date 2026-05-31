/**
 * Shared LessonRunStore contract — runs against memory or postgres.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type {
  GeneratedLessonPlan,
  LessonInteraction,
  LessonRun,
  ParentLessonSummary,
} from "@/lib/db/types";
import type { LessonRunStore } from "../../types";

function run(over: Partial<LessonRun> = {}): LessonRun {
  const base = {
    id: "lr_1",
    tenantId: "t_1",
    learnerId: "lrn_1",
    subjectId: "sub_math",
    skillId: "sk_add",
    source: "learning_path",
    sourceRefId: null,
    tutorPersona: "nova",
    learnerContextSnapshot: { grade: "3" },
    masterySnapshot: { sk_add: 0.5 },
    accommodationSnapshot: { extendedTime: true },
    brainStateSnapshot: { v: 1 },
    lessonPlanId: null,
    status: "ready",
    retryCount: 0,
    failureReason: null,
    startedAt: null,
    completedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  } as unknown as LessonRun;
  return { ...base, ...over };
}

export function lessonRunStoreContract(
  label: string,
  makeStore: () => LessonRunStore,
  reset: () => void | Promise<void>,
): void {
  describe(`LessonRunStore contract — ${label}`, () => {
    let store: LessonRunStore;
    beforeEach(async () => {
      await reset();
      store = makeStore();
    });

    it("round-trips a run and scopes by tenant", async () => {
      await store.upsertRun(run());
      const got = await store.getRunById("lr_1", "t_1");
      expect(got?.id).toBe("lr_1");
      expect(got?.subjectId).toBe("sub_math");
      expect(got?.masterySnapshot).toEqual({ sk_add: 0.5 });
      expect(await store.getRunById("lr_1", "other")).toBeNull();
    });

    it("upsert updates in place", async () => {
      await store.upsertRun(run());
      await store.upsertRun(run({ status: "completed", completedAt: "2026-01-02T00:00:00.000Z" }));
      const got = await store.getRunById("lr_1", "t_1");
      expect(got?.status).toBe("completed");
      expect(got?.completedAt).toBe("2026-01-02T00:00:00.000Z");
    });

    it("lists newest-first, filters by status, and counts", async () => {
      await store.upsertRun(run({ id: "lr_1", createdAt: "2026-01-01T00:00:00.000Z" }));
      await store.upsertRun(
        run({ id: "lr_2", status: "completed", createdAt: "2026-01-03T00:00:00.000Z" }),
      );
      await store.upsertRun(run({ id: "lr_3", createdAt: "2026-01-02T00:00:00.000Z" }));

      const all = await store.listForLearner("lrn_1", "t_1");
      expect(all.map((r) => r.id)).toEqual(["lr_2", "lr_3", "lr_1"]);

      const completed = await store.listForLearner("lrn_1", "t_1", { status: "completed" });
      expect(completed.map((r) => r.id)).toEqual(["lr_2"]);

      const limited = await store.listForLearner("lrn_1", "t_1", { limit: 1 });
      expect(limited).toHaveLength(1);

      expect(await store.countForLearner("lrn_1", "t_1")).toBe(3);
    });

    it("stores plans, interactions (chronological), and parent summaries", async () => {
      const plan = {
        id: "plan_1",
        lessonRunId: "lr_1",
        tenantId: "t_1",
        title: "Adding",
      } as unknown as GeneratedLessonPlan;
      await store.upsertPlan(plan);
      expect((await store.getPlanById("plan_1", "t_1"))?.id).toBe("plan_1");
      expect(await store.getPlanById("plan_1", "other")).toBeNull();

      const mk = (id: string, occurredAt: string): LessonInteraction =>
        ({
          id,
          lessonRunId: "lr_1",
          learnerId: "lrn_1",
          tenantId: "t_1",
          stepKind: "check",
          stepRefId: null,
          response: "4",
          isCorrect: true,
          skipped: false,
          occurredAt,
        }) as LessonInteraction;
      // Appended in chronological order (the real-world invariant); both
      // adapters return them in that order.
      await store.appendInteraction(mk("li_1", "2026-01-01T00:00:01.000Z"));
      await store.appendInteraction(mk("li_2", "2026-01-01T00:00:02.000Z"));
      const list = await store.listInteractions("lr_1", "t_1");
      expect(list.map((i) => i.id)).toEqual(["li_1", "li_2"]);

      const summary = {
        id: "pls_1",
        lessonRunId: "lr_1",
        tenantId: "t_1",
        learnerId: "lrn_1",
        subjectId: "sub_math",
        skillId: "sk_add",
        headline: "Practiced adding",
      } as unknown as ParentLessonSummary;
      await store.upsertParentSummary(summary);
      expect((await store.getParentSummaryForRun("lr_1", "t_1"))?.id).toBe("pls_1");
      expect(await store.getParentSummaryForRun("lr_1", "other")).toBeNull();
    });
  });
}
