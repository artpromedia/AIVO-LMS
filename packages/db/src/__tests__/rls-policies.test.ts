/**
 * Sprint 14 — RLS backstop chaos proof (migration 0106).
 *
 * Boots a real Postgres (testcontainer, or AIVO_TEST_DATABASE_URL when CI
 * provisions one), applies the FULL migration set, seeds two tenants, and
 * proves the policies:
 *
 *   1. HEADLINE: as `app_runtime` with NO tenant context, SELECT on
 *      users/learners returns ZERO rows despite seeded data — the
 *      forgotten-WHERE failure mode is dead for adopted services.
 *   2. withTenantContext(tenantA) → only tenant-A rows.
 *   3. A write whose tenant_id doesn't match the context is rejected by
 *      WITH CHECK.
 *   4. The owner connection is unaffected (RLS without FORCE doesn't bind
 *      owners) — documenting the per-service rollout model.
 *
 * Skips cleanly when no Docker/Postgres is reachable (same convention as
 * the web-v2 persistence suite); CI runs it for real.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { sql } from "drizzle-orm";
import { createDb } from "../index.js";
import { withTenantContext, withoutTenantContext } from "../tenant-context.js";

type Db = ReturnType<typeof createDb>;

const RUNTIME_PASSWORD = "rls-test-runtime-pw";

let ownerDb: Db | null = null;
let runtimeDb: Db | null = null;
let tenantA = "";
let tenantB = "";
let learnerAId = "";
let stopContainer: (() => Promise<void>) | null = null;
let skipReason = "";

async function resolveUrl(): Promise<string | null> {
  if (process.env.AIVO_TEST_DATABASE_URL) return process.env.AIVO_TEST_DATABASE_URL;
  try {
    const { PostgreSqlContainer } = await import("@testcontainers/postgresql");
    const container = await new PostgreSqlContainer("postgres:16").start();
    stopContainer = async () => {
      await container.stop();
    };
    return container.getConnectionUri();
  } catch {
    return null;
  }
}

beforeAll(async () => {
  const url = await resolveUrl();
  if (!url) {
    skipReason = "no Docker/Postgres reachable (set AIVO_TEST_DATABASE_URL or start Docker)";
    return;
  }

  // Apply the full journaled migration set — including 0106 — as owner.
  const ownerClient = postgres(url, { max: 1 });
  const here = path.dirname(fileURLToPath(import.meta.url));
  await migrate(drizzle(ownerClient), {
    migrationsFolder: path.resolve(here, "..", "..", "drizzle"),
  });
  await ownerClient.end({ timeout: 5 });

  ownerDb = createDb(url);

  // Compose sets the runtime password from env via the same statement.
  await ownerDb.execute(sql.raw(`ALTER ROLE app_runtime PASSWORD '${RUNTIME_PASSWORD}'`));

  // Seed two tenants with one user + learner each (owner connection).
  const seed = async (label: string) => {
    const rows = await ownerDb!.execute(
      sql.raw(
        `INSERT INTO tenants (name, type) VALUES ('rls-${label}-${Date.now()}', 'B2C_FAMILY') RETURNING id`,
      ),
    );
    const tenantId = (rows as unknown as Array<{ id: string }>)[0].id;
    const userRows = await ownerDb!.execute(
      sql.raw(
        `INSERT INTO users (tenant_id, name, email, role) VALUES ('${tenantId}', 'Parent ${label}', 'rls-${label}-${Date.now()}@test.local', 'PARENT') RETURNING id`,
      ),
    );
    const userId = (userRows as unknown as Array<{ id: string }>)[0].id;
    const learnerRows = await ownerDb!.execute(
      sql.raw(
        `INSERT INTO learners (tenant_id, user_id, parent_id, name) VALUES ('${tenantId}', '${userId}', '${userId}', 'Learner ${label}') RETURNING id`,
      ),
    );
    return { tenantId, learnerId: (learnerRows as unknown as Array<{ id: string }>)[0].id };
  };
  const a = await seed("a");
  const b = await seed("b");
  tenantA = a.tenantId;
  learnerAId = a.learnerId;
  tenantB = b.tenantId;

  // Connect as the non-bypassing runtime role.
  const u = new URL(url);
  u.username = "app_runtime";
  u.password = RUNTIME_PASSWORD;
  runtimeDb = createDb(u.toString());
}, 180_000);

afterAll(async () => {
  // postgres.js pools close with the process; stop the container if we own one.
  if (stopContainer) await stopContainer();
}, 60_000);

const count = async (db: Db, table: string): Promise<number> => {
  const rows = (await db.execute(
    sql.raw(`SELECT count(*)::int AS n FROM ${table}`),
  )) as unknown as Array<{ n: number }>;
  return rows[0].n;
};

describe("RLS backstop (migration 0106)", () => {
  it("HEADLINE: app_runtime without tenant context sees ZERO rows", async (ctx) => {
    if (!runtimeDb) return ctx.skip(skipReason);
    expect(await count(runtimeDb, "users")).toBe(0);
    expect(await count(runtimeDb, "learners")).toBe(0);
    // The data demonstrably exists for the owner.
    expect(await count(ownerDb!, "users")).toBeGreaterThanOrEqual(2);
    expect(await count(ownerDb!, "learners")).toBeGreaterThanOrEqual(2);
  });

  it("withTenantContext scopes reads to exactly that tenant", async (ctx) => {
    if (!runtimeDb) return ctx.skip(skipReason);
    const names = await withTenantContext(runtimeDb, tenantA, async (tx) => {
      const rows = (await tx.execute(sql.raw(`SELECT name FROM learners`))) as unknown as Array<{
        name: string;
      }>;
      return rows.map((r) => r.name);
    });
    expect(names).toEqual(["Learner a"]);

    const bNames = await withTenantContext(runtimeDb, tenantB, async (tx) => {
      const rows = (await tx.execute(sql.raw(`SELECT name FROM learners`))) as unknown as Array<{
        name: string;
      }>;
      return rows.map((r) => r.name);
    });
    expect(bNames).toEqual(["Learner b"]);
  });

  it("rejects a write whose tenant_id mismatches the context (WITH CHECK)", async (ctx) => {
    if (!runtimeDb) return ctx.skip(skipReason);
    await expect(
      withTenantContext(runtimeDb, tenantA, async (tx) => {
        await tx.execute(
          sql.raw(
            `INSERT INTO users (tenant_id, name, role) VALUES ('${tenantB}', 'Smuggled', 'PARENT')`,
          ),
        );
      }),
    ).rejects.toThrow(/row-level security|policy/i);
  });

  it("allows a write whose tenant_id matches the context", async (ctx) => {
    if (!runtimeDb) return ctx.skip(skipReason);
    const inserted = await withTenantContext(runtimeDb, tenantA, async (tx) => {
      const rows = (await tx.execute(
        sql.raw(
          `INSERT INTO users (tenant_id, name, role) VALUES ('${tenantA}', 'In Scope', 'PARENT') RETURNING id`,
        ),
      )) as unknown as Array<{ id: string }>;
      return rows[0].id;
    });
    expect(inserted).toMatch(/^[0-9a-f-]{36}$/i);
  });

  it("scopes the derived-tenant membership tables through their joins", async (ctx) => {
    if (!runtimeDb) return ctx.skip(skipReason);
    // Seed a school + classroom + enrollment for tenant A as owner.
    const schoolRows = (await ownerDb!.execute(
      sql.raw(
        `INSERT INTO schools (tenant_id, name) VALUES ('${tenantA}', 'RLS Elementary') RETURNING id`,
      ),
    )) as unknown as Array<{ id: string }>;
    const schoolId = schoolRows[0].id;
    const classroomRows = (await ownerDb!.execute(
      sql.raw(
        `INSERT INTO classrooms (school_id, name) VALUES ('${schoolId}', 'Room 1') RETURNING id`,
      ),
    )) as unknown as Array<{ id: string }>;
    await ownerDb!.execute(
      sql.raw(
        `INSERT INTO classroom_enrollments (classroom_id, learner_id) VALUES ('${classroomRows[0].id}', '${learnerAId}')`,
      ),
    );

    // Unscoped runtime: nothing.
    expect(await count(runtimeDb!, "schools")).toBe(0);
    expect(await count(runtimeDb!, "classrooms")).toBe(0);
    expect(await count(runtimeDb!, "classroom_enrollments")).toBe(0);

    // Tenant A context: the seeded graph; tenant B: none of it.
    const aCounts = await withTenantContext(runtimeDb!, tenantA, async (tx) => {
      const n = async (t: string) =>
        ((await tx.execute(sql.raw(`SELECT count(*)::int AS n FROM ${t}`))) as unknown as Array<{
          n: number;
        }>)[0].n;
      return [await n("schools"), await n("classrooms"), await n("classroom_enrollments")];
    });
    expect(aCounts).toEqual([1, 1, 1]);
    const bCounts = await withTenantContext(runtimeDb!, tenantB, async (tx) => {
      const n = async (t: string) =>
        ((await tx.execute(sql.raw(`SELECT count(*)::int AS n FROM ${t}`))) as unknown as Array<{
          n: number;
        }>)[0].n;
      return [await n("schools"), await n("classrooms"), await n("classroom_enrollments")];
    });
    expect(bCounts).toEqual([0, 0, 0]);
  });

  it("grants cross-tenant learner READ through an ACCEPTED collaboration link", async (ctx) => {
    if (!runtimeDb) return ctx.skip(skipReason);
    // Tenant-B user becomes an accepted teacher of tenant-A's learner —
    // the by-design cross-tenant family collaboration case.
    const teacherRows = (await ownerDb!.execute(
      sql.raw(
        `INSERT INTO users (tenant_id, name, email, role) VALUES ('${tenantB}', 'Teacher B', 'rls-teacher-${Date.now()}@test.local', 'TEACHER') RETURNING id`,
      ),
    )) as unknown as Array<{ id: string }>;
    const teacherId = teacherRows[0].id;
    await ownerDb!.execute(
      sql.raw(
        `INSERT INTO learner_teachers (tenant_id, learner_id, teacher_email, teacher_user_id, invited_by, status, accepted_at)
         SELECT '${tenantA}', '${learnerAId}', 'rls-link@test.local', '${teacherId}', parent_id, 'ACCEPTED', now() FROM learners WHERE id = '${learnerAId}'`,
      ),
    );

    // Under the teacher's own tenant context WITHOUT user id: invisible.
    const withoutUser = await withTenantContext(runtimeDb, tenantB, async (tx) => {
      const rows = (await tx.execute(
        sql.raw(`SELECT name FROM learners WHERE id = '${learnerAId}'`),
      )) as unknown as Array<{ name: string }>;
      return rows.length;
    });
    expect(withoutUser).toBe(0);

    // With app.user_id set: exactly that learner becomes readable.
    const withUser = await withTenantContext(
      runtimeDb,
      tenantB,
      async (tx) => {
        const rows = (await tx.execute(
          sql.raw(`SELECT name FROM learners WHERE id = '${learnerAId}'`),
        )) as unknown as Array<{ name: string }>;
        return rows.map((r) => r.name);
      },
      { userId: teacherId },
    );
    expect(withUser).toEqual(["Learner a"]);

    // Read-only: the link does NOT grant writes to the foreign learner.
    await expect(
      withTenantContext(
        runtimeDb,
        tenantB,
        async (tx) => {
          await tx.execute(
            sql.raw(`UPDATE learners SET name = 'Hijacked' WHERE id = '${learnerAId}'`),
          );
          const rows = (await tx.execute(
            sql.raw(`SELECT name FROM learners WHERE id = '${learnerAId}'`),
          )) as unknown as Array<{ name: string }>;
          // UPDATE on an RLS SELECT-only-visible row affects 0 rows rather
          // than erroring; assert the name is unchanged.
          if (rows[0]?.name === "Hijacked") throw new Error("write leaked through read policy");
          return rows[0]?.name;
        },
        { userId: teacherId },
      ),
    ).resolves.toBe("Learner a");
  });

  it("withoutTenantContext stays fail-closed on app_runtime and logs its reason", async (ctx) => {
    if (!runtimeDb) return ctx.skip(skipReason);
    const warned: Array<Record<string, unknown>> = [];
    const rows = await withoutTenantContext(
      runtimeDb,
      "rls-policies.test platform sweep",
      async (tx) =>
        (await tx.execute(sql.raw(`SELECT count(*)::int AS n FROM users`))) as unknown as Array<{
          n: number;
        }>,
      { warn: (obj) => warned.push(obj) },
    );
    expect(rows[0].n).toBe(0); // explicitly unscoped ≠ bypass
    expect(warned[0]?.reason).toContain("platform sweep");
  });

  it("documents the rollout model: the owner connection is unaffected", async (ctx) => {
    if (!ownerDb) return ctx.skip(skipReason);
    // No FORCE ROW LEVEL SECURITY → table owners read everything, so the
    // ~29 not-yet-migrated services keep working unchanged.
    expect(await count(ownerDb, "users")).toBeGreaterThanOrEqual(2);
    expect(await count(ownerDb, "learners")).toBeGreaterThanOrEqual(2);
  });

  it("withTenantContext validates the tenant id shape", async () => {
    // Pure validation — runs even without a database.
    const db = (ownerDb ?? createDb("postgres://invalid:5432/none")) as Db;
    await expect(
      withTenantContext(db, "not-a-uuid'; DROP TABLE users;--", async () => undefined),
    ).rejects.toThrow(/must be a UUID/);
    await expect(withoutTenantContext(db, "   ", async () => undefined)).rejects.toThrow(
      /reason is required/,
    );
  });
});
