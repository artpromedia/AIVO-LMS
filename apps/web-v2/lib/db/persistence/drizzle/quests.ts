/**
 * Drizzle-backed QuestStore — stub.
 *
 * `packages/db/src/schema/engagement.ts` (or a follow-up
 * quests-specific module) needs to ship quest_worlds / quest_chapters /
 * quest_progress tables before this can be wired. Worlds + chapters
 * are read-mostly reference data; progress is the hot mutable row.
 */
import type { QuestStore } from "../types";

function notImplemented(method: string): never {
  throw new Error(
    `[persistence.drizzle.quests.${method}] not implemented. ` +
      `Land the quests schema in packages/db before flipping ` +
      `AIVO_PERSISTENCE_QUESTS=postgres.`,
  );
}

export const drizzleQuests: QuestStore = {
  async listWorlds() {
    return notImplemented("listWorlds");
  },
  async getWorldById() {
    return notImplemented("getWorldById");
  },
  async listChaptersForWorld() {
    return notImplemented("listChaptersForWorld");
  },
  async getChapterById() {
    return notImplemented("getChapterById");
  },
  async listProgressForLearner() {
    return notImplemented("listProgressForLearner");
  },
  async getProgressForChapter() {
    return notImplemented("getProgressForChapter");
  },
  async upsertProgress() {
    return notImplemented("upsertProgress");
  },
};
