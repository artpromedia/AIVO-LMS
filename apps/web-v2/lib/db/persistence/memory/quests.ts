/**
 * In-memory QuestStore — wraps questWorlds / questChapters /
 * questProgress Maps. Selected when AIVO_PERSISTENCE_QUESTS=memory
 * (the default).
 *
 * Worlds + chapters are seed-time reference data; progress rows
 * are per-learner mutable. listProgressForLearner accepts an
 * optional worldId scope so the home page doesn't have to
 * post-filter.
 */
import { getStore } from "@/lib/db/store";
import type { QuestChapter, QuestProgress, QuestWorld } from "@/lib/db/types";
import type { QuestStore } from "../types";

export const memoryQuests: QuestStore = {
  async listWorlds(): Promise<QuestWorld[]> {
    return Array.from(getStore().questWorlds.values()).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getWorldById(worldId) {
    return getStore().questWorlds.get(worldId) ?? null;
  },

  async listChaptersForWorld(worldId): Promise<QuestChapter[]> {
    return Array.from(getStore().questChapters.values())
      .filter((c) => c.questWorldId === worldId)
      .sort((a, b) => a.order - b.order);
  },

  async getChapterById(chapterId) {
    return getStore().questChapters.get(chapterId) ?? null;
  },

  async listProgressForLearner(learnerId, tenantId, worldId): Promise<QuestProgress[]> {
    return Array.from(getStore().questProgress.values()).filter(
      (p) =>
        p.learnerId === learnerId &&
        p.tenantId === tenantId &&
        (!worldId || p.questWorldId === worldId),
    );
  },

  async getProgressForChapter(learnerId, tenantId, chapterId) {
    for (const p of getStore().questProgress.values()) {
      if (p.learnerId === learnerId && p.tenantId === tenantId && p.chapterId === chapterId) {
        return p;
      }
    }
    return null;
  },

  async upsertProgress(progress: QuestProgress) {
    getStore().questProgress.set(progress.id, progress);
    return progress;
  },
};
