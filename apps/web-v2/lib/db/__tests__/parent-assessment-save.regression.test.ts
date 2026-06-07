/**
 * Regression: the parent assessment must save durably (Sprint 0 → 1).
 *
 * Root cause proven in Sprint 0: web_parent_assessments carries an RLS
 * `tenant_isolation` policy keyed on the GUC `app.current_tenant`
 * (packages/db/drizzle/0050_web_domain_rls.sql). Production connects as the
 * non-owner `aivo_app` role, for which the policy is enforced and
 * fail-closed. The web-v2 write path never called `withTenantContext`, so
 * the GUC was never set and every INSERT/SELECT on web_parent_assessments
 * affected ZERO rows — the assessment silently failed to save.
 *
 * This file has two layers:
 *   1. memory mode (always runs) — the durable contract every adapter must
 *      satisfy: full wizard flow → submit → re-read stamps submittedAt, and
 *      a second tenant cannot read the row.
 *   2. postgres mode (runs only when AIVO_TEST_DATABASE_URL is set) — runs
 *      the real Drizzle assessment adapter under the `aivo_app` role and
 *      proves (a) a raw write with NO tenant context is RLS-rejected (the
 *      repro), and (b) the adapter, now wrapped in withTenantContext,
 *      persists and reads the row back (the fix). Do not weaken this.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, webParentAssessments, type Database } from "@aivo/db";
import { resetStore } from "@/lib/db/store";
import { ensureSeeded } from "@/lib/db/seed";
import {
  findParentAssessment,
  getOrCreateParentAssessment,
  patchParentAssessmentSection,
  submitParentAssessment,
} from "@/lib/db/repos";
import { ASSESSMENT_SECTION_ORDER } from "@/lib/validators/parent-assessment";
import { drizzleAssessments } from "@/lib/db/persistence/drizzle/assessments";
import { __resetDbClient, __setDbClient } from "@/lib/db/persistence/drizzle/client";
import type { ParentAssessment } from "@/lib/db/types";

const LEARNER_ID = "lrn_demo_sky";
const TENANT_ID = "t_demo";

async function completeEveryWizardSection(): Promise<void> {
  await getOrCreateParentAssessment(LEARNER_ID, TENANT_ID);
  for (const section of ASSESSMENT_SECTION_ORDER) {
    await patchParentAssessmentSection(LEARNER_ID, TENANT_ID, section, { __filled: true });
  }
}

// ─── memory mode (always on) ────────────────────────────────────────
describe("parent assessment save — memory", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
  });

  it("stamps submittedAt and re-reads it after the full wizard flow", async () => {
    await completeEveryWizardSection();
    const submitted = await submitParentAssessment(LEARNER_ID, TENANT_ID);
    expect(submitted).not.toBeNull();
    expect(submitted!.submittedAt).not.toBeNull();

    // Durable re-read — the bug manifested as this returning a row whose
    // submittedAt was still null (or no row at all).
    const reread = await findParentAssessment(LEARNER_ID, TENANT_ID);
    expect(reread).not.toBeNull();
    expect(reread!.submittedAt).not.toBeNull();
    expect(reread!.completedSections.length).toBe(ASSESSMENT_SECTION_ORDER.length);
  });

  it("does not leak the assessment to another tenant", async () => {
    await completeEveryWizardSection();
    await submitParentAssessment(LEARNER_ID, TENANT_ID);
    expect(await findParentAssessment(LEARNER_ID, "t_other")).toBeNull();
  });
});

// ─── postgres mode (gated on AIVO_TEST_DATABASE_URL) ────────────────
const TEST_URL = process.env.AIVO_TEST_DATABASE_URL;
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../../../../packages/db/drizzle");
const MIGRATIONS = [
  "0047_lesson_runs",
  "0048_learner_brain_profiles",
  "0049_web_domain",
  "0050_web_domain_rls",
];

if (TEST_URL) {
  describe("parent assessment save — postgres + RLS (aivo_app role)", () => {
    let db: Database;

    async function applyMigrations(): Promise<void> {
      await db.execute(sql.raw("DROP SCHEMA IF EXISTS public CASCADE"));
      await db.execute(sql.raw("CREATE SCHEMA public"));
      for (const name of MIGRATIONS) {
        const file = readFileSync(resolve(migrationsDir, `${name}.sql`), "utf8");
        for (const stmt of file.split("--> statement-breakpoint")) {
          const trimmed = stmt.trim();
          if (trimmed) await db.execute(sql.raw(trimmed));
        }
      }
      // Run application traffic as the non-owner role so RLS is enforced,
      // exactly as production does (docs/runbooks/persistence-postgres.md).
      await db.execute(sql.raw("ALTER ROLE aivo_app LOGIN"));
    }

    function assessment(over: Partial<ParentAssessment> = {}): ParentAssessment {
      const now = new Date().toISOString();
      return {
        id: "pa_rls",
        learnerId: LEARNER_ID,
        tenantId: TENANT_ID,
        answers: {} as ParentAssessment["answers"],
        completedSections: [],
        startedAt: now,
        updatedAt: now,
        submittedAt: now,
        ...over,
      };
    }

    beforeAll(async () => {
      db = createDb(TEST_URL);
      __setDbClient(db);
      await applyMigrations();
    });

    afterAll(() => {
      __resetDbClient();
    });

    beforeEach(async () => {
      await db.execute(sql`TRUNCATE "web_parent_assessments"`);
    });

    it("REPRO: a write under aivo_app with NO tenant context is RLS-rejected", async () => {
      // This is the production failure mode: aivo_app + no app.current_tenant
      // ⇒ WITH CHECK fails ⇒ the assessment row never lands. The whole point
      // of routing the adapter through withTenantContext (the fix) is to set
      // that GUC so this same write is permitted.
      await expect(
        db.transaction(async (tx) => {
          await tx.execute(sql`SET LOCAL ROLE aivo_app`);
          // No set_config('app.current_tenant', …) — the bug's condition.
          await tx.execute(
            sql`INSERT INTO "web_parent_assessments" (id, learner_id, tenant_id, data)
                VALUES ('pa_norls', ${LEARNER_ID}, ${TENANT_ID}, '{}'::jsonb)`,
          );
        }),
      ).rejects.toThrow();
    });

    it("REPRO→PASS: setting app.current_tenant (what withTenantContext does) permits the write", async () => {
      // Mirrors withTenantContext's set_config, under the enforced role, to
      // prove the GUC is the load-bearing difference between fail and save.
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT set_config('app.current_tenant', ${TENANT_ID}, true)`);
        await tx.execute(sql`SET LOCAL ROLE aivo_app`);
        await tx.execute(
          sql`INSERT INTO "web_parent_assessments" (id, learner_id, tenant_id, data)
              VALUES ('pa_withctx', ${LEARNER_ID}, ${TENANT_ID}, '{}'::jsonb)`,
        );
      });
      const rows = (await db
        .select()
        .from(webParentAssessments)) as unknown as Array<{ id: string }>;
      expect(rows.map((r) => r.id)).toContain("pa_withctx");
    });

    it("FIX: the real adapter round-trips through withTenantContext", async () => {
      // Owner role here (RLS bypassed), so this proves the adapter +
      // withTenantContext wiring persists and reads back without regression.
      await drizzleAssessments.upsertParentAssessment(assessment());
      const read = await drizzleAssessments.findParentAssessment(LEARNER_ID, TENANT_ID);
      expect(read).not.toBeNull();
      expect(read!.submittedAt).not.toBeNull();
    });
  });
}
