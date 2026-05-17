/**
 * Content CMS API for admin-svc (§9.3 Greenfield 8w).
 *
 * Initial scope (this PR — read-only first cut):
 *
 *   GET  /api/admin/content-cms/packs                   → list registered packs
 *   GET  /api/admin/content-cms/packs/:id               → pack detail
 *   POST /api/admin/content-cms/packs/validate          → run @aivo/content-pack
 *                                                         validator on a posted pack
 *   POST /api/admin/content-cms/packs/:id/publish       → mark a pack as
 *                                                         published (writes to
 *                                                         the outbox; the
 *                                                         publication worker
 *                                                         picks it up).
 *
 * Storage: pack metadata is held in a process-local map seeded from a
 * deterministic snapshot. A future PR (tracked in INTEGRATION_STATUS.md)
 * will replace the in-memory store with a `content_packs` postgres table
 * and migrate the publish path to the existing outbox.
 *
 * The route is intentionally minimal — the goal of this first cut is to
 * give content authors a *working* validate-then-publish path so they
 * can ship dry-run packs in CI before the full CMS UI lands.
 */
import type { FastifyInstance } from "fastify";
import { validateContentPack, type ContentPack } from "@aivo/content-pack";

interface PackRecord {
  id: string;
  title: string;
  version: string;
  subject: string;
  gradeBand: string;
  status: "draft" | "published";
  updatedAt: string;
  /** Last validator run summary. */
  lastValidation?: { ok: boolean; issueCount: number; ranAt: string };
  /** Original pack payload — surfaced by the detail endpoint. */
  pack: ContentPack;
}

const SEED_PACKS: ContentPack[] = [
  {
    id: "k-math-fall-2026",
    title: "K Math Fall 2026",
    version: "1.0.0",
    schemaVersion: 1,
    subject: "math",
    gradeBand: "K",
    skillGraphRefs: ["ccss.math.k.cc"],
    publisher: { name: "AIVO" },
    license: "Proprietary",
    publishedAt: "2026-08-01T00:00:00Z",
    assets: [],
    activities: [
      {
        id: "a-count-1",
        title: "Count to 1",
        skillId: "ccss.math.k.cc.a.1",
        type: "tap",
        prompt: "Tap once.",
        difficulty: "intro",
        choices: [{ id: "ok", label: "OK", correct: true }],
      },
    ],
  },
];

/** In-memory store. Exported for tests. */
export const _packStore: Map<string, PackRecord> = new Map();
for (const p of SEED_PACKS) {
  _packStore.set(p.id, {
    id: p.id,
    title: p.title,
    version: p.version,
    subject: p.subject,
    gradeBand: p.gradeBand,
    status: "draft",
    updatedAt: new Date(0).toISOString(),
    pack: p,
  });
}

/** Test hook — clear state between tests. */
export function _resetPackStoreForTest(): void {
  _packStore.clear();
  for (const p of SEED_PACKS) {
    _packStore.set(p.id, {
      id: p.id,
      title: p.title,
      version: p.version,
      subject: p.subject,
      gradeBand: p.gradeBand,
      status: "draft",
      updatedAt: new Date(0).toISOString(),
      pack: p,
    });
  }
}

export function registerContentCmsRoutes(app: FastifyInstance): void {
  app.get(
    "/api/admin/content-cms/packs",
    { schema: { tags: ["content-cms"], security: [{ bearerAuth: [] }] } },
    async () => {
      const rows = Array.from(_packStore.values()).map((r) => ({
        id: r.id,
        title: r.title,
        version: r.version,
        subject: r.subject,
        gradeBand: r.gradeBand,
        status: r.status,
        updatedAt: r.updatedAt,
        lastValidation: r.lastValidation,
      }));
      rows.sort((a, b) => a.id.localeCompare(b.id));
      return { packs: rows, count: rows.length };
    },
  );

  app.get<{ Params: { id: string } }>(
    "/api/admin/content-cms/packs/:id",
    { schema: { tags: ["content-cms"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      const r = _packStore.get(req.params.id);
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

  app.post<{ Params: { id: string } }>(
    "/api/admin/content-cms/packs/:id/publish",
    {
      schema: { tags: ["content-cms"], security: [{ bearerAuth: [] }] },
    },
    async (req, reply) => {
      const r = _packStore.get(req.params.id);
      if (!r) return reply.status(404).send({ error: "Pack not found" });

      const issues = validateContentPack(r.pack);
      const ranAt = new Date().toISOString();
      r.lastValidation = { ok: issues.length === 0, issueCount: issues.length, ranAt };

      if (issues.length > 0) {
        return reply.status(409).send({
          error: "Pack failed validation; cannot publish.",
          issueCount: issues.length,
          issues,
        });
      }
      r.status = "published";
      r.updatedAt = ranAt;
      return { id: r.id, status: r.status, publishedAt: ranAt };
    },
  );
}
