/**
 * Device-token registry + user-addressed push (comms-svc).
 *
 * Exercises the real route handlers via app.inject:
 *   - POST   /api/comms/devices        register/refresh the caller's token
 *   - DELETE /api/comms/devices/:token unregister (owner-scoped)
 *   - POST   /api/comms/push           resolve userId -> tokens, fan out
 *
 * DB-backed; skips when DATABASE_URL is absent. Actual FCM/APNs delivery is
 * gated on provider credentials — without them the push-router returns a
 * per-token failure (no network call), so these tests verify the resolution
 * + fan-out + pruning wiring deterministically without creds.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { createDb } = await import("@aivo/db");
  const { registerNotificationRoutes } = await import("../src/routes/notifications.js");
  const db = createDb(process.env.DATABASE_URL!);
  const app = Fastify({ logger: false });
  registerNotificationRoutes(app, db);
  await app.ready();
  return { app, db };
}

async function teardown(app: any, db: any, userId: string) {
  const { deviceTokens } = await import("@aivo/db");
  const { eq } = await import("drizzle-orm");
  try {
    await db.delete(deviceTokens).where(eq(deviceTokens.userId, userId));
  } catch {
    /* ignore */
  }
  await app.close();
  try {
    await (db as any).$client?.end?.({ timeout: 2 });
  } catch {
    /* ignore */
  }
}

async function userToken(sub: string) {
  const { signJWT } = await import("@aivo/security");
  return signJWT({ sub, role: "TEACHER", tenantId: crypto.randomUUID() }, "5m");
}
async function adminToken() {
  const { signJWT } = await import("@aivo/security");
  return signJWT(
    { sub: crypto.randomUUID(), role: "PLATFORM_ADMIN", tenantId: crypto.randomUUID() },
    "5m",
  );
}

test("device tokens: register → resolve+fan-out → unregister", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const userId = crypto.randomUUID();
  const token = `fcm_${crypto.randomBytes(12).toString("hex")}`;
  try {
    const uTok = await userToken(userId);
    const aTok = await adminToken();

    // Register a device for the caller.
    const reg = await app.inject({
      method: "POST",
      url: "/api/comms/devices",
      headers: { authorization: `Bearer ${uTok}`, "content-type": "application/json" },
      payload: { token, kind: "fcm", platform: "android" },
    });
    assert.equal(reg.statusCode, 200, reg.body);
    assert.equal(reg.json().status, "registered");

    // Re-register the same token (upsert) — must not create a duplicate.
    const reg2 = await app.inject({
      method: "POST",
      url: "/api/comms/devices",
      headers: { authorization: `Bearer ${uTok}`, "content-type": "application/json" },
      payload: { token, kind: "fcm", platform: "ios" },
    });
    assert.equal(reg2.statusCode, 200);

    // Admin push resolves the user's device(s). Delivery fails (no FCM creds)
    // but the token is resolved and attempted — and not pruned (not invalid).
    const push = await app.inject({
      method: "POST",
      url: "/api/comms/push",
      headers: { authorization: `Bearer ${aTok}`, "content-type": "application/json" },
      payload: { userId, title: "Hi", body: "there" },
    });
    assert.equal(push.statusCode, 200, push.body);
    const pushBody = push.json();
    assert.equal(pushBody.devices, 1, "exactly one device resolved (upsert, not dup)");
    assert.equal(pushBody.sent, 0, "no creds → nothing delivered");
    assert.equal(pushBody.status, "failed");

    // Unregister.
    const del = await app.inject({
      method: "DELETE",
      url: `/api/comms/devices/${encodeURIComponent(token)}`,
      headers: { authorization: `Bearer ${uTok}` },
    });
    assert.equal(del.statusCode, 200, del.body);
    assert.equal(del.json().status, "unregistered");

    // After unregister, the user has no devices.
    const push2 = await app.inject({
      method: "POST",
      url: "/api/comms/push",
      headers: { authorization: `Bearer ${aTok}`, "content-type": "application/json" },
      payload: { userId, title: "Hi again" },
    });
    assert.equal(push2.json().status, "no_devices");
    assert.equal(push2.json().sent, 0);
  } finally {
    await teardown(app, db, userId);
  }
});

test(
  "device tokens: cannot delete another user's token (owner-scoped)",
  { skip: SKIP },
  async () => {
    const { app, db } = await bootstrap();
    const ownerId = crypto.randomUUID();
    const token = `fcm_${crypto.randomBytes(12).toString("hex")}`;
    try {
      const ownerTok = await userToken(ownerId);
      const otherTok = await userToken(crypto.randomUUID());

      await app.inject({
        method: "POST",
        url: "/api/comms/devices",
        headers: { authorization: `Bearer ${ownerTok}`, "content-type": "application/json" },
        payload: { token, kind: "fcm" },
      });

      // A different user trying to delete the owner's token gets 404 (no match).
      const del = await app.inject({
        method: "DELETE",
        url: `/api/comms/devices/${encodeURIComponent(token)}`,
        headers: { authorization: `Bearer ${otherTok}` },
      });
      assert.equal(del.statusCode, 404);
    } finally {
      await teardown(app, db, ownerId);
    }
  },
);

test("push: unknown user with no devices returns no_devices", { skip: SKIP }, async () => {
  const { app, db } = await bootstrap();
  const userId = crypto.randomUUID();
  try {
    const aTok = await adminToken();
    const push = await app.inject({
      method: "POST",
      url: "/api/comms/push",
      headers: { authorization: `Bearer ${aTok}`, "content-type": "application/json" },
      payload: { userId, title: "Nobody home" },
    });
    assert.equal(push.statusCode, 200);
    assert.equal(push.json().status, "no_devices");
  } finally {
    await teardown(app, db, userId);
  }
});
