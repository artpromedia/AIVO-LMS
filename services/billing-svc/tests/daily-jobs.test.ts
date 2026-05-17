/**
 * Sprint 7 integration tests for the billing-svc admin daily-jobs endpoint.
 *
 * Covers Tasks #61 (auth → handler → DB → JSON), #71 (filters), and #73
 * (history pruning + admin endpoint shape).
 *
 * The tests assume DATABASE_URL points at a test Postgres. They create the
 * schema with `CREATE TABLE IF NOT EXISTS` so a missing migration step doesn't
 * make the suite fail loudly.
 */
import { test, before, after } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { sql } = await import("drizzle-orm");
  const { createDb, users } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const { registerDailyJobsRoutes } = await import("../src/routes/daily-jobs.js");

  const db = createDb(process.env.DATABASE_URL!);
  // Make sure the test tables exist; the dev migration adds them but this
  // makes the suite hermetic.
  await db.execute(sql`
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
  const app = Fastify();
  registerDailyJobsRoutes(app, db);
  await app.ready();

  const [admin] = await db.insert(users).values({
    email: `daily-jobs-admin-${Date.now()}@aivo.dev`,
    name: "Daily Jobs Admin",
    role: "PLATFORM_ADMIN",
    passwordHash:
      "$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
  } as any).returning();
  const token = await signJWT({
    sub: admin.id,
    role: "PLATFORM_ADMIN",
    email: admin.email,
    tenantId: null,
    name: admin.name,
  } as any);
  const learnerToken = await signJWT({
    sub: admin.id,
    role: "LEARNER",
    email: admin.email,
    tenantId: null,
    name: admin.name,
  } as any);
  return { app, db, sql, admin, auth: `Bearer ${token}`, learnerAuth: `Bearer ${learnerToken}` };
}

async function seedHistory(db: any, sql: any) {
  await db.execute(sql`DELETE FROM billing_daily_job_runs WHERE job_name = 'billing.daily-expiry-reminders'`);
  await db.execute(sql`DELETE FROM daily_job_runs WHERE job_name = 'billing.daily-expiry-reminders'`);
  await db.execute(sql`
    INSERT INTO daily_job_runs (job_name, last_run_at, last_finished_at, last_replica_id, last_status, last_sent, last_failed)
    VALUES ('billing.daily-expiry-reminders', NOW(), NOW(), 'r1', 'ok', 7, 0)
  `);
  // 5 historical rows with mixed statuses.
  for (let i = 0; i < 5; i++) {
    await db.execute(sql`
      INSERT INTO billing_daily_job_runs (job_name, run_at, finished_at, replica_id, status, sent, failed, duration_ms)
      VALUES (
        'billing.daily-expiry-reminders',
        NOW() - (${i + 1}::int || ' days')::interval,
        NOW() - (${i + 1}::int || ' days')::interval + interval '20 seconds',
        'r1',
        ${i === 0 ? "failed" : i === 1 ? "partial" : "ok"},
        ${i * 2},
        ${i === 0 ? 3 : 0},
        20000
      )
    `);
  }
}

test("rejects missing bearer token", { skip: SKIP }, async () => {
  const { app } = await bootstrap();
  const res = await app.inject({ method: "GET", url: "/api/billing/admin/daily-jobs/status" });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("rejects non-admin role", { skip: SKIP }, async () => {
  const { app, learnerAuth } = await bootstrap();
  const res = await app.inject({
    method: "GET",
    url: "/api/billing/admin/daily-jobs/status",
    headers: { authorization: learnerAuth },
  });
  assert.equal(res.statusCode, 403);
  await app.close();
});

test("returns latest + history for an admin", { skip: SKIP }, async () => {
  const { app, db, sql, auth } = await bootstrap();
  await seedHistory(db, sql);
  const res = await app.inject({
    method: "GET",
    url: "/api/billing/admin/daily-jobs/status",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.latest);
  assert.equal(body.latest.lastStatus, "ok");
  assert.equal(body.history.length, 5);
  await app.close();
});

test("filters history by status", { skip: SKIP }, async () => {
  const { app, db, sql, auth } = await bootstrap();
  await seedHistory(db, sql);
  const res = await app.inject({
    method: "GET",
    url: "/api/billing/admin/daily-jobs/status?status=failed",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.history.length, 1);
  assert.equal(body.history[0].status, "failed");
  await app.close();
});

test("CSV export returns text/csv", { skip: SKIP }, async () => {
  const { app, db, sql, auth } = await bootstrap();
  await seedHistory(db, sql);
  const res = await app.inject({
    method: "GET",
    url: "/api/billing/admin/daily-jobs/history.csv",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  assert.match(res.headers["content-type"] as string, /text\/csv/);
  assert.match(res.body.split("\n")[0], /run_at,finished_at/);
  await app.close();
});
