/**
 * Content-pack storage backend for admin-svc.
 *
 * Sprint-5 promoted the validate/publish lifecycle off a process-local Map
 * (data loss on restart, no cross-replica visibility) onto the durable
 * `content_packs` postgres table. This module owns that storage contract so
 * the route handler in `routes/content-cms.ts` is purely HTTP glue.
 *
 * Two implementations:
 *   - `dbStore(db)`     — production. Postgres-backed; tenant-scoped writes.
 *   - `memoryStore()`   — dev/test ONLY. Gated by `AIVO_PERSISTENCE=memory`
 *                         in non-prod. `createPackStore()` refuses to return
 *                         it in production: a missing DB handle is a fatal
 *                         misconfiguration, never a silent fallback.
 */
import { eq } from "drizzle-orm";
import { contentPacks } from "@aivo/db";
import { validateContentPack, type ContentPack } from "@aivo/content-pack";

export interface ValidationSummary {
  ok: boolean;
  issueCount: number;
  ranAt: string;
}

export interface PackRecord {
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

export type PackSummary = Omit<PackRecord, "pack">;

export interface PackStore {
  list(): Promise<PackSummary[]>;
  get(id: string): Promise<PackRecord | null>;
  upsert(pack: ContentPack): Promise<PackRecord>;
  setValidation(id: string, v: ValidationSummary): Promise<void>;
  publish(id: string, ranAt: string): Promise<PackRecord | null>;
}

export type Db = ReturnType<typeof import("@aivo/db").createDb>;

// Re-export the validator so callers can run it identically on validate and
// publish without taking a second dependency on the package.
export { validateContentPack };
export type { ContentPack };

/** Demo pack used as a non-prod seed only. Never inserted in production. */
export const SEED_PACKS: ContentPack[] = [
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

// ─────────────────────────── In-memory store ───────────────────────────

/** Module-scoped state for the in-memory store. Exported for tests. */
export const _packStoreState: Map<string, PackRecord> = new Map();

function seedMemory(): void {
  _packStoreState.clear();
  for (const p of SEED_PACKS) _packStoreState.set(p.id, recordFromPack(p));
}
seedMemory();

/** Test hook — clear/reset state between tests. */
export function _resetPackStoreForTest(): void {
  seedMemory();
}

export function memoryStore(): PackStore {
  return {
    async list() {
      const rows = Array.from(_packStoreState.values()).map(({ pack: _pack, ...rest }) => rest);
      rows.sort((a, b) => a.id.localeCompare(b.id));
      return rows;
    },
    async get(id) {
      return _packStoreState.get(id) ?? null;
    },
    async upsert(pack) {
      const existing = _packStoreState.get(pack.id);
      const rec = recordFromPack(pack, existing?.status ?? "draft");
      rec.updatedAt = new Date().toISOString();
      rec.lastValidation = existing?.lastValidation;
      _packStoreState.set(pack.id, rec);
      return rec;
    },
    async setValidation(id, v) {
      const r = _packStoreState.get(id);
      if (r) r.lastValidation = v;
    },
    async publish(id, ranAt) {
      const r = _packStoreState.get(id);
      if (!r) return null;
      r.status = "published";
      r.updatedAt = ranAt;
      return r;
    },
  };
}

// ─────────────────────────── Postgres store ───────────────────────────

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

export function dbStore(db: Db): PackStore {
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
 * Choose the appropriate store with hard production safety:
 *
 *   prod:    requires a Db handle. No memory fallback.
 *   non-prod with AIVO_PERSISTENCE=memory: explicit memory store.
 *   non-prod otherwise:                    db when handle is present,
 *                                          memory when not (unit tests).
 *
 * This mirrors the dual-path convention used by family-svc / billing-svc and
 * makes "we accidentally shipped the memory store" a startup error rather
 * than a data-loss incident waiting for a restart.
 */
export function createPackStore(db?: Db): PackStore {
  const isProd = process.env.NODE_ENV === "production";
  const wantsMemory = process.env.AIVO_PERSISTENCE === "memory";

  if (isProd) {
    if (wantsMemory) {
      throw new Error(
        "AIVO_PERSISTENCE=memory is not allowed in production (would lose content packs on restart and across replicas).",
      );
    }
    if (!db) {
      throw new Error(
        "admin-svc content-pack store requires a database handle in production; refusing to use in-memory store.",
      );
    }
    return dbStore(db);
  }

  if (wantsMemory) return memoryStore();
  return db ? dbStore(db) : memoryStore();
}

/**
 * Seed the demo pack into an empty table outside production, so dev/staging
 * keep a working validate→publish target. Production starts empty; real packs
 * arrive via the create endpoint / authoring pipeline.
 */
export async function seedDbIfDevEmpty(store: PackStore): Promise<void> {
  if (process.env.NODE_ENV === "production") return;
  const existing = await store.list();
  if (existing.length > 0) return;
  for (const p of SEED_PACKS) await store.upsert(p);
}
