import { test } from "node:test";
import assert from "node:assert";
import {
  isInternalRole, refreshTtlMs, deviceFingerprint,
  INTERNAL_REFRESH_TTL_MS, MFA_FRESHNESS_MS,
} from "../src/services/admin-session.js";

test("isInternalRole identifies all 8 internal roles", () => {
  for (const r of ["PLATFORM_ADMIN", "DISTRICT_ADMIN", "SALES", "MARKETING", "CUSTOMER_CARE", "SUPPORT", "FINANCE", "DEVOPS"]) {
    assert.equal(isInternalRole(r), true, `${r} should be internal`);
  }
  for (const r of ["PARENT", "GUARDIAN", "TEACHER", "STUDENT", "LEARNER"]) {
    assert.equal(isInternalRole(r), false, `${r} should not be internal`);
  }
});

test("refreshTtlMs returns 12h for internal, 30d for consumer", () => {
  assert.equal(refreshTtlMs("PLATFORM_ADMIN"), INTERNAL_REFRESH_TTL_MS);
  assert.equal(refreshTtlMs("PARENT"), 30 * 24 * 60 * 60 * 1000);
});

test("deviceFingerprint is deterministic and changes with UA", () => {
  const a = deviceFingerprint({ "user-agent": "Mozilla/5.0", "accept-language": "en", "sec-ch-ua": "Chromium" });
  const b = deviceFingerprint({ "user-agent": "Mozilla/5.0", "accept-language": "en", "sec-ch-ua": "Chromium" });
  const c = deviceFingerprint({ "user-agent": "curl/8", "accept-language": "en", "sec-ch-ua": "Chromium" });
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.equal(a.length, 64);
});

const SKIP = !process.env.DATABASE_URL;
test("idle gate rejects after 241 minutes, accepts when fresh", { skip: SKIP }, async () => {
  const { createDb, adminSessions, users, closeDb } = await import("@aivo/db");
  const { gateAdminRefresh, recordAdminLogin } = await import("../src/services/admin-session.js");
  const { eq } = await import("drizzle-orm");
  const db = createDb(process.env.DATABASE_URL!);
  try {
    const headers = { "user-agent": "test/1", "accept-language": "en", "sec-ch-ua": "test" };
    const sessionId = `test-${Date.now()}-${Math.random()}`;
    const [u] = await db.select().from(users).limit(1);
    if (!u) return;
    await recordAdminLogin(db, u.id, sessionId, headers, "127.0.0.1");

    const fresh = await gateAdminRefresh(db, sessionId, u.id, headers, "127.0.0.1");
    assert.equal(fresh.ok, true, "fresh session must pass");

    await db.update(adminSessions)
      .set({ lastActivityAt: new Date(Date.now() - 241 * 60_000) })
      .where(eq(adminSessions.sessionId, sessionId));
    const stale = await gateAdminRefresh(db, sessionId, u.id, headers, "127.0.0.1");
    assert.equal(stale.ok, false, "stale session must reject");
    if (!stale.ok) assert.equal(stale.body.reason, "idle");
  } finally {
    await closeDb(db);
  }
});

test("fingerprint mismatch returns mfaPending", { skip: SKIP }, async () => {
  const { createDb, users, closeDb } = await import("@aivo/db");
  const { gateAdminRefresh, recordAdminLogin } = await import("../src/services/admin-session.js");
  const db = createDb(process.env.DATABASE_URL!);
  try {
    const sessionId = `test-fp-${Date.now()}`;
    const [u] = await db.select().from(users).limit(1);
    if (!u) return;
    await recordAdminLogin(db, u.id, sessionId, { "user-agent": "browser-A" }, "127.0.0.1");
    const result = await gateAdminRefresh(db, sessionId, u.id, { "user-agent": "browser-B" }, "127.0.0.1");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.body.mfaPending, true);
      assert.equal(result.body.reason, "device");
    }
  } finally {
    await closeDb(db);
  }
});

void MFA_FRESHNESS_MS;
