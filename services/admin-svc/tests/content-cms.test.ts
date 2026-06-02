/**
 * Tests for the content-CMS read/validate/publish route. The store is
 * in-memory so these tests don't need a database — they exercise the
 * Fastify wiring directly.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { registerContentCmsRoutes, _resetPackStoreForTest } from "../src/routes/content-cms.js";

async function bootstrap() {
  _resetPackStoreForTest();
  const app = Fastify({ logger: false });
  registerContentCmsRoutes(app);
  await app.ready();
  return app;
}

test("GET /packs lists the seeded packs", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({ method: "GET", url: "/api/admin/content-cms/packs" });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { count: number; packs: Array<{ id: string; status: string }> };
    assert.ok(body.count >= 1);
    assert.equal(body.packs[0].id, "k-math-fall-2026");
    assert.equal(body.packs[0].status, "draft");
  } finally {
    await app.close();
  }
});

test("GET /packs/:id returns the full pack", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/content-cms/packs/k-math-fall-2026",
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { pack: { activities: unknown[] } };
    assert.ok(Array.isArray(body.pack.activities));
  } finally {
    await app.close();
  }
});

test("GET /packs/:id 404s for unknown id", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/content-cms/packs/no-such-pack",
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("POST /packs/validate rejects bodies missing pack", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/content-cms/packs/validate",
      payload: {},
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await app.close();
  }
});

test("POST /packs/validate flags issues in a malformed pack", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/content-cms/packs/validate",
      payload: { pack: { id: "", title: "" } },
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { ok: boolean; issueCount: number };
    assert.equal(body.ok, false);
    assert.ok(body.issueCount > 0);
  } finally {
    await app.close();
  }
});

test("POST /packs/:id/publish flips status to published when validation passes", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/content-cms/packs/k-math-fall-2026/publish",
    });
    assert.equal(res.statusCode, 200);
    const body = res.json() as { status: string };
    assert.equal(body.status, "published");

    // The list endpoint must reflect the new status.
    const list = await app.inject({ method: "GET", url: "/api/admin/content-cms/packs" });
    const pack = (list.json() as any).packs.find((p: any) => p.id === "k-math-fall-2026");
    assert.equal(pack.status, "published");
    assert.equal(pack.lastValidation.ok, true);
  } finally {
    await app.close();
  }
});

test("POST /packs/:id/publish 404s for unknown id", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/content-cms/packs/no-such/publish",
    });
    assert.equal(res.statusCode, 404);
  } finally {
    await app.close();
  }
});

test("POST /packs creates a pack that is then listable + publishable", async () => {
  const app = await bootstrap();
  try {
    const pack = {
      id: "g1-reading-spring-2026",
      title: "G1 Reading Spring 2026",
      version: "1.0.0",
      schemaVersion: 1,
      subject: "reading",
      gradeBand: "1",
      skillGraphRefs: ["ccss.ela.1.rf"],
      publisher: { name: "AIVO" },
      license: "Proprietary",
      publishedAt: "2026-03-01T00:00:00Z",
      assets: [],
      activities: [
        {
          id: "a-letter-a",
          title: "Letter A",
          skillId: "ccss.ela.1.rf.1",
          type: "tap",
          prompt: "Tap A.",
          difficulty: "intro",
          choices: [{ id: "ok", label: "A", correct: true }],
        },
      ],
    };
    const create = await app.inject({
      method: "POST",
      url: "/api/admin/content-cms/packs",
      payload: { pack },
    });
    assert.equal(create.statusCode, 201);

    const detail = await app.inject({
      method: "GET",
      url: "/api/admin/content-cms/packs/g1-reading-spring-2026",
    });
    assert.equal(detail.statusCode, 200);
    assert.equal((detail.json() as any).lastValidation.ok, true);

    const publish = await app.inject({
      method: "POST",
      url: "/api/admin/content-cms/packs/g1-reading-spring-2026/publish",
    });
    assert.equal(publish.statusCode, 200);
    assert.equal((publish.json() as any).status, "published");
  } finally {
    await app.close();
  }
});

test("POST /packs rejects an invalid pack", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({
      method: "POST",
      url: "/api/admin/content-cms/packs",
      payload: { pack: { id: "", title: "" } },
    });
    assert.equal(res.statusCode, 400);
  } finally {
    await app.close();
  }
});
