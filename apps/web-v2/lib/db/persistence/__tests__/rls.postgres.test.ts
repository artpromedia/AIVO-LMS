/**
 * Proves the ADR 0002 row-level-security policies actually isolate
 * tenants. Skipped unless AIVO_TEST_DATABASE_URL is set (CI Postgres).
 *
 * Applies the real migrations (0047–0050), then runs queries under the
 * non-owner `aivo_app` role (via SET LOCAL ROLE, which subjects the
 * session to RLS) with `app.current_tenant` set — asserting a tenant
 * sees only its own rows and cannot write across tenants.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, beforeEach, describe, it, expect } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "@aivo/db";

const TEST_URL = process.env.AIVO_TEST_DATABASE_URL;
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../../../../../packages/db/drizzle");
const MIGRATIONS = [
  "0047_lesson_runs",
  "0048_learner_brain_profiles",
  "0049_web_domain",
  "0050_web_domain_rls",
];

let db: Database;

async function applyMigrations(): Promise<void> {
  for (const name of MIGRATIONS) {
    const file = readFileSync(resolve(migrationsDir, `${name}.sql`), "utf8");
    for (const stmt of file.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await db.execute(sql.raw(trimmed));
    }
  }
}

beforeAll(async () => {
  if (!TEST_URL) return;
  db = createDb(TEST_URL);
  await applyMigrations();
});

if (TEST_URL) {
  describe("RLS tenant isolation (web_learner_profiles)", () => {
    beforeEach(async () => {
      await db.execute(sql`TRUNCATE "web_learner_profiles"`);
      await db.execute(
        sql`INSERT INTO "web_learner_profiles" (id, tenant_id, data) VALUES ('la', 'tenant_a', '{}'::jsonb), ('lb', 'tenant_b', '{}'::jsonb)`,
      );
    });

    it("the owner role sees all tenants (RLS bypass for migrations/analytics)", async () => {
      const rows = (await db.execute(sql`SELECT id FROM "web_learner_profiles"`)) as unknown as {
        length: number;
      };
      expect(rows.length).toBe(2);
    });

    it("aivo_app sees only its own tenant's rows", async () => {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE aivo_app`);
        await tx.execute(sql`SELECT set_config('app.current_tenant', 'tenant_a', true)`);
        const rows = (await tx.execute(
          sql`SELECT id, tenant_id FROM "web_learner_profiles"`,
        )) as unknown as Array<{ id: string }>;
        expect(rows.length).toBe(1);
        expect(rows[0]!.id).toBe("la");
      });
    });

    it("aivo_app cannot write across tenants (WITH CHECK)", async () => {
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL ROLE aivo_app`);
          await tx.execute(sql`SELECT set_config('app.current_tenant', 'tenant_a', true)`);
          await tx.execute(
            sql`INSERT INTO "web_learner_profiles" (id, tenant_id, data) VALUES ('x', 'tenant_b', '{}'::jsonb)`,
          );
        }),
      ).rejects.toThrow();
    });

    it("with no tenant context aivo_app sees nothing", async () => {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL ROLE aivo_app`);
        const rows = (await tx.execute(sql`SELECT id FROM "web_learner_profiles"`)) as unknown as {
          length: number;
        };
        expect(rows.length).toBe(0);
      });
    });
  });
} else {
  describe("RLS tenant isolation", () => {
    it.skip("skipped — set AIVO_TEST_DATABASE_URL to run against Postgres", () => {});
  });
}
