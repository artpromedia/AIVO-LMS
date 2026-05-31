/**
 * Runs the shared store contracts against the Drizzle (postgres)
 * adapters. Skipped unless AIVO_TEST_DATABASE_URL points at a throwaway
 * Postgres (e.g. a CI test container). Creates the tables it needs and
 * truncates between cases, so it is self-contained and does not depend
 * on a migrated database.
 *
 *   AIVO_TEST_DATABASE_URL=postgres://… pnpm --filter @aivo/web-v2 \
 *     vitest run lib/db/persistence/__tests__/stores.postgres.contract.test.ts
 */
import { beforeAll, afterAll, describe, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "@aivo/db";
import { __setDbClient, __resetDbClient } from "../drizzle/client";
import { drizzleBrainProfiles } from "../drizzle/brain-profiles";
import { drizzleLessonRuns } from "../drizzle/lesson-runs";
import { brainProfileStoreContract } from "./contract/brain-profiles.contract";
import { lessonRunStoreContract } from "./contract/lesson-runs.contract";

const TEST_URL = process.env.AIVO_TEST_DATABASE_URL;

const TABLES = [
  "lesson_parent_summaries",
  "lesson_interactions",
  "generated_lesson_plans",
  "lesson_runs",
  "learner_brain_profiles",
];

const CREATE = [
  `CREATE TABLE IF NOT EXISTS "learner_brain_profiles" ("id" TEXT PRIMARY KEY, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "approval_status" TEXT, "clone_stage" TEXT, "approved_by_parent" BOOLEAN NOT NULL DEFAULT false, "cloned_at" TEXT, "generated_at" TEXT NOT NULL, "updated_at" TEXT NOT NULL, "state" JSONB NOT NULL DEFAULT '{}'::jsonb)`,
  `CREATE TABLE IF NOT EXISTS "lesson_runs" ("id" TEXT PRIMARY KEY, "tenant_id" TEXT NOT NULL, "learner_id" TEXT NOT NULL, "subject_id" TEXT, "skill_id" TEXT, "source" TEXT, "source_ref_id" TEXT, "tutor_persona" TEXT, "lesson_plan_id" TEXT, "status" TEXT NOT NULL, "retry_count" INTEGER NOT NULL DEFAULT 0, "failure_reason" TEXT, "started_at" TEXT, "completed_at" TEXT, "created_at" TEXT NOT NULL, "updated_at" TEXT NOT NULL, "snapshots" JSONB NOT NULL DEFAULT '{}'::jsonb)`,
  `CREATE TABLE IF NOT EXISTS "generated_lesson_plans" ("id" TEXT PRIMARY KEY, "tenant_id" TEXT NOT NULL, "lesson_run_id" TEXT, "data" JSONB NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "lesson_interactions" ("id" TEXT PRIMARY KEY, "lesson_run_id" TEXT NOT NULL, "learner_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "step_kind" TEXT NOT NULL, "step_ref_id" TEXT, "response" TEXT, "is_correct" BOOLEAN, "skipped" BOOLEAN NOT NULL DEFAULT false, "occurred_at" TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS "lesson_parent_summaries" ("id" TEXT PRIMARY KEY, "lesson_run_id" TEXT NOT NULL, "tenant_id" TEXT NOT NULL, "learner_id" TEXT NOT NULL, "data" JSONB NOT NULL)`,
];

let db: Database;

async function truncateAll(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")}`));
}

beforeAll(async () => {
  if (!TEST_URL) return;
  db = createDb(TEST_URL);
  __setDbClient(db);
  for (const stmt of CREATE) await db.execute(sql.raw(stmt));
});

afterAll(() => {
  __resetDbClient();
});

const describeMaybe = TEST_URL ? "postgres" : "postgres (skipped — set AIVO_TEST_DATABASE_URL)";

if (TEST_URL) {
  brainProfileStoreContract(describeMaybe, () => drizzleBrainProfiles, truncateAll);
  lessonRunStoreContract(describeMaybe, () => drizzleLessonRuns, truncateAll);
} else {
  describe("postgres store contracts", () => {
    it.skip("skipped — set AIVO_TEST_DATABASE_URL to run against Postgres", () => {});
  });
}
