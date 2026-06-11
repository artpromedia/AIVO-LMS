/**
 * Wave E (S12) — tutor-memory expiry purge unit test (faked db).
 *
 * The job must delete ONLY past-expiry rows, respect the per-run cap in
 * its SQL, and report the deleted count in its outcome.
 */
import { test } from "node:test";
import assert from "node:assert";
import { runMemoryExpiryOnce } from "../src/lib/memory-expiry.js";

function fakeDb(deletedCount: number, captured: string[]) {
  return {
    async execute(query: unknown) {
      // drizzle sql`` template — capture the raw SQL text for shape checks.
      const text =
        typeof query === "object" && query !== null && "queryChunks" in (query as object)
          ? JSON.stringify(
              ((query as { queryChunks: unknown[] }).queryChunks ?? []).map((c) =>
                typeof c === "object" && c !== null && "value" in (c as object)
                  ? (c as { value: unknown }).value
                  : c,
              ),
            )
          : String(query);
      captured.push(text);
      return { rows: [{ n: deletedCount }] };
    },
  };
}

test("purges expired rows and reports the count", async () => {
  const captured: string[] = [];
  const outcome = await runMemoryExpiryOnce(fakeDb(37, captured));
  assert.equal(outcome.status, "ok");
  assert.equal(outcome.deletedRows, 37);
  assert.equal(captured.length, 1);
  assert.ok(captured[0].includes("tutor_memories"));
  assert.ok(captured[0].includes("expires_at < now()"));
  assert.ok(captured[0].includes("LIMIT"), "per-run delete is bounded");
});

test("a quiet day reports zero without failing", async () => {
  const outcome = await runMemoryExpiryOnce(fakeDb(0, []));
  assert.equal(outcome.status, "ok");
  assert.equal(outcome.deletedRows, 0);
});
