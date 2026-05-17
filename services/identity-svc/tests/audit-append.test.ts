import { test } from "node:test";
import assert from "node:assert";
import { computeAuditHash, canonicalize } from "@aivo/security";

test("computeAuditHash is deterministic and order-independent", () => {
  const a = computeAuditHash("", { b: 2, a: 1, c: 3 });
  const b = computeAuditHash("", { c: 3, a: 1, b: 2 });
  assert.equal(a, b, "hash must not depend on key order");
  assert.equal(a.length, 64);
});

test("canonicalize sorts keys, drops undefined, ISO-formats dates", () => {
  const t = new Date("2026-04-20T00:00:00Z");
  assert.equal(
    canonicalize({ z: 1, a: undefined, b: t, nested: { y: 2, x: 1 } }),
    `{"b":"2026-04-20T00:00:00.000Z","nested":{"x":1,"y":2},"z":1}`,
  );
});

test("hash chain links: changing prevHash changes hash", () => {
  const payload = { eventType: "TEST", userId: "u1" };
  const h1 = computeAuditHash("", payload);
  const h2 = computeAuditHash(h1, payload);
  const h3 = computeAuditHash("ffff", payload);
  assert.notEqual(h1, h2);
  assert.notEqual(h2, h3);
});

const SKIP = !process.env.DATABASE_URL;
test("audit_events trigger blocks UPDATE", { skip: SKIP }, async () => {
  const { createDb, auditEvents, appendAudit, closeDb } = await import("@aivo/db");
  const { sql } = await import("drizzle-orm");
  const db = createDb(process.env.DATABASE_URL!);
  try {
    const inserted = await appendAudit(db, "audit_events", auditEvents, {
      tenantId: null,
      userId: null,
      eventType: "TEST_TRIGGER",
      resourceType: "test",
      resourceId: "trigger-test",
      details: { ts: Date.now() },
      ipAddress: null,
      userAgent: null,
    });
    await assert.rejects(
      () => db.execute(sql`UPDATE audit_events SET event_type = 'HACKED' WHERE id = ${inserted.id}`),
      /append-only/i,
      "trigger must reject UPDATE",
    );
    await assert.rejects(
      () => db.execute(sql`DELETE FROM audit_events WHERE id = ${inserted.id}`),
      /append-only/i,
      "trigger must reject DELETE",
    );
  } finally {
    await closeDb(db);
  }
});

test("appendAudit links rows: row N+1 prevHash equals row N hash", { skip: SKIP }, async () => {
  const { createDb, auditEvents, appendAudit, closeDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);
  try {
    const r1 = await appendAudit(db, "audit_events", auditEvents, {
      tenantId: null, userId: null,
      eventType: "CHAIN_TEST_1", resourceType: "test", resourceId: String(Date.now()),
      details: null, ipAddress: null, userAgent: null,
    });
    const r2 = await appendAudit(db, "audit_events", auditEvents, {
      tenantId: null, userId: null,
      eventType: "CHAIN_TEST_2", resourceType: "test", resourceId: String(Date.now() + 1),
      details: null, ipAddress: null, userAgent: null,
    });
    assert.equal(r2.prevHash, r1.hash, "row 2 must link to row 1");
  } finally {
    await closeDb(db);
  }
});
