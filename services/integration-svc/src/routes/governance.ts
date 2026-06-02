import type { FastifyInstance } from "fastify";
import {
  registerGovernanceSubscriber,
  type GovernanceSubjectRequest,
  type EraseResult,
  type ExportResult,
} from "@aivo/enterprise-core";
import { aacSyncState, aacVocabulary, familySettings } from "@aivo/db";
import { eq } from "drizzle-orm";
import type { Database } from "@aivo/db";

export function registerGovernanceRoutes(app: FastifyInstance, db: Database | undefined): void {
  registerGovernanceSubscriber(app, {
    service: "integration-svc",

    async erase(req: GovernanceSubjectRequest): Promise<EraseResult> {
      if (!db) return { counts: {} };
      const uid = req.subjectId;

      // subjectId is a userId for familySettings; for AAC tables it's a
      // learnerId. We attempt both interpretations.
      const [famSettings, aacSync, aacVocab] = await Promise.all([
        db.delete(familySettings).where(eq(familySettings.userId, uid)).returning({ id: familySettings.id }),
        db.delete(aacSyncState).where(eq(aacSyncState.learnerId, uid)).returning({ id: aacSyncState.id }),
        db.delete(aacVocabulary).where(eq(aacVocabulary.learnerId, uid)).returning({ id: aacVocabulary.id }),
      ]);

      return {
        counts: {
          family_settings: famSettings.length,
          aac_sync_state: aacSync.length,
          aac_vocabulary: aacVocab.length,
        },
      };
    },

    async export(req: GovernanceSubjectRequest): Promise<ExportResult> {
      if (!db) return { counts: {}, bundle: {} };
      const uid = req.subjectId;

      const [famSettings, aacSync, aacVocab] = await Promise.all([
        db.select().from(familySettings).where(eq(familySettings.userId, uid)),
        db.select().from(aacSyncState).where(eq(aacSyncState.learnerId, uid)),
        db.select().from(aacVocabulary).where(eq(aacVocabulary.learnerId, uid)),
      ]);

      return {
        counts: {
          family_settings: famSettings.length,
          aac_sync_state: aacSync.length,
          aac_vocabulary: aacVocab.length,
        },
        bundle: {
          family_settings: famSettings,
          aac_sync_state: aacSync,
          aac_vocabulary: aacVocab,
        },
      };
    },
  });
}
