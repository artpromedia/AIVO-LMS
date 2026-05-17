/**
 * Sprint 7 — janitor tests. (Tasks #72, #178)
 *
 * Verifies that the janitor prunes per-job to the configured limit and
 * sweeps orphan rows older than the retention window.
 */
import { test } from "node:test";
import assert from "node:assert";
import { runJanitorOnce } from "../src/lib/janitor.js";

const SKIP = !process.env.DATABASE_URL;

async function setup() {
  const { sql } = await import("drizzle-orm");
  const { createDb, closeDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);
  await db.execute(sql`
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
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS billing_daily_job_runs (
      id bigserial PRIMARY KEY,
      job_name varchar(100) NOT NULL,
      run_at timestamptz NOT NULL,
      finished_at timestamptz,
      replica_id varchar(100),
      status varchar(20) NOT NULL,
      sent integer,
      failed integer,
      duration_ms integer,
      error text
    )
  `);
  return { db, sql, closeDb };
}

test("orphan sweep removes very old rows", { skip: SKIP }, async () => {
  const { db, sql, closeDb } = await setup();
  try {
    await db.execute(sql`DELETE FROM periodic_job_runs WHERE job_name = 'orphan-test'`);
    await db.execute(sql`
      INSERT INTO periodic_job_runs (job_name, run_at, status)
      VALUES ('orphan-test', NOW() - interval '120 days', 'ok')
    `);
    await runJanitorOnce(db);
    const result = (await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM periodic_job_runs WHERE job_name = 'orphan-test'
    `)) as any;
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    assert.equal(rows[0]?.n ?? 0, 0);
  } finally {
    await closeDb(db);
  }
});

test("per-job prune keeps only the latest 50 periodic rows", { skip: SKIP }, async () => {
  const { db, sql, closeDb } = await setup();
  try {
    await db.execute(sql`DELETE FROM periodic_job_runs WHERE job_name = 'prune-test'`);
    await db.execute(sql`
      INSERT INTO periodic_job_runs (job_name, run_at, status)
      SELECT 'prune-test', NOW() - (i || ' minutes')::interval, 'ok'
      FROM generate_series(1, 75) i
    `);
    await runJanitorOnce(db);
    const result = (await db.execute(sql`
      SELECT COUNT(*)::int AS n FROM periodic_job_runs WHERE job_name = 'prune-test'
    `)) as any;
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    assert.equal(rows[0]?.n ?? 0, 50);
  } finally {
    await closeDb(db);
  }
});
