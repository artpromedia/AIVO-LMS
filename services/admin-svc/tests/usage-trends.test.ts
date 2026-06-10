/**
 * Platform usage-trends — series math, route guards, and (when DATABASE_URL
 * is set) the real grouped-count query path.
 *
 * The pure series builder runs without a database. The route-guard tests use
 * a stub db because requirePermission rejects before any DB access. The
 * end-to-end bucket test follows the content-cms.persistence convention:
 * skipped without DATABASE_URL, asserts deltas (not absolutes) so it
 * tolerates rows left behind by other suites sharing the database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import Fastify from "fastify";
import { signJWT } from "@aivo/security";
import {
  buildUsageTrendSeries,
  clampTrendDays,
  trendWindowStart,
  utcDayKey,
} from "../src/lib/usage-trends.js";
import { registerPlatformRoutes } from "../src/routes/platform.js";

const SKIP_DB = !process.env.DATABASE_URL;

// --- pure series math --------------------------------------------------------

test("clampTrendDays: defaults, clamps, and truncates", () => {
  assert.equal(clampTrendDays(undefined), 14);
  assert.equal(clampTrendDays("not-a-number"), 14);
  assert.equal(clampTrendDays("0"), 1);
  assert.equal(clampTrendDays("-3"), 1);
  assert.equal(clampTrendDays("9999"), 90);
  assert.equal(clampTrendDays("7.9"), 7);
  assert.equal(clampTrendDays("30"), 30);
});

test("trendWindowStart: left edge is the start of the UTC day (days-1) ago", () => {
  const now = new Date("2026-06-10T15:30:00.000Z");
  assert.equal(trendWindowStart(1, now).toISOString(), "2026-06-10T00:00:00.000Z");
  assert.equal(trendWindowStart(5, now).toISOString(), "2026-06-06T00:00:00.000Z");
});

test("buildUsageTrendSeries: zero-fills a continuous window ending today", () => {
  const now = new Date("2026-06-10T15:30:00.000Z");
  const points = buildUsageTrendSeries({
    days: 5,
    now,
    users: [
      { day: "2026-06-06", count: 3 },
      { day: "2026-06-10", count: "2" }, // string counts (pg bigint) coerce
      { day: "2026-05-01", count: 99 }, // outside the window — ignored
    ],
    learners: [{ day: "2026-06-08", count: 1 }],
  });

  assert.deepEqual(points, [
    { day: "2026-06-06", newUsers: 3, newLearners: 0 },
    { day: "2026-06-07", newUsers: 0, newLearners: 0 },
    { day: "2026-06-08", newUsers: 0, newLearners: 1 },
    { day: "2026-06-09", newUsers: 0, newLearners: 0 },
    { day: "2026-06-10", newUsers: 2, newLearners: 0 },
  ]);
});

// --- route guards (no DB access: requirePermission rejects first) ------------

const stubDb = {} as any;

async function bootstrap() {
  const app = Fastify({ logger: false });
  registerPlatformRoutes(app, stubDb);
  await app.ready();
  return app;
}

async function tokenFor(role: string) {
  return signJWT({
    sub: "00000000-0000-0000-0000-000000000001",
    role,
    email: `${role.toLowerCase()}@aivo.dev`,
    tenantId: null,
    name: "Trend Tester",
  } as any);
}

test("usage-trends rejects a missing token with 401", async () => {
  const app = await bootstrap();
  try {
    const res = await app.inject({ method: "GET", url: "/api/admin-svc/platform/usage-trends" });
    assert.equal(res.statusCode, 401);
  } finally {
    await app.close();
  }
});

test("usage-trends rejects roles without platform:read with 403", async () => {
  const app = await bootstrap();
  try {
    for (const role of ["PARENT", "SCHOOL_ADMIN"]) {
      const res = await app.inject({
        method: "GET",
        url: "/api/admin-svc/platform/usage-trends",
        headers: { authorization: `Bearer ${await tokenFor(role)}` },
      });
      assert.equal(res.statusCode, 403, `${role} should be forbidden`);
    }
  } finally {
    await app.close();
  }
});

// --- real query path ----------------------------------------------------------

test("usage-trends buckets new users/learners by UTC day", { skip: SKIP_DB }, async () => {
  const { createDb, tenants, users, learners } = await import("@aivo/db");
  const db = createDb(process.env.DATABASE_URL!);

  const app = Fastify({ logger: false });
  registerPlatformRoutes(app, db);
  await app.ready();

  const headers = { authorization: `Bearer ${await tokenFor("PLATFORM_ADMIN")}` };
  const get = async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/admin-svc/platform/usage-trends?days=14",
      headers,
    });
    assert.equal(res.statusCode, 200, res.body);
    return res.json() as {
      days: number;
      points: Array<{ day: string; newUsers: number; newLearners: number }>;
    };
  };

  try {
    const before = await get();
    assert.equal(before.days, 14);
    assert.equal(before.points.length, 14);

    const now = new Date();
    const todayKey = utcDayKey(now);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const threeDaysAgoKey = utcDayKey(threeDaysAgo);
    const outsideWindow = new Date(now.getTime() - 100 * 24 * 60 * 60 * 1000);
    assert.equal(before.points.at(-1)?.day, todayKey, "window must end today");

    const stamp = Date.now();
    const [tenant] = await db
      .insert(tenants)
      .values({ name: `trend-e2e-${stamp}`, type: "B2C_FAMILY" })
      .returning();
    const insertUser = async (createdAt: Date) => {
      const [row] = await db
        .insert(users)
        .values({
          tenantId: tenant.id,
          email: `trend-${stamp}-${Math.random().toString(36).slice(2)}@aivo.test`,
          name: "Trend User",
          role: "PARENT",
          createdAt,
        })
        .returning();
      return row;
    };

    const parent = await insertUser(now);
    const learnerUser = await insertUser(now);
    await insertUser(threeDaysAgo);
    await insertUser(outsideWindow); // must not appear anywhere in the window
    await db.insert(learners).values({
      tenantId: tenant.id,
      userId: learnerUser.id,
      parentId: parent.id,
      name: "Trend Learner",
      createdAt: now,
    });

    const after = await get();
    const bucket = (body: typeof after, day: string) =>
      body.points.find((p) => p.day === day) ?? { day, newUsers: 0, newLearners: 0 };

    assert.equal(
      bucket(after, todayKey).newUsers - bucket(before, todayKey).newUsers,
      2,
      "two users created today",
    );
    assert.equal(
      bucket(after, todayKey).newLearners - bucket(before, todayKey).newLearners,
      1,
      "one learner created today",
    );
    assert.equal(
      bucket(after, threeDaysAgoKey).newUsers - bucket(before, threeDaysAgoKey).newUsers,
      1,
      "one user created three days ago",
    );
    const totalDelta =
      after.points.reduce((sum, p) => sum + p.newUsers, 0) -
      before.points.reduce((sum, p) => sum + p.newUsers, 0);
    assert.equal(totalDelta, 3, "the 100-day-old user stays outside the window");
  } finally {
    await app.close();
  }
});
