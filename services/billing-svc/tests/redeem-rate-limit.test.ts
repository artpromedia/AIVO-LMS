/**
 * Sprint 4 — durable redeem rate-limit (DB-backed).
 *
 * Proves the Postgres-backed token bucket allows the burst, blocks beyond it,
 * and isolates subjects — the multi-replica-safe replacement for the old
 * process-local Map. Skips when DATABASE_URL is unset.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

test("allows the burst, blocks beyond it, and isolates subjects", async (t) => {
  if (SKIP) return t.skip("DATABASE_URL not set");
  const { createDb, closeDb } = await import("@aivo/db");
  const { consumeRateLimit } = await import("../src/lib/redeem-rate-limit.js");
  const db = createDb(process.env.DATABASE_URL!);
  try {
    const subject = `rl-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const allowed: boolean[] = [];
    for (let i = 0; i < 11; i++) {
      const r = await consumeRateLimit(db, {
        scope: "test:redeem",
        subject,
        burst: 10,
        windowSeconds: 60,
      });
      allowed.push(r.allowed);
    }
    assert.equal(
      allowed.slice(0, 10).every(Boolean),
      true,
      "first 10 attempts within burst are allowed",
    );
    assert.equal(allowed[10], false, "11th attempt in the window is blocked");

    // A different subject has its own bucket.
    const other = await consumeRateLimit(db, {
      scope: "test:redeem",
      subject: `other-${Date.now()}`,
      burst: 10,
      windowSeconds: 60,
    });
    assert.equal(other.allowed, true);
  } finally {
    await closeDb(db);
  }
});
