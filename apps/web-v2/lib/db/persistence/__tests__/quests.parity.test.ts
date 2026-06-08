/**
 * quests — memory == postgres parity (Sprint 1).
 * Seeded worlds/chapters reference set + per-learner progress upsert/read.
 */
import { it, expect } from "vitest";
import type { QuestProgress } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky";

runInBothModes("quests", (ctx) => {
  it("worlds reference set matches and chapters belong to their world", async () => {
    const quests = getPersistence().quests;
    const worlds = await ctx.parity(
      "worlds",
      () => quests.listWorlds(),
      (w) => w.map((x) => x.slug).sort(),
    );
    expect(worlds.length).toBeGreaterThan(0);
    const world = worlds[0]!;
    const chapters = await quests.listChaptersForWorld(world.id);
    expect(chapters.length).toBeGreaterThan(0);
    for (const ch of chapters) expect(ch.questWorldId).toBe(world.id);
  });

  it("progress upsert + getProgressForChapter round-trips and is tenant-scoped", async () => {
    const quests = getPersistence().quests;
    const world = (await quests.listWorlds())[0]!;
    const chapter = (await quests.listChaptersForWorld(world.id))[0]!;
    const progress = {
      id: "qp-parity-1",
      learnerId: L,
      tenantId: T,
      questWorldId: world.id,
      chapterId: chapter.id,
      progress: 1,
      updatedAt: new Date().toISOString(),
    } as unknown as QuestProgress;
    await quests.upsertProgress(progress);
    expect((await quests.getProgressForChapter(L, T, chapter.id))?.progress).toBe(1);
    expect(await quests.getProgressForChapter(L, "t_other", chapter.id)).toBeNull();
  });
});
