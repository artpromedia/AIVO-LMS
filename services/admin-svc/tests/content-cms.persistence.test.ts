/**
 * Cross-replica persistence test for admin-svc content-cms.
 *
 * Boots two Fastify instances against the SAME postgres database (each with
 * its own Drizzle handle, mimicking two replicas). Asserts:
 *
 *   1. A pack published via instance A is visible from instance B's GET list
 *      and GET detail — i.e. state is in the DB, not a per-process Map.
 *   2. A pack created via instance A persists past instance A's shutdown and
 *      is still served by instance B (the actual "survives a restart"
 *      contract Sprint 5 was meant to guarantee).
 *
 * Skipped without DATABASE_URL — same convention as other integration tests
 * in this service (api-keys, jobs, scheduler-crash-recovery).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";

const SKIP = !process.env.DATABASE_URL;

const PACK_ID = `persistence-test-${process.pid}-${Date.now()}`;

function makePack(id: string): unknown {
  return {
    id,
    title: "Persistence Test Pack",
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
        id: "a-1",
        title: "Tap",
        skillId: "ccss.math.k.cc.a.1",
        type: "tap",
        prompt: "Tap.",
        difficulty: "intro",
        choices: [{ id: "ok", label: "OK", correct: true }],
      },
    ],
  };
}

async function bootReplica() {
  const { registerContentCmsRoutes } = await import("../src/routes/content-cms.js");
  const { createDb, closeDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  registerContentCmsRoutes(app, db);
  await app.ready();
  return { app, db, closeDb };
}

test(
  "content-pack state survives across replicas (instance A publishes, instance B sees)",
  { skip: SKIP },
  async () => {
    const a = await bootReplica();
    const b = await bootReplica();
    try {
      // Replica A: create + publish.
      const createRes = await a.app.inject({
        method: "POST",
        url: "/api/admin/content-cms/packs",
        payload: { pack: makePack(PACK_ID) },
      });
      assert.equal(createRes.statusCode, 201, createRes.body);

      const pubRes = await a.app.inject({
        method: "POST",
        url: `/api/admin/content-cms/packs/${PACK_ID}/publish`,
      });
      assert.equal(pubRes.statusCode, 200, pubRes.body);
      assert.equal((pubRes.json() as { status: string }).status, "published");

      // Replica B: list — must include the pack with status=published.
      const listRes = await b.app.inject({
        method: "GET",
        url: "/api/admin/content-cms/packs",
      });
      assert.equal(listRes.statusCode, 200);
      const list = listRes.json() as { packs: Array<{ id: string; status: string }> };
      const found = list.packs.find((p) => p.id === PACK_ID);
      assert.ok(found, "replica B should see the pack created by replica A");
      assert.equal(found!.status, "published");

      // Replica B: detail — must echo the same pack body.
      const detailRes = await b.app.inject({
        method: "GET",
        url: `/api/admin/content-cms/packs/${PACK_ID}`,
      });
      assert.equal(detailRes.statusCode, 200);
      const detail = detailRes.json() as { id: string; pack: { id: string } };
      assert.equal(detail.id, PACK_ID);
      assert.equal(detail.pack.id, PACK_ID);
    } finally {
      // Cleanup: drop the test row, then shut both replicas down.
      try {
        const { eq } = await import("drizzle-orm");
        const { contentPacks } = await import("@aivo/db");
        await b.db.delete(contentPacks).where(eq(contentPacks.packKey, PACK_ID));
      } catch {
        // swallow — primary assertion already ran
      }
      await a.app.close();
      await b.app.close();
      await a.closeDb();
      await b.closeDb();
    }
  },
);

test(
  "content-pack survives replica A shutdown (durability across restart)",
  { skip: SKIP },
  async () => {
    const restartId = `${PACK_ID}-restart`;
    const a = await bootReplica();
    try {
      const r = await a.app.inject({
        method: "POST",
        url: "/api/admin/content-cms/packs",
        payload: { pack: makePack(restartId) },
      });
      assert.equal(r.statusCode, 201, r.body);
    } finally {
      await a.app.close();
      await a.closeDb();
    }

    // Fresh replica with a fresh DB handle — analogous to a new process
    // after a deploy / crash.
    const b = await bootReplica();
    try {
      const detailRes = await b.app.inject({
        method: "GET",
        url: `/api/admin/content-cms/packs/${restartId}`,
      });
      assert.equal(detailRes.statusCode, 200, "pack must survive replica A shutdown");
    } finally {
      try {
        const { eq } = await import("drizzle-orm");
        const { contentPacks } = await import("@aivo/db");
        await b.db.delete(contentPacks).where(eq(contentPacks.packKey, restartId));
      } catch {
        // swallow
      }
      await b.app.close();
      await b.closeDb();
    }
  },
);

test("createPackStore refuses memory in production", { skip: false }, async () => {
  const { createPackStore } = await import("../src/lib/pack-store.js");
  const prevNode = process.env.NODE_ENV;
  const prevPers = process.env.AIVO_PERSISTENCE;
  try {
    process.env.NODE_ENV = "production";
    delete process.env.AIVO_PERSISTENCE;
    assert.throws(() => createPackStore(undefined), /requires a database handle/i);

    process.env.AIVO_PERSISTENCE = "memory";
    assert.throws(() => createPackStore(undefined), /not allowed in production/i);
  } finally {
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
    if (prevPers === undefined) delete process.env.AIVO_PERSISTENCE;
    else process.env.AIVO_PERSISTENCE = prevPers;
  }
});
