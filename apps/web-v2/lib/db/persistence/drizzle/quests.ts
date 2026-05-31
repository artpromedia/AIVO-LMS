/**
 * Drizzle-backed QuestStore. Worlds/chapters are reference data;
 * progress is per-learner. Sort semantics mirror the memory store
 * (worlds by name, chapters by order) and are applied in app code to
 * match its localeCompare exactly.
 */
import { and, eq } from "drizzle-orm";
import { webQuestWorlds, webQuestChapters, webQuestProgress } from "@aivo/db";
import type { QuestChapter, QuestProgress, QuestWorld } from "@/lib/db/types";
import type { QuestStore } from "../types";
import { getDb } from "./client";

export const drizzleQuests: QuestStore = {
  async listWorlds() {
    const rows = await getDb().select().from(webQuestWorlds);
    return rows.map((r) => r.data as QuestWorld).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getWorldById(worldId) {
    const [row] = await getDb()
      .select()
      .from(webQuestWorlds)
      .where(eq(webQuestWorlds.id, worldId))
      .limit(1);
    return row ? (row.data as QuestWorld) : null;
  },

  async listChaptersForWorld(worldId) {
    const rows = await getDb()
      .select()
      .from(webQuestChapters)
      .where(eq(webQuestChapters.worldId, worldId));
    return rows.map((r) => r.data as QuestChapter).sort((a, b) => a.order - b.order);
  },

  async getChapterById(chapterId) {
    const [row] = await getDb()
      .select()
      .from(webQuestChapters)
      .where(eq(webQuestChapters.id, chapterId))
      .limit(1);
    return row ? (row.data as QuestChapter) : null;
  },

  async listProgressForLearner(learnerId, tenantId, worldId) {
    const rows = await getDb()
      .select()
      .from(webQuestProgress)
      .where(
        and(eq(webQuestProgress.learnerId, learnerId), eq(webQuestProgress.tenantId, tenantId)),
      );
    const all = rows.map((r) => r.data as QuestProgress);
    return worldId ? all.filter((p) => p.questWorldId === worldId) : all;
  },

  async getProgressForChapter(learnerId, tenantId, chapterId) {
    const rows = await getDb()
      .select()
      .from(webQuestProgress)
      .where(
        and(eq(webQuestProgress.learnerId, learnerId), eq(webQuestProgress.tenantId, tenantId)),
      );
    return rows.map((r) => r.data as QuestProgress).find((p) => p.chapterId === chapterId) ?? null;
  },

  async upsertProgress(progress) {
    const db = getDb();
    await db
      .insert(webQuestProgress)
      .values({
        id: progress.id,
        learnerId: progress.learnerId,
        tenantId: progress.tenantId,
        data: progress,
      })
      .onConflictDoUpdate({
        target: webQuestProgress.id,
        set: { learnerId: progress.learnerId, tenantId: progress.tenantId, data: progress },
      });
    return progress;
  },
};
