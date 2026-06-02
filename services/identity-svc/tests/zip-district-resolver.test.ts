/**
 * Sprint A — unit tests for zip-district-resolver.
 *
 * Exercises the pure helpers that don't need a DB connection
 * (normalization + the no-DATABASE_URL branch of `resolveZipToDistricts`).
 * Full integration coverage against a seeded DB lives in
 * tests/integration/zip-district.test.ts (run by `pnpm test:integration`
 * which provisions Postgres).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeZip, resolveZipToDistricts } from "../src/services/zip-district-resolver.js";

test("normalizeZip strips non-digits and clamps to 5", () => {
  assert.equal(normalizeZip("90210"), "90210");
  assert.equal(normalizeZip("90210-1234"), "90210");
  assert.equal(normalizeZip(" 9 0 2 1 0 "), "90210");
  assert.equal(normalizeZip("902100"), "90210");
});

test("normalizeZip returns null for inputs that can't yield 5 digits", () => {
  assert.equal(normalizeZip(""), null);
  assert.equal(normalizeZip(null), null);
  assert.equal(normalizeZip(undefined), null);
  assert.equal(normalizeZip("abcd"), null);
  assert.equal(normalizeZip("123"), null);
});

test("resolveZipToDistricts returns a miss for invalid zips without throwing", async () => {
  const result = await resolveZipToDistricts("bad");
  assert.equal(result.source, "miss");
  assert.equal(result.dominant, null);
  assert.deepEqual(result.alternates, []);
});

test("resolveZipToDistricts returns a miss when DATABASE_URL is not set", async () => {
  // Tests are run without DATABASE_URL by default; this confirms the
  // resolver is non-throwing on a fresh environment. Production deploys
  // set DATABASE_URL and exercise the DB path via integration tests.
  const original = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const result = await resolveZipToDistricts("90210");
    assert.equal(result.source, "miss");
    assert.equal(result.zip, "90210");
  } finally {
    if (original !== undefined) process.env.DATABASE_URL = original;
  }
});
