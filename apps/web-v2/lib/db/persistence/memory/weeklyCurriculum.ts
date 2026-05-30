import type { CurriculumUpload } from "@/lib/db/types";
import type { WeeklyCurriculumStore } from "../types";
import { getStore, nowIso } from "@/lib/db/store";

/**
 * In-memory WeeklyCurriculumStore (dev/test only). Production runs the
 * Drizzle adapter against the shared `curriculum_uploads` table. Mirrors the
 * archival semantics of the Drizzle adapter so behavior is identical in both
 * modes.
 */
export const memoryWeeklyCurriculum: WeeklyCurriculumStore = {
  async listForLearner(learnerId, tenantId, opts) {
    return Array.from(getStore().curriculumUploads.values())
      .filter(
        (u) =>
          u.learnerId === learnerId &&
          u.tenantId === tenantId &&
          (!opts?.subject || u.subject === opts.subject) &&
          (!opts?.status || u.status === opts.status),
      )
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async getById(uploadId, tenantId) {
    const u = getStore().curriculumUploads.get(uploadId);
    return u && u.tenantId === tenantId ? u : null;
  },

  async create({ upload, archiveSupersededBefore }) {
    const store = getStore();
    const newStartMs = archiveSupersededBefore
      ? new Date(archiveSupersededBefore).getTime()
      : -Infinity;
    const now = nowIso();
    for (const u of store.curriculumUploads.values()) {
      if (
        u.learnerId === upload.learnerId &&
        u.tenantId === upload.tenantId &&
        u.subject === upload.subject &&
        u.status === "active"
      ) {
        const endMs = u.weekEnd ? new Date(u.weekEnd).getTime() + 24 * 3600 * 1000 : Infinity;
        const newIsFuture = archiveSupersededBefore ? newStartMs > Date.now() : false;
        if (!newIsFuture || endMs <= newStartMs) {
          store.curriculumUploads.set(u.id, { ...u, status: "archived", updatedAt: now });
        }
      }
    }
    store.curriculumUploads.set(upload.id, upload);
    return upload;
  },

  async delete(uploadId, tenantId) {
    const store = getStore();
    const u = store.curriculumUploads.get(uploadId);
    if (!u || u.tenantId !== tenantId) return false;
    return store.curriculumUploads.delete(uploadId);
  },
};
