/**
 * Content CMS API for admin-svc (§9.3 Greenfield 8w).
 *
 *   GET  /api/admin/content-cms/packs              → list registered packs
 *   GET  /api/admin/content-cms/packs/:id          → pack detail
 *   POST /api/admin/content-cms/packs              → create/upsert a pack
 *                                                    (validates, stores as draft)
 *   POST /api/admin/content-cms/packs/validate     → run @aivo/content-pack
 *                                                    validator on a posted pack
 *   POST /api/admin/content-cms/packs/:id/publish  → mark a pack as published
 *
 * Storage lives in `services/admin-svc/src/lib/pack-store.ts`. Sprint 5 moved
 * the validate/publish lifecycle off a process-local Map (data loss on
 * restart, no cross-replica visibility) onto the durable `content_packs`
 * postgres table. This file is HTTP glue only.
 */
import type { FastifyInstance } from "fastify";
import {
  createPackStore,
  seedDbIfDevEmpty,
  validateContentPack,
  _resetPackStoreForTest as _reset,
  type ContentPack,
  type Db,
  type PackStore,
} from "../lib/pack-store.js";

export const _resetPackStoreForTest = _reset;

export function registerContentCmsRoutes(app: FastifyInstance, db?: Db): void {
  const store: PackStore = createPackStore(db);
  if (db) void seedDbIfDevEmpty(store);

  app.get(
    "/api/admin/content-cms/packs",
    { schema: { tags: ["content-cms"], security: [{ bearerAuth: [] }] } },
    async () => {
      const packs = await store.list();
      return { packs, count: packs.length };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/admin/content-cms/packs/:id",
    { schema: { tags: ["content-cms"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      const r = await store.get(req.params.id);
      if (!r) return reply.status(404).send({ error: "Pack not found" });
      return r;
    },
  );

  app.post<{ Body: { pack?: unknown } }>(
    "/api/admin/content-cms/packs/validate",
    {
      schema: {
        tags: ["content-cms"],
        security: [{ bearerAuth: [] }],
        body: { type: "object", properties: { pack: { type: "object" } } },
      },
    },
    async (req, reply) => {
      const body = req.body ?? {};
      const candidate = body.pack;
      if (!candidate || typeof candidate !== "object") {
        return reply.status(400).send({ error: "Body must include a `pack` object." });
      }
      try {
        const issues = validateContentPack(candidate as ContentPack);
        return { ok: issues.length === 0, issueCount: issues.length, issues };
      } catch (err) {
        return reply.status(400).send({
          ok: false,
          issueCount: 1,
          issues: [{ code: "validator_error", detail: (err as Error).message }],
        });
      }
    },
  );

  app.post<{ Body: { pack?: unknown } }>(
    "/api/admin/content-cms/packs",
    {
      schema: {
        tags: ["content-cms"],
        security: [{ bearerAuth: [] }],
        body: { type: "object", properties: { pack: { type: "object" } } },
      },
    },
    async (req, reply) => {
      const candidate = (req.body ?? {}).pack;
      if (!candidate || typeof candidate !== "object") {
        return reply.status(400).send({ error: "Body must include a `pack` object." });
      }
      const issues = validateContentPack(candidate as ContentPack);
      if (issues.length > 0) {
        return reply.status(400).send({
          error: "Pack failed validation; not stored.",
          issueCount: issues.length,
          issues,
        });
      }
      const ranAt = new Date().toISOString();
      const rec = await store.upsert(candidate as ContentPack);
      await store.setValidation(rec.id, { ok: true, issueCount: 0, ranAt });
      return reply.status(201).send({ id: rec.id, status: rec.status, updatedAt: rec.updatedAt });
    },
  );

  app.post<{ Params: { id: string } }>(
    "/api/admin/content-cms/packs/:id/publish",
    { schema: { tags: ["content-cms"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      const r = await store.get(req.params.id);
      if (!r) return reply.status(404).send({ error: "Pack not found" });

      const issues = validateContentPack(r.pack);
      const ranAt = new Date().toISOString();
      await store.setValidation(r.id, {
        ok: issues.length === 0,
        issueCount: issues.length,
        ranAt,
      });

      if (issues.length > 0) {
        return reply.status(409).send({
          error: "Pack failed validation; cannot publish.",
          issueCount: issues.length,
          issues,
        });
      }
      const published = await store.publish(r.id, ranAt);
      return { id: r.id, status: published?.status ?? "published", publishedAt: ranAt };
    },
  );
}
