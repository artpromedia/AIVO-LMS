/**
 * Drizzle-backed ClinicalStore — the web_iep_ai_drafts review inbox. One row
 * per (learner, tenant); the reviewer list is newest-updated first, applied in
 * app code to match the memory store byte-for-byte.
 *
 * Per ADR 0015 this never touches canonical clinical data (goals, notes,
 * observations) — those are written through to family-svc over REST (see
 * lib/clinical/family-svc-client.ts).
 */
import { and, eq, inArray } from "drizzle-orm";
import { webIepAiDrafts } from "@aivo/db";
import type { IepAiDraftRecord } from "@/lib/db/types";
import type { ClinicalStore } from "../types";
import { getDb } from "./client";

export const drizzleClinical: ClinicalStore = {
  async getDraftForLearner(learnerId, tenantId): Promise<IepAiDraftRecord | null> {
    const [row] = await getDb()
      .select()
      .from(webIepAiDrafts)
      .where(and(eq(webIepAiDrafts.learnerId, learnerId), eq(webIepAiDrafts.tenantId, tenantId)))
      .limit(1);
    return row ? (row.data as IepAiDraftRecord) : null;
  },

  async getDraftById(id, tenantId): Promise<IepAiDraftRecord | null> {
    const [row] = await getDb()
      .select()
      .from(webIepAiDrafts)
      .where(and(eq(webIepAiDrafts.id, id), eq(webIepAiDrafts.tenantId, tenantId)))
      .limit(1);
    return row ? (row.data as IepAiDraftRecord) : null;
  },

  async upsertDraft(draft): Promise<IepAiDraftRecord> {
    await getDb()
      .insert(webIepAiDrafts)
      .values({
        id: draft.id,
        learnerId: draft.learnerId,
        tenantId: draft.tenantId,
        updatedAt: draft.updatedAt,
        data: draft,
      })
      .onConflictDoUpdate({
        target: webIepAiDrafts.id,
        set: { learnerId: draft.learnerId, tenantId: draft.tenantId, updatedAt: draft.updatedAt, data: draft },
      });
    return draft;
  },

  async listDraftsForLearners(learnerIds, tenantId): Promise<IepAiDraftRecord[]> {
    if (learnerIds.length === 0) return [];
    const rows = await getDb()
      .select()
      .from(webIepAiDrafts)
      .where(
        and(eq(webIepAiDrafts.tenantId, tenantId), inArray(webIepAiDrafts.learnerId, learnerIds)),
      );
    return rows
      .map((r) => r.data as IepAiDraftRecord)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  },
};
