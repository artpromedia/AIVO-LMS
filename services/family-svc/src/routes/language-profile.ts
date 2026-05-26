import { FastifyInstance } from "fastify";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import { languageProfiles, aacSyncState, familySettings } from "@aivo/db";
import { eq, and } from "drizzle-orm";
import { encryptSecret, decryptSecret } from "@aivo/security";
import { CoughDropSync } from "@aivo/aac-bridge";
import type { SymbolBoard } from "@aivo/aac-bridge";
import { fetchAacBoard, type AacBoardItem } from "../services/brain-svc-client.js";

/**
 * 30-symbol high-frequency core communication board. Mirrors the core
 * list in brain-svc/aac_board.py so the family-svc fallback is
 * indistinguishable from the brain-svc default. Kept inline so this
 * route works even when brain-svc has never been reachable.
 */
const DEFAULT_AAC_BOARD: AacBoardItem[] = [
  { symbol_id: "core.yes",       label: "yes",        image_url: "https://cdn.aivo.ai/aac-symbols/core.yes.svg",       category: "core",    frequency_rank: 1 },
  { symbol_id: "core.no",        label: "no",         image_url: "https://cdn.aivo.ai/aac-symbols/core.no.svg",        category: "core",    frequency_rank: 2 },
  { symbol_id: "core.more",      label: "more",       image_url: "https://cdn.aivo.ai/aac-symbols/core.more.svg",      category: "core",    frequency_rank: 3 },
  { symbol_id: "core.want",      label: "want",       image_url: "https://cdn.aivo.ai/aac-symbols/core.want.svg",      category: "core",    frequency_rank: 4 },
  { symbol_id: "core.help",      label: "help",       image_url: "https://cdn.aivo.ai/aac-symbols/core.help.svg",      category: "core",    frequency_rank: 5 },
  { symbol_id: "core.done",      label: "all done",   image_url: "https://cdn.aivo.ai/aac-symbols/core.done.svg",      category: "core",    frequency_rank: 6 },
  { symbol_id: "core.stop",      label: "stop",       image_url: "https://cdn.aivo.ai/aac-symbols/core.stop.svg",      category: "core",    frequency_rank: 7 },
  { symbol_id: "core.go",        label: "go",         image_url: "https://cdn.aivo.ai/aac-symbols/core.go.svg",        category: "core",    frequency_rank: 8 },
  { symbol_id: "core.like",      label: "like",       image_url: "https://cdn.aivo.ai/aac-symbols/core.like.svg",      category: "core",    frequency_rank: 9 },
  { symbol_id: "core.dont_like", label: "don't like", image_url: "https://cdn.aivo.ai/aac-symbols/core.dont_like.svg", category: "core",    frequency_rank: 10 },
  { symbol_id: "core.i",         label: "I",          image_url: "https://cdn.aivo.ai/aac-symbols/core.i.svg",         category: "core",    frequency_rank: 11 },
  { symbol_id: "core.you",       label: "you",        image_url: "https://cdn.aivo.ai/aac-symbols/core.you.svg",       category: "core",    frequency_rank: 12 },
  { symbol_id: "core.feel",      label: "feel",       image_url: "https://cdn.aivo.ai/aac-symbols/core.feel.svg",      category: "feeling", frequency_rank: 13 },
  { symbol_id: "core.happy",     label: "happy",      image_url: "https://cdn.aivo.ai/aac-symbols/core.happy.svg",     category: "feeling", frequency_rank: 14 },
  { symbol_id: "core.sad",       label: "sad",        image_url: "https://cdn.aivo.ai/aac-symbols/core.sad.svg",       category: "feeling", frequency_rank: 15 },
  { symbol_id: "core.angry",     label: "angry",      image_url: "https://cdn.aivo.ai/aac-symbols/core.angry.svg",     category: "feeling", frequency_rank: 16 },
  { symbol_id: "core.scared",    label: "scared",     image_url: "https://cdn.aivo.ai/aac-symbols/core.scared.svg",    category: "feeling", frequency_rank: 17 },
  { symbol_id: "core.tired",     label: "tired",      image_url: "https://cdn.aivo.ai/aac-symbols/core.tired.svg",     category: "feeling", frequency_rank: 18 },
  { symbol_id: "core.hungry",    label: "hungry",     image_url: "https://cdn.aivo.ai/aac-symbols/core.hungry.svg",    category: "need",    frequency_rank: 19 },
  { symbol_id: "core.thirsty",   label: "thirsty",    image_url: "https://cdn.aivo.ai/aac-symbols/core.thirsty.svg",   category: "need",    frequency_rank: 20 },
  { symbol_id: "core.bathroom",  label: "bathroom",   image_url: "https://cdn.aivo.ai/aac-symbols/core.bathroom.svg",  category: "need",    frequency_rank: 21 },
  { symbol_id: "core.play",      label: "play",       image_url: "https://cdn.aivo.ai/aac-symbols/core.play.svg",      category: "action",  frequency_rank: 22 },
  { symbol_id: "core.eat",       label: "eat",        image_url: "https://cdn.aivo.ai/aac-symbols/core.eat.svg",       category: "action",  frequency_rank: 23 },
  { symbol_id: "core.drink",     label: "drink",      image_url: "https://cdn.aivo.ai/aac-symbols/core.drink.svg",     category: "action",  frequency_rank: 24 },
  { symbol_id: "core.read",      label: "read",       image_url: "https://cdn.aivo.ai/aac-symbols/core.read.svg",      category: "action",  frequency_rank: 25 },
  { symbol_id: "core.look",      label: "look",       image_url: "https://cdn.aivo.ai/aac-symbols/core.look.svg",      category: "action",  frequency_rank: 26 },
  { symbol_id: "core.listen",    label: "listen",     image_url: "https://cdn.aivo.ai/aac-symbols/core.listen.svg",    category: "action",  frequency_rank: 27 },
  { symbol_id: "core.again",     label: "again",      image_url: "https://cdn.aivo.ai/aac-symbols/core.again.svg",     category: "core",    frequency_rank: 28 },
  { symbol_id: "core.please",    label: "please",     image_url: "https://cdn.aivo.ai/aac-symbols/core.please.svg",    category: "social",  frequency_rank: 29 },
  { symbol_id: "core.thank_you", label: "thank you",  image_url: "https://cdn.aivo.ai/aac-symbols/core.thank_you.svg", category: "social",  frequency_rank: 30 },
];
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

      // Sprint 12.5: pull the AAC board from brain-svc, which composes
      // vocabulary from active IEP goals + the curriculum unit. On any
      // brain-svc failure (network/5xx/404) we fall back to a minimal
      // core board so the screen never renders empty.
      const remoteBoard = await fetchAacBoard(learnerId);
      const items = remoteBoard?.items ?? DEFAULT_AAC_BOARD;
      const rows = Math.max(1, Math.ceil(Math.sqrt(items.length)));
      const cols = Math.max(1, Math.ceil(items.length / rows));
      const board: SymbolBoard = {
        id: learnerId,
        name: `AIVO - ${learnerId}`,
        locale: "en",
        items: items.map((it, i) => ({
          id: it.symbol_id,
          label: it.label,
          imageUrl: it.image_url,
          boardId: learnerId,
          position: { row: Math.floor(i / cols), col: i % cols },
        })),
        grid: { rows, cols },
      };

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
