import { FastifyInstance } from "fastify";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import { languageProfiles, aacSyncState, familySettings } from "@aivo/db";
import { eq, and } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "@aivo/security";
import { CoughDropSync } from "@aivo/aac-bridge";
import type { SymbolBoard } from "@aivo/aac-bridge";
import { buildSymbolBoard } from "../lib/aac-board.js";
import {
  languageProfileByLearnerIdSchema,
  getLanguageProfileByLearnerIdSchema,
  languageProfileByLearnerIdCoughdropSyncSchema,
  getLanguageProfileByLearnerIdCoughdropSyncStatusSchema,
} from "./schemas.js";

export async function registerLanguageProfileRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.post(
    "/api/family/language-profile/:learnerId",
    { schema: languageProfileByLearnerIdSchema },
    async (req, reply) => {
      const claims = await authenticateRequest(req, reply);
      if (!claims) return;

      const { learnerId } = req.params as any;
      const isOwner = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isOwner && claims.role !== "admin") {
        return reply.status(403).send({ error: "Not authorized for this learner" });
      }

      const body = req.body as any;
      if (!body.primaryLanguage)
        return reply.status(400).send({ error: "primaryLanguage required" });

      const existing = await db
        .select()
        .from(languageProfiles)
        .where(eq(languageProfiles.learnerId, learnerId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(languageProfiles)
          .set({
            primaryLanguage: body.primaryLanguage,
            secondaryLanguages: body.secondaryLanguages || [],
            dominanceByDomain: body.dominanceByDomain || {},
            processingSpeed: body.processingSpeed || {},
            codeSwitchingFrequency: body.codeSwitchingFrequency || null,
            preferredInstructionLanguage: body.preferredInstructionLanguage || null,
            updatedAt: new Date(),
          })
          .where(eq(languageProfiles.learnerId, learnerId));
        return { status: "updated", learnerId };
      }

      const [profile] = await db
        .insert(languageProfiles)
        .values({
          learnerId,
          primaryLanguage: body.primaryLanguage,
          secondaryLanguages: body.secondaryLanguages || [],
          dominanceByDomain: body.dominanceByDomain || {},
          processingSpeed: body.processingSpeed || {},
          codeSwitchingFrequency: body.codeSwitchingFrequency || null,
          preferredInstructionLanguage: body.preferredInstructionLanguage || null,
        })
        .returning();

      return { status: "created", profile };
    },
  );

  app.get(
    "/api/family/language-profile/:learnerId",
    { schema: getLanguageProfileByLearnerIdSchema },
    async (req, reply) => {
      const claims = await authenticateRequest(req, reply);
      if (!claims) return;

      const { learnerId } = req.params as any;
      const isOwner = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isOwner && claims.role !== "admin") {
        return reply.status(403).send({ error: "Not authorized for this learner" });
      }

      const [profile] = await db
        .select()
        .from(languageProfiles)
        .where(eq(languageProfiles.learnerId, learnerId))
        .limit(1);
      if (!profile) return reply.status(404).send({ error: "Language profile not found" });
      return profile;
    },
  );

  // ── CoughDrop Sync ─────────────────────────────────────────────────────────

  app.post(
    "/api/family/language-profile/:learnerId/coughdrop-sync",
    { schema: languageProfileByLearnerIdCoughdropSyncSchema },
    async (req, reply) => {
      const claims = await authenticateRequest(req, reply);
      if (!claims) return;

      const { learnerId } = req.params as { learnerId: string };
      const isOwner = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isOwner && claims.role !== "admin") {
        return reply.status(403).send({ error: "Not authorized for this learner" });
      }

      const [settings] = await db
        .select()
        .from(familySettings)
        .where(eq(familySettings.userId, claims.sub))
        .limit(1);

      if (!settings?.coughdropApiKeyEncrypted || !settings?.coughdropUserId) {
        return reply
          .status(400)
          .send({ error: "CoughDrop API key not configured in family settings" });
      }

      let apiKey: string;
      try {
        apiKey = decryptSecret(settings.coughdropApiKeyEncrypted);
      } catch {
        return reply.status(500).send({ error: "Failed to decrypt CoughDrop API key" });
      }

      // Build the real symbol board from the learner's AAC vocabulary
      // (anchored by curated core words). Locale follows the learner's
      // language profile; defaults to English when none is set.
      const [profile] = await db
        .select({
          preferred: languageProfiles.preferredInstructionLanguage,
          primary: languageProfiles.primaryLanguage,
        })
        .from(languageProfiles)
        .where(eq(languageProfiles.learnerId, learnerId))
        .limit(1);
      const locale = (profile?.preferred || profile?.primary || "en").slice(0, 16);

      let board: SymbolBoard;
      try {
        board = await buildSymbolBoard(db, learnerId, locale);
      } catch (err) {
        req.log?.warn({ err: (err as Error).message, learnerId }, "AAC board build failed");
        // Never sync an empty board — surface the gap instead.
        return reply
          .status(422)
          .send({ error: "No AAC vocabulary available to sync for this learner" });
      }

      const sync = new CoughDropSync(apiKey, settings.coughdropUserId);
      try {
        await sync.syncLearnerVocabulary(learnerId, board);
        const syncResult = await sync.getSyncStatus(learnerId);

        const existing = await db
          .select()
          .from(aacSyncState)
          .where(and(eq(aacSyncState.learnerId, learnerId), eq(aacSyncState.vendor, "coughdrop")))
          .limit(1);

        if (existing.length > 0) {
          await db
            .update(aacSyncState)
            .set({
              syncStatus: syncResult.status as "synced" | "pending" | "error" | "never",
              lastSyncAt: syncResult.lastSyncAt ?? undefined,
              externalBoardId: syncResult.boardId ?? undefined,
              errorMessage: null,
              updatedAt: new Date(),
            })
            .where(
              and(eq(aacSyncState.learnerId, learnerId), eq(aacSyncState.vendor, "coughdrop")),
            );
        } else {
          await db.insert(aacSyncState).values({
            learnerId,
            vendor: "coughdrop",
            syncStatus: syncResult.status as "synced" | "pending" | "error" | "never",
            lastSyncAt: syncResult.lastSyncAt ?? undefined,
            externalBoardId: syncResult.boardId ?? undefined,
          });
        }

        return { status: "ok", syncStatus: syncResult.status, boardId: syncResult.boardId };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Sync failed";
        return reply.status(502).send({ error: "CoughDrop sync failed", detail: msg });
      }
    },
  );

  app.get(
    "/api/family/language-profile/:learnerId/coughdrop-sync/status",
    { schema: getLanguageProfileByLearnerIdCoughdropSyncStatusSchema },
    async (req, reply) => {
      const claims = await authenticateRequest(req, reply);
      if (!claims) return;

      const { learnerId } = req.params as { learnerId: string };
      const isOwner = await verifyParentOwnership(db, claims.sub, learnerId);
      if (!isOwner && claims.role !== "admin") {
        return reply.status(403).send({ error: "Not authorized for this learner" });
      }

      const [row] = await db
        .select()
        .from(aacSyncState)
        .where(and(eq(aacSyncState.learnerId, learnerId), eq(aacSyncState.vendor, "coughdrop")))
        .limit(1);

      if (!row) {
        return { status: "never", boardId: null, lastSyncAt: null };
      }

      return {
        status: row.syncStatus,
        boardId: row.externalBoardId ?? null,
        lastSyncAt: row.lastSyncAt ?? null,
      };
    },
  );
}
