/**
 * Sprint 7 — admin-svc Background Jobs endpoint tests. (Tasks #67, #77)
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP = !process.env.DATABASE_URL;

async function bootstrap() {
  const Fastify = (await import("fastify")).default;
  const { sql } = await import("drizzle-orm");
  const { createDb, closeDb, users } = await import("@aivo/db");
  const { signJWT } = await import("@aivo/security");
  const { registerJobsRoutes } = await import("../src/routes/jobs.js");

  const db = createDb(process.env.DATABASE_URL!);
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
  const app = Fastify();
  let runNowCalls: string[] = [];
  registerJobsRoutes(app, db, {
    runNow: {
      async request(jobName) {
        runNowCalls.push(jobName);
        return { ok: true, status: "queued" };
      },
    },
  });
  await app.ready();

  const [admin] = await db.insert(users).values({
    email: `jobs-admin-${Date.now()}@aivo.dev`,
    name: "Jobs Admin",
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
  return {
    app,
    db,
    sql,
    auth: `Bearer ${token}`,
    runNowCalls: () => runNowCalls,
    resetRunNowCalls: () => {
      runNowCalls = [];
    },
    closeDb,
  };
}

test("GET /api/admin-svc/jobs requires PLATFORM_ADMIN", { skip: SKIP }, async () => {
  const { app, db, closeDb } = await bootstrap();
  const res = await app.inject({ method: "GET", url: "/api/admin-svc/jobs" });
  assert.equal(res.statusCode, 401);
  await app.close();
  await closeDb(db);
});

test("GET /api/admin-svc/jobs returns the registry merged with the ledger", { skip: SKIP }, async () => {
  const { app, db, sql, auth, closeDb } = await bootstrap();
  await db.execute(sql`DELETE FROM daily_job_runs`);
  await db.execute(sql`
    INSERT INTO daily_job_runs (job_name, last_run_at, last_finished_at, last_status)
    VALUES ('billing.daily-expiry-reminders', NOW(), NOW(), 'ok')
  `);
  // An entry in the ledger that's not in the registry — should appear with unregistered:true.
  await db.execute(sql`
    INSERT INTO daily_job_runs (job_name, last_run_at, last_finished_at, last_status)
    VALUES ('legacy.unknown-job', NOW(), NOW(), 'ok')
  `);
  const res = await app.inject({
    method: "GET",
    url: "/api/admin-svc/jobs",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  const billing = body.jobs.find((j: any) => j.jobName === "billing.daily-expiry-reminders");
  assert.ok(billing);
  assert.equal(billing.unregistered, false);
  const legacy = body.jobs.find((j: any) => j.jobName === "legacy.unknown-job");
  assert.ok(legacy);
  assert.equal(legacy.unregistered, true);
  await app.close();
  await closeDb(db);
});

test("GET /api/admin-svc/jobs/:name/runs limits to 200", { skip: SKIP }, async () => {
  const { app, db, sql, auth, closeDb } = await bootstrap();
  await db.execute(sql`DELETE FROM periodic_job_runs WHERE job_name = 'limit-test'`);
  await db.execute(sql`
    INSERT INTO periodic_job_runs (job_name, run_at, status)
    SELECT 'limit-test', NOW() - (i || ' minutes')::interval, 'ok'
    FROM generate_series(1, 5) i
  `);
  const res = await app.inject({
    method: "GET",
    url: "/api/admin-svc/jobs/limit-test/runs?limit=99999",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.limit, 200);
  await app.close();
  await closeDb(db);
});

test("POST /api/admin-svc/jobs/:name/run-now 404s for an unregistered job", { skip: SKIP }, async () => {
  const { app, db, auth, closeDb } = await bootstrap();
  const res = await app.inject({
    method: "POST",
    url: "/api/admin-svc/jobs/totally.fake/run-now",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 404);
  await app.close();
  await closeDb(db);
});

test("POST /api/admin-svc/jobs/:name/run-now forwards to the owning service", { skip: SKIP }, async () => {
  const { app, db, auth, runNowCalls, closeDb } = await bootstrap();
  const res = await app.inject({
    method: "POST",
    url: "/api/admin-svc/jobs/billing.daily-expiry-reminders/run-now",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(runNowCalls(), ["billing.daily-expiry-reminders"]);
  await app.close();
  await closeDb(db);
});

test("GET /api/admin-svc/jobs/freshness aggregates counts", { skip: SKIP }, async () => {
  const { app, db, auth, closeDb } = await bootstrap();
  const res = await app.inject({
    method: "GET",
    url: "/api/admin-svc/jobs/freshness",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.ok(body.counts);
  assert.ok(Array.isArray(body.reports));
  await app.close();
  await closeDb(db);
});
