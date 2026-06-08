/**
 * In-memory ClinicalStore — wraps the iepAiDrafts Map. Test-only reference
 * semantics the drizzle adapter must match: one draft per learner, list for a
 * reviewer's learners is newest-updated first.
 */
import { getStore } from "@/lib/db/store";
import type { IepAiDraftRecord } from "@/lib/db/types";
import type { ClinicalStore } from "../types";

export const memoryClinical: ClinicalStore = {
  async getDraftForLearner(learnerId, tenantId): Promise<IepAiDraftRecord | null> {
    return (
      Array.from(getStore().iepAiDrafts.values()).find(
        (d) => d.learnerId === learnerId && d.tenantId === tenantId,
      ) ?? null
    );
  },

  async getDraftById(id, tenantId): Promise<IepAiDraftRecord | null> {
    const d = getStore().iepAiDrafts.get(id);
    return d && d.tenantId === tenantId ? d : null;
  },

  async upsertDraft(draft): Promise<IepAiDraftRecord> {
    getStore().iepAiDrafts.set(draft.id, draft);
    return draft;
  },

  async listDraftsForLearners(learnerIds, tenantId): Promise<IepAiDraftRecord[]> {
    const ids = new Set(learnerIds);
    return Array.from(getStore().iepAiDrafts.values())
      .filter((d) => d.tenantId === tenantId && ids.has(d.learnerId))
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },
};
