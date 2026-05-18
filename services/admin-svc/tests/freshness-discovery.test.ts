/**
 * Sprint 9 (Task #189): real-Postgres roundtrip for the freshness
 * watchdog discovery store.
 *
 * The companion stub-store tests in Task #100 (route plumbing, merge
 * logic) never exercise the actual `onConflictDoUpdate` clause inside
 * `makeFreshnessWatchdogDiscoveryStore`. That clause has a subtle
 * invariant: re-observing a `jobName` MUST preserve `firstSeenAt` and
 * MUST bump `lastSeenAt`. Forgetting `lastSeenAt` (no-op upsert) or
 * including `firstSeenAt` in the `set` payload would both silently
 * pass the stub-store tests but corrupt the dashboard.
 *
 * Skipped when DATABASE_URL isn't configured.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

const SKIP = !process.env.DATABASE_URL;

test(
  "discovery store: insert sets both timestamps; conflict preserves firstSeenAt and bumps lastSeenAt",
  { skip: SKIP },
  async () => {
    const { provisionTestDatabase, freshnessWatchdogDiscoveries } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const { makeFreshnessWatchdogDiscoveryStore } =
      await import("../src/lib/freshness-discovery.js");

    const { db, teardown } = await provisionTestDatabase();
    const store = makeFreshnessWatchdogDiscoveryStore(db);

    // Use a per-run unique name so concurrent CI runs against the same DB
    // don't collide. The job_name PK is the only uniqueness constraint.
    const jobName = `discovery-test-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    try {
      const t0 = new Date(Date.now() - 60_000);
      const inserted = await store.recordSeen(jobName, t0);
      assert.equal(inserted.jobName, jobName);
      assert.equal(
        inserted.firstSeenAt.getTime(),
        t0.getTime(),
        "first observation must set firstSeenAt to the supplied timestamp",
      );
      assert.equal(
        inserted.lastSeenAt.getTime(),
        t0.getTime(),
        "first observation must set lastSeenAt to the supplied timestamp",
      );

      const t1 = new Date();
      const updated = await store.recordSeen(jobName, t1);
      assert.equal(updated.jobName, jobName);
      assert.equal(
        updated.firstSeenAt.getTime(),
        t0.getTime(),
        "re-observing must NOT rewrite firstSeenAt",
      );
      assert.equal(
        updated.lastSeenAt.getTime(),
        t1.getTime(),
        "re-observing must bump lastSeenAt to the latest timestamp",
      );

      // A third observation with a timestamp earlier than t1 should still
      // bump lastSeenAt to that earlier value (the contract is "set to
      // supplied", not "max(...)"). Documents the trade-off explicitly.
      const t2 = new Date(t1.getTime() - 10_000);
      const third = await store.recordSeen(jobName, t2);
      assert.equal(
        third.firstSeenAt.getTime(),
        t0.getTime(),
        "firstSeenAt remains pinned to the very first observation",
      );
      assert.equal(
        third.lastSeenAt.getTime(),
        t2.getTime(),
        "lastSeenAt mirrors the latest call's timestamp, not the wall-clock max",
      );

      // list() should include this row, ordered by firstSeenAt ASC.
      const all = await store.list();
      const ours = all.find((r) => r.jobName === jobName);
      assert.ok(ours, "list() must include the just-inserted job");
      assert.equal(ours!.firstSeenAt.getTime(), t0.getTime());
    } finally {
      await db
        .delete(freshnessWatchdogDiscoveries)
        .where(eq(freshnessWatchdogDiscoveries.jobName, jobName));
      await teardown();
    }
  },
);

test(
  "discovery store: default `now` is used when no timestamp argument is supplied",
  { skip: SKIP },
  async () => {
    const { provisionTestDatabase, freshnessWatchdogDiscoveries } = await import("@aivo/db");
    const { eq } = await import("drizzle-orm");
    const { makeFreshnessWatchdogDiscoveryStore } =
      await import("../src/lib/freshness-discovery.js");

    const { db, teardown } = await provisionTestDatabase();
    const store = makeFreshnessWatchdogDiscoveryStore(db);

    const jobName = `discovery-default-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    try {
      const before = Date.now();
      const inserted = await store.recordSeen(jobName);
      const after = Date.now();
      assert.ok(
        inserted.firstSeenAt.getTime() >= before - 1,
        "default firstSeenAt must be >= call start",
      );
      assert.ok(
        inserted.firstSeenAt.getTime() <= after + 1,
        "default firstSeenAt must be <= call end",
      );
      assert.equal(
        inserted.firstSeenAt.getTime(),
        inserted.lastSeenAt.getTime(),
        "on first insert, both timestamps share the default `now`",
      );
    } finally {
      await db
        .delete(freshnessWatchdogDiscoveries)
        .where(eq(freshnessWatchdogDiscoveries.jobName, jobName));
      await teardown();
    }
  },
);
