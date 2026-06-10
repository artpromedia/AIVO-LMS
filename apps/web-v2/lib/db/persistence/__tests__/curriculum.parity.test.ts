/**
 * curriculum — memory == postgres parity (Sprint 1).
 * Seeded reference reads (subjects/skills) + the listSkills(subjectId) filter
 * + learning-path replace (delete-prior + insert-next) + the per-learner
 * mastery/review-schedule writes that baseline + lesson completion land
 * through the adapter (mastery-map upsert, covered-subject replace,
 * keyed skill-mastery upsert, review-schedule replace).
 */
import { it, expect } from "vitest";
import type { LearningPath, MasteryMap, ReviewSchedule, SkillMastery } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky";

function mastery(skillId: string, subjectId: string, score: number): SkillMastery {
  return {
    learnerId: L,
    tenantId: T,
    skillId,
    subjectId,
    score,
    level: score >= 0.65 ? "on_grade_level" : "emerging",
    confidence: 0.6,
    needsReview: false,
    lastEvaluatedAt: new Date().toISOString(),
  };
}

function schedule(id: string, skillId: string): ReviewSchedule {
  return {
    id,
    learnerId: L,
    tenantId: T,
    skillId,
    dueAt: new Date().toISOString(),
    reason: "baseline gap",
  };
}

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

  it("upsertMasteryMap inserts then updates the snapshot row", async () => {
    const c = getPersistence().curriculum;
    const now = new Date().toISOString();
    const map: MasteryMap = { id: "mmap-parity-1", learnerId: L, tenantId: T, generatedAt: now, updatedAt: now };
    await c.upsertMasteryMap(map);
    expect((await c.getMasteryMapForLearner(L, T)).map?.id).toBe("mmap-parity-1");

    const later = new Date(Date.now() + 60_000).toISOString();
    await c.upsertMasteryMap({ ...map, updatedAt: later });
    const { map: readBack } = await c.getMasteryMapForLearner(L, T);
    expect(readBack?.id).toBe("mmap-parity-1");
    expect(readBack?.updatedAt).toBe(later);
  });

  it("replaceSkillMasteriesForSubjects replaces only the covered subjects", async () => {
    const c = getPersistence().curriculum;
    // Prior rows in two subjects.
    await c.replaceSkillMasteriesForSubjects(L, T, ["sub-a", "sub-b"], [
      mastery("skl-a1", "sub-a", 0.3),
      mastery("skl-b1", "sub-b", 0.4),
    ]);
    // Re-run covering ONLY sub-a — sub-b's row must survive, sub-a's must be replaced.
    await c.replaceSkillMasteriesForSubjects(L, T, ["sub-a"], [mastery("skl-a2", "sub-a", 0.7)]);

    const { skillMasteries } = await c.getMasteryMapForLearner(L, T);
    const ids = skillMasteries.map((m) => m.skillId).sort();
    expect(ids).toEqual(["skl-a2", "skl-b1"]);
  });

  it("upsertSkillMastery is keyed by (learner, tenant, skill) — update, not duplicate", async () => {
    const c = getPersistence().curriculum;
    await c.upsertSkillMastery(mastery("skl-up-1", "sub-a", 0.4));
    await c.upsertSkillMastery(mastery("skl-up-1", "sub-a", 0.8));

    const { skillMasteries } = await c.getMasteryMapForLearner(L, T);
    const rows = skillMasteries.filter((m) => m.skillId === "skl-up-1");
    expect(rows).toHaveLength(1);
    expect(rows[0]!.score).toBe(0.8);
    expect(rows[0]!.level).toBe("on_grade_level");
  });

  it("replaceReviewSchedules swaps the learner's schedule set", async () => {
    const c = getPersistence().curriculum;
    await c.replaceReviewSchedules(L, T, [schedule("rs-1", "skl-a1"), schedule("rs-2", "skl-b1")]);
    expect((await c.getReviewSchedules(L, T)).map((r) => r.id).sort()).toEqual(["rs-1", "rs-2"]);

    await c.replaceReviewSchedules(L, T, [schedule("rs-3", "skl-a2")]);
    expect((await c.getReviewSchedules(L, T)).map((r) => r.id)).toEqual(["rs-3"]);

    // Another learner's schedules are untouched by the replace.
    expect(await c.getReviewSchedules("lrn-other", T)).toEqual([]);
  });
});
