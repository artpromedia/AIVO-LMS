import { test } from "node:test";
import assert from "node:assert/strict";
test("mfa_codes.code_hash never contains plaintext 6-digit OTPs", async () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("DATABASE_URL not set — skipping OTP-at-rest regression test");
    return;
  }
  // Dynamic import so the test file still loads when 'pg' isn't installed in
  // certain environments (it's a transitive dep of @aivo/db).
  let pgMod: any;
  try {
    pgMod = await import("pg");
  } catch {
    console.warn("'pg' not available — skipping OTP-at-rest regression test");
    return;
  }
  const Client = pgMod.default?.Client ?? pgMod.Client;
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const cols = await client.query(
      `SELECT column_name FROM information_schema.columns
       WHERE table_name='mfa_codes'`
    );
    const names = cols.rows.map((r: any) => r.column_name);
    assert.ok(names.includes("code_hash"), "code_hash column must exist");
    assert.ok(!names.includes("code"), "legacy plaintext 'code' column must be dropped");

    const bad = await client.query(
      `SELECT count(*)::int AS n FROM mfa_codes WHERE code_hash ~ '^[0-9]{6}$'`
    );
    assert.equal(bad.rows[0].n, 0, "no row may store a 6-digit plaintext OTP in code_hash");

    const sample = await client.query(
      `SELECT code_hash FROM mfa_codes ORDER BY created_at DESC LIMIT 50`
    );
    for (const r of sample.rows) {
      assert.match(
        r.code_hash,
        /^[0-9a-f]{64}$/,
        `code_hash must be a 64-char sha256 hex digest, got: ${r.code_hash}`
      );
    }
  } finally {
    await client.end();
  }
});
