/**
 * /api/admin-svc/platform/system-health — per-source degradation.
 *
 * The platform home renders this read straight after login, so a single
 * broken table (missing migration, revoked grant) must degrade that signal
 * with a named issue instead of 500ing the landing page. Only a total DB
 * failure stays an error (503 with the underlying cause).
 *
 * The stub-db tests run everywhere; the last test exercises the real schema
 * and is skipped without DATABASE_URL (mirrors the other admin-svc suites).
 */
import { test } from "node:test";
import assert from "node:assert";

const SKIP_DB = !process.env.DATABASE_URL;

async function bootstrap(db: unknown) {
  const Fastify = (await import("fastify")).default;
  const { signJWT } = await import("@aivo/security");
  const { registerPlatformRoutes } = await import("../src/routes/platform.js");

  const app = Fastify();
  registerPlatformRoutes(app, db);
  await app.ready();

  const token = await signJWT({
    sub: "platform-admin-test",
    role: "PLATFORM_ADMIN",
    email: "platform-admin@aivo.dev",
  } as any);
  return { app, auth: `Bearer ${token}` };
}

/**
 * Minimal drizzle-shaped stub: every `select()` starts a chain whose
 * `from/where/groupBy` return the chain and whose `await` resolves
 * `rowsFor(table)` — or rejects when `rowsFor` throws.
 */
function stubDb(rowsFor: (table: unknown) => unknown[]) {
  return {
    select() {
      let table: unknown;
      const chain: any = {
        from(t: unknown) {
          table = t;
          return chain;
        },
        where: () => chain,
        groupBy: () => chain,
        then(onFulfilled: any, onRejected: any) {
          return Promise.resolve()
            .then(() => rowsFor(table))
            .then(onFulfilled, onRejected);
        },
      };
      return chain;
    },
  };
}

function missingRelation(name: string): Error {
  // Shape of a DrizzleQueryError: SQL text in `message`, pg error in `cause`.
  return Object.assign(new Error(`Failed query: select count(*) from "${name}"`), {
    cause: new Error(`relation "${name}" does not exist`),
  });
}

test("system-health requires a bearer token", async () => {
  const { app } = await bootstrap(stubDb(() => []));
  const res = await app.inject({ method: "GET", url: "/api/admin-svc/platform/system-health" });
  assert.equal(res.statusCode, 401);
  await app.close();
});

test("one failing source degrades that signal instead of 500ing", async () => {
  const { aiUsageLog, learners, lessonRuns, tenants, users } = await import("@aivo/db");
  const db = stubDb((table) => {
    if (table === aiUsageLog) throw missingRelation("ai_usage_log");
    if (table === tenants) {
      return [
        { type: "B2B_DISTRICT", count: 2 },
        { type: "B2C_FAMILY", count: 3 },
      ];
    }
    if (table === users) return [{ count: 7 }];
    if (table === learners) return [{ count: 4 }];
    if (table === lessonRuns) return [{ count: 9 }];
    throw new Error("unexpected table in stub");
  });

  const { app, auth } = await bootstrap(db);
  const res = await app.inject({
    method: "GET",
    url: "/api/admin-svc/platform/system-health",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.degraded, true);
  assert.deepEqual(body.issues, [
    { source: "ai_usage", error: 'relation "ai_usage_log" does not exist' },
  ]);
  // Healthy sources still report real numbers…
  assert.equal(body.tenantsTotal, 5);
  assert.deepEqual(body.tenantCounts, { district: 2, school: 0, family: 3, unknown: 0 });
  assert.equal(body.usersTotal, 7);
  assert.equal(body.learnersTotal, 4);
  assert.equal(body.lessonRunsTotal, 9);
  // …while the failed one reports zeros.
  assert.equal(body.aiRequests24h, 0);
  assert.equal(body.aiEstimatedCostUsd24h, 0);
  await app.close();
});

test("all sources failing returns 503 with the underlying cause", async () => {
  const db = stubDb(() => {
    throw Object.assign(new Error("Failed query: select count(*)"), {
      cause: new Error("connect ECONNREFUSED 10.0.0.1:6432"),
    });
  });

  const { app, auth } = await bootstrap(db);
  const res = await app.inject({
    method: "GET",
    url: "/api/admin-svc/platform/system-health",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 503);
  const body = res.json();
  assert.equal(body.error, "system_health_unavailable");
  assert.equal(body.detail, "connect ECONNREFUSED 10.0.0.1:6432");
  assert.equal(body.issues.length, 5);
  await app.close();
});

test("returns healthy metrics against the real schema", { skip: SKIP_DB }, async () => {
  const { closeDb, createDb } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);
  const { app, auth } = await bootstrap(db);
  const res = await app.inject({
    method: "GET",
    url: "/api/admin-svc/platform/system-health",
    headers: { authorization: auth },
  });
  assert.equal(res.statusCode, 200);
  const body = res.json();
  assert.equal(body.degraded, false);
  assert.deepEqual(body.issues, []);
  for (const field of [
    "tenantsTotal",
    "usersTotal",
    "learnersTotal",
    "lessonRunsTotal",
    "lessonRunsCompleted",
    "aiRequests24h",
    "aiModelsActive24h",
    "aiAvgLatencyMs24h",
    "aiEstimatedCostUsd24h",
  ]) {
    assert.equal(typeof body[field], "number", `${field} should be a number`);
  }
  await app.close();
  await closeDb(db);
});
