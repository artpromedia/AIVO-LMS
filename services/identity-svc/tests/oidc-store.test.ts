/**
 * Phase 2 — Postgres-backed OIDC grant store tests.
 *
 * Verifies single-use auth codes, access/refresh round-trips, and expiry.
 * DB-backed; skips when DATABASE_URL is unset (mirrors the other
 * identity-svc tests).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

const SKIP = !process.env.DATABASE_URL;

async function makeStore() {
  const { createDb } = await import("@aivo/db");
  const { OidcStore } = await import("../src/services/oidc-store");
  const db = createDb(process.env.DATABASE_URL!);
  return { store: new OidcStore(db), db };
}

function authCodeData(userId: string) {
  return {
    clientId: "client-abc",
    redirectUri: "https://app.example.com/cb",
    scope: "openid email",
    userId,
    codeChallenge: "challenge-xyz",
    nonce: "n-123",
  };
}

test("auth code: redeemable exactly once (single-use)", { skip: SKIP }, async () => {
  const { store, db } = await makeStore();
  const { closeDb } = await import("@aivo/db");
  try {
    const code = crypto.randomBytes(16).toString("base64url");
    const userId = crypto.randomUUID();
    await store.saveAuthCode(code, authCodeData(userId), 60_000);

    const first = await store.takeAuthCode(code);
    assert.ok(first);
    assert.equal(first!.expired, false);
    assert.equal(first!.userId, userId);
    assert.equal(first!.clientId, "client-abc");
    assert.equal(first!.nonce, "n-123");

    // Second redemption must fail — the row was deleted.
    const second = await store.takeAuthCode(code);
    assert.equal(second, null);
  } finally {
    await closeDb(db);
  }
});

test("auth code: an expired code reports expired:true", { skip: SKIP }, async () => {
  const { store, db } = await makeStore();
  const { closeDb } = await import("@aivo/db");
  try {
    const code = crypto.randomBytes(16).toString("base64url");
    await store.saveAuthCode(code, authCodeData(crypto.randomUUID()), -1000);
    const rec = await store.takeAuthCode(code);
    assert.ok(rec);
    assert.equal(rec!.expired, true);
  } finally {
    await closeDb(db);
  }
});

test("access token: round-trips while valid, null once expired", { skip: SKIP }, async () => {
  const { store, db } = await makeStore();
  const { closeDb } = await import("@aivo/db");
  try {
    const userId = crypto.randomUUID();
    const live = crypto.randomBytes(16).toString("base64url");
    await store.saveAccessToken(live, { userId, clientId: "c", scope: "openid" }, 60_000);
    const got = await store.getAccessToken(live);
    assert.ok(got);
    assert.equal(got!.userId, userId);

    const stale = crypto.randomBytes(16).toString("base64url");
    await store.saveAccessToken(stale, { userId, clientId: "c", scope: "openid" }, -1000);
    assert.equal(await store.getAccessToken(stale), null);
  } finally {
    await closeDb(db);
  }
});

test("refresh token: round-trips (no expiry)", { skip: SKIP }, async () => {
  const { store, db } = await makeStore();
  const { closeDb } = await import("@aivo/db");
  try {
    const userId = crypto.randomUUID();
    const rt = crypto.randomBytes(16).toString("base64url");
    await store.saveRefreshToken(rt, { userId, clientId: "c", scope: "openid email" });
    const got = await store.getRefreshToken(rt);
    assert.ok(got);
    assert.equal(got!.userId, userId);
    assert.equal(got!.scope, "openid email");
    assert.equal(await store.getRefreshToken("does-not-exist"), null);
  } finally {
    await closeDb(db);
  }
});
