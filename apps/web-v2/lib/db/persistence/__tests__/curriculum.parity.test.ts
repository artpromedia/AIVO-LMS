/**
 * curriculum — memory == postgres parity (Sprint 1).
 * Seeded reference reads (subjects/skills) + the listSkills(subjectId) filter
 * + learning-path replace (delete-prior + insert-next).
 */
import { it, expect } from "vitest";
import type { LearningPath } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky";

runInBothModes("curriculum", (ctx) => {
  it("subjects/skills reference set matches across backends", async () => {
    const subjects = await ctx.parity(
      "subjects",
      () => getPersistence().curriculum.listSubjects(),
      (s) => s.map((x) => x.slug).sort(),
    );
    expect(subjects.length).toBeGreaterThan(0);

    const target = subjects[0]!;
    const skills = await getPersistence().curriculum.listSkills(target.id);
    for (const s of skills) expect(s.subjectId).toBe(target.id);
    expect((await getPersistence().curriculum.getSubjectById(target.id))?.id).toBe(target.id);
  });

  it("replaceLearningPath swaps the active path atomically", async () => {
    const c = getPersistence().curriculum;
    const path = (id: string) =>
      ({ id, learnerId: L, tenantId: T, steps: [] }) as unknown as LearningPath;
    await c.replaceLearningPath(L, T, path("lp-1"));
    expect((await c.getLearningPath(L, T))?.id).toBe("lp-1");
    await c.replaceLearningPath(L, T, path("lp-2"));
    expect((await c.getLearningPath(L, T))?.id).toBe("lp-2");
  });
});
