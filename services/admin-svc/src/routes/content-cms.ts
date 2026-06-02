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
 * Storage (Sprint 5 — durable): when a Drizzle `db` handle is supplied the
 * packs live in the `content_packs` postgres table, so validate/publish state
 * survives a restart and is shared across replicas. When no `db` is supplied
 * (unit tests / stateless dev) an in-memory store seeded from SEED_PACKS is
 * used, mirroring the dual-path convention used by billing/family surfaces.
 */
import type { FastifyInstance } from "fastify";
import { eq } from "drizzle-orm";
import { contentPacks } from "@aivo/db";
import { validateContentPack, type ContentPack } from "@aivo/content-pack";

interface ValidationSummary {
  ok: boolean;
  issueCount: number;
  ranAt: string;
}

interface PackRecord {
  id: string;
  title: string;
  version: string;
  subject: string;
  gradeBand: string;
  status: "draft" | "published";
  updatedAt: string;
  lastValidation?: ValidationSummary;
  pack: ContentPack;
}

type PackSummary = Omit<PackRecord, "pack">;

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

function recordFromPack(p: ContentPack, status: "draft" | "published" = "draft"): PackRecord {
  return {
    id: p.id,
    title: p.title,
    version: p.version,
    subject: p.subject,
    gradeBand: p.gradeBand,
    status,
    updatedAt: new Date(0).toISOString(),
    pack: p,
  };
}

/**
 * Storage contract. Two implementations: a Postgres-backed store (prod) and an
 * in-memory store (tests / stateless dev). Both expose the same async surface.
 */
interface PackStore {
  list(): Promise<PackSummary[]>;
  get(id: string): Promise<PackRecord | null>;
  upsert(pack: ContentPack): Promise<PackRecord>;
  setValidation(id: string, v: ValidationSummary): Promise<void>;
  publish(id: string, ranAt: string): Promise<PackRecord | null>;
}

// ─────────────────────────── In-memory store ───────────────────────────

/** In-memory store. Exported for tests. */
export const _packStore: Map<string, PackRecord> = new Map();

function seedMemory(): void {
  _packStore.clear();
  for (const p of SEED_PACKS) _packStore.set(p.id, recordFromPack(p));
}
seedMemory();

/** Test hook — clear state between tests. */
export function _resetPackStoreForTest(): void {
  seedMemory();
}

const memoryStore: PackStore = {
  async list() {
    const rows = Array.from(_packStore.values()).map(({ pack: _pack, ...rest }) => rest);
    rows.sort((a, b) => a.id.localeCompare(b.id));
    return rows;
  },
  async get(id) {
    return _packStore.get(id) ?? null;
  },
  async upsert(pack) {
    const existing = _packStore.get(pack.id);
    const rec = recordFromPack(pack, existing?.status ?? "draft");
    rec.updatedAt = new Date().toISOString();
    rec.lastValidation = existing?.lastValidation;
    _packStore.set(pack.id, rec);
    return rec;
  },
  async setValidation(id, v) {
    const r = _packStore.get(id);
    if (r) r.lastValidation = v;
  },
  async publish(id, ranAt) {
    const r = _packStore.get(id);
    if (!r) return null;
    r.status = "published";
    r.updatedAt = ranAt;
    return r;
  },
};

// ─────────────────────────── Postgres store ───────────────────────────

type Db = ReturnType<typeof import("@aivo/db").createDb>;

function rowToRecord(row: Record<string, unknown>): PackRecord {
  return {
    id: row.packKey as string,
    title: row.title as string,
    version: row.version as string,
    subject: row.subject as string,
    gradeBand: row.gradeBand as string,
    status: row.status as "draft" | "published",
    updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
    lastValidation: (row.lastValidation as ValidationSummary | null) ?? undefined,
    pack: row.pack as ContentPack,
  };
}

function dbStore(db: Db): PackStore {
  return {
    async list() {
      const rows = (await db.select().from(contentPacks)) as unknown as Record<string, unknown>[];
      return rows
        .map((r) => {
          const { pack: _pack, ...rest } = rowToRecord(r);
          return rest;
        })
        .sort((a, b) => a.id.localeCompare(b.id));
    },
    async get(id) {
      const rows = (await db
        .select()
        .from(contentPacks)
        .where(eq(contentPacks.packKey, id))
        .limit(1)) as unknown as Record<string, unknown>[];
      return rows[0] ? rowToRecord(rows[0]) : null;
    },
    async upsert(pack) {
      const now = new Date();
      const values = {
        packKey: pack.id,
        title: pack.title,
        version: pack.version,
        subject: pack.subject,
        gradeBand: pack.gradeBand,
        pack,
        updatedAt: now,
      };
      const [row] = (await db
        .insert(contentPacks)
        .values(values)
        .onConflictDoUpdate({
          target: contentPacks.packKey,
          set: {
            title: values.title,
            version: values.version,
            subject: values.subject,
            gradeBand: values.gradeBand,
            pack: values.pack,
            updatedAt: now,
          },
        })
        .returning()) as unknown as Record<string, unknown>[];
      return rowToRecord(row);
    },
    async setValidation(id, v) {
      await db
        .update(contentPacks)
        .set({ lastValidation: v, updatedAt: new Date() })
        .where(eq(contentPacks.packKey, id));
    },
    async publish(id, ranAt) {
      const [row] = (await db
        .update(contentPacks)
        .set({ status: "published", updatedAt: new Date(ranAt) })
        .where(eq(contentPacks.packKey, id))
        .returning()) as unknown as Record<string, unknown>[];
      return row ? rowToRecord(row) : null;
    },
  };
}

/**
 * Seed the demo pack into an empty table outside production, so dev/staging
 * keep a working validate→publish target. Production starts empty; real packs
 * arrive via the create endpoint / authoring pipeline.
 */
async function seedDbIfDevEmpty(store: PackStore): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const existing = await store.list();
  if (existing.length > 0) return;
  for (const p of SEED_PACKS) await store.upsert(p);
}

// ─────────────────────────────── Routes ───────────────────────────────

export function registerContentCmsRoutes(app: FastifyInstance, db?: Db): void {
  const store: PackStore = db ? dbStore(db) : memoryStore;
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
