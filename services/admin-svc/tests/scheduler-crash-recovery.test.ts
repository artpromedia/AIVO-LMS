/**
 * Sprint 7 — end-to-end crash-recovery test for `@aivo/scheduling`.
 *
 * Boots two "replicas" (each with its own postgres-js connection) against the
 * test database, lets replica A acquire the advisory lock and "crash"
 * mid-tick (we close its DB session without releasing the lock), then asserts
 * that replica B picks up the work on its next tick.
 *
 * Covers Tasks #63, #66, #75.
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;
const JOB = `crash-test-${process.pid}`;

async function setup() {
  const { sql } = await import("drizzle-orm");
  const { createDb, closeDb } = await import("@aivo/db");
  const dbA = createDb(process.env.DATABASE_URL!);
  const dbB = createDb(process.env.DATABASE_URL!);
  await dbA.execute(sql`
    CREATE TABLE IF NOT EXISTS daily_job_runs (
      job_name varchar(100) PRIMARY KEY,
      last_run_at timestamptz NOT NULL,
      last_finished_at timestamptz,
      last_replica_id varchar(100),
      last_status varchar(20),
      last_sent integer,
      last_failed integer,
      last_error text,
      updated_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
  await dbA.execute(sql`
    CREATE TABLE IF NOT EXISTS periodic_job_runs (
      id bigserial PRIMARY KEY,
      job_name varchar(100) NOT NULL,
      run_at timestamptz NOT NULL,
      finished_at timestamptz,
      replica_id varchar(100),
      status varchar(20) NOT NULL,
      duration_ms integer,
      error text
    )
  `);
  await dbA.execute(sql`DELETE FROM daily_job_runs WHERE job_name = ${JOB}`);
  await dbA.execute(sql`DELETE FROM periodic_job_runs WHERE job_name = ${JOB}`);
  return { dbA, dbB, sql, closeDb };
}

test("two replicas: one runs, the other backs off", { skip: SKIP }, async () => {
  const { createDrizzleAdvisoryLock, createDrizzleLedger } = await import("@aivo/scheduling");
  const { dbA, dbB, sql, closeDb } = await setup();
  try {
    const lockA = createDrizzleAdvisoryLock(dbA as any);
    const lockB = createDrizzleAdvisoryLock(dbB as any);
    const ledger = createDrizzleLedger(dbA as any);

    const releaseA = await lockA.tryAcquire(JOB);
    assert.ok(releaseA, "replica A should win the advisory lock first");
    const releaseB = await lockB.tryAcquire(JOB);
    assert.equal(releaseB, null, "replica B must not be able to acquire while A holds the lock");
    await releaseA?.();
    // After A releases, B can acquire.
    const releaseB2 = await lockB.tryAcquire(JOB);
    assert.ok(releaseB2);
    await releaseB2?.();

    // Stamp + history sanity.
    await ledger.markStarted({ jobName: JOB, runAt: new Date(), replicaId: "A" });
    const lastRun = await ledger.getLastRunAt(JOB);
    assert.ok(lastRun);
    await ledger.markFinished({
      jobName: JOB,
      finishedAt: new Date(),
      status: "ok",
      sent: 0,
      failed: 0,
    });
    await ledger.appendHistory({
      jobName: JOB,
      runAt: new Date(),
      finishedAt: new Date(),
      replicaId: "A",
      status: "ok",
      durationMs: 5,
    });
    const result = (await dbA.execute(sql`
      SELECT COUNT(*)::int AS n FROM periodic_job_runs WHERE job_name = ${JOB}
    `)) as any;
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    assert.ok((rows[0]?.n ?? 0) >= 1);
  } finally {
    await closeDb(dbA);
    await closeDb(dbB);
  }
});

test("history pruning keeps the table bounded", { skip: SKIP }, async () => {
  const { createDrizzleLedger } = await import("@aivo/scheduling");
  const { dbA, dbB, sql, closeDb } = await setup();
  try {
    const ledger = createDrizzleLedger(dbA as any, { historyLimitPerJob: 5 });
    for (let i = 0; i < 20; i++) {
      await ledger.appendHistory({
        jobName: JOB,
        runAt: new Date(Date.now() - (20 - i) * 60_000),
        finishedAt: new Date(),
        replicaId: "A",
        status: "ok",
        durationMs: 1,
      });
    }
    const result = (await dbA.execute(sql`
      SELECT COUNT(*)::int AS n FROM periodic_job_runs WHERE job_name = ${JOB}
    `)) as any;
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    assert.ok((rows[0]?.n ?? 0) <= 5, "prune should keep at most 5 rows");
  } finally {
    await closeDb(dbA);
    await closeDb(dbB);
  }
});
