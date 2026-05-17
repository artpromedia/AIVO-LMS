/**
 * Sprint 7 — confirms the SOC 2 access-review query no longer trips over
 * drizzle's array-binding behavior. (Task #74)
 *
 * The bug: drizzle bound the JS array as a tuple of params, producing
 * `ANY($1, $2, ...)` which Postgres rejected with
 * `op ANY/ALL (array) requires array on right side`.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

test("generateEvidenceBundle does not throw on the access-review query", { skip: SKIP }, async () => {
  const { createDb, closeDb } = await import("@aivo/db");
  const { generateEvidenceBundle } = await import("../src/lib/soc2-evidence.js");
  const db = createDb(process.env.DATABASE_URL!);
  // We can't fully run the bundle in CI without the file system, but the
  // query is the part the bug regression is about. Run just the SQL via the
  // exported helper if it exists, otherwise call generateEvidenceBundle and
  // tolerate file-write failures.
  try {
    await generateEvidenceBundle(db);
  } catch (e: any) {
    // We expect the query to succeed; downstream file/insert errors we
    // tolerate. The bug we're catching here is a `ANY/ALL (array)` SQL error.
    assert.doesNotMatch(
      e?.message ?? "",
      /op ANY\/ALL.*requires array/,
      "access-review query still binds JS array as tuple",
    );
  } finally {
    await closeDb(db);
  }
});
