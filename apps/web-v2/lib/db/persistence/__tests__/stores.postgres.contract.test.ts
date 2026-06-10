/**
 * Runs every shared store contract against the Drizzle (postgres)
 * adapters. Skipped unless AIVO_TEST_DATABASE_URL points at a throwaway
 * Postgres (CI brings one up). Applies the real migration SQL (0047–
 * 0049) so the schema is identical to production, then truncates
 * between cases.
 *
 *   AIVO_TEST_DATABASE_URL=postgres://… pnpm --filter @aivo/web-v2 \
 *     vitest run lib/db/persistence/__tests__/stores.postgres.contract.test.ts
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, afterAll, describe, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, type Database } from "@aivo/db";
import { __setDbClient, __resetDbClient } from "../drizzle/client";
import { drizzleBrainProfiles } from "../drizzle/brain-profiles";
import { drizzleLessonRuns } from "../drizzle/lesson-runs";
import { drizzleNotifications } from "../drizzle/notifications";
import { drizzleAudit } from "../drizzle/audit";
import { drizzleIdentity } from "../drizzle/identity";
import { drizzleLearners } from "../drizzle/learners";
import { drizzleAssessments } from "../drizzle/assessments";
import { drizzleCurriculum } from "../drizzle/curriculum";
import { drizzleCompliance } from "../drizzle/compliance";
import { drizzleQuests } from "../drizzle/quests";
import { drizzleAdmin } from "../drizzle/admin";
import { drizzleCollaboration } from "../drizzle/collaboration";
import { brainProfileStoreContract } from "./contract/brain-profiles.contract";
import { lessonRunStoreContract } from "./contract/lesson-runs.contract";
import { assessmentSubmitContract } from "./contract/assessments.contract";
import { collaborationStoreContract } from "./contract/collaboration.contract";
import {
  notificationStoreContract,
  auditStoreContract,
  identityStoreContract,
  learnerStoreContract,
  assessmentStoreContract,
  curriculumStoreContract,
  complianceStoreContract,
  questStoreContract,
  adminStoreContract,
} from "./contract/stores.contract";

const TEST_URL = process.env.AIVO_TEST_DATABASE_URL;
const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../../../../../../packages/db/drizzle");
const MIGRATIONS = [
  "0047_lesson_runs",
  "0048_learner_brain_profiles",
  "0049_web_domain",
  "0072_web_collaboration",
  "0092_web_review_schedules",
];

const TABLES = [
  "lesson_parent_summaries",
  "lesson_interactions",
  "generated_lesson_plans",
  "lesson_runs",
  "learner_brain_profiles",
  "web_notifications",
  "web_notification_deliveries",
  "web_audit_logs",
  "web_users",
  "web_memberships",
  "web_learner_profiles",
  "web_parent_learner_relationships",
  "web_parent_assessments",
  "web_baseline_assessments",
  "web_baseline_questions",
  "web_baseline_attempts",
  "web_baseline_telemetry",
  "web_subjects",
  "web_skills",
  "web_mastery_maps",
  "web_skill_masteries",
  "web_learning_paths",
  "web_review_schedules",
  "web_consent_records",
  "web_iep_documents",
  "web_age_gate_records",
  "web_policy_versions",
  "web_subprocessors",
  "web_quest_worlds",
  "web_quest_chapters",
  "web_quest_progress",
  "web_schools",
  "web_classrooms",
  "web_enrollments",
  "web_teacher_assignments",
  "web_collaborator_insights",
  "web_collaborator_members",
];

let db: Database;

async function applyMigrations(): Promise<void> {
  // The CI postgres service is shared across every *.postgres.test.ts
  // file in this suite. `rls.postgres.test.ts` runs first and creates
  // the same web_* tables; a second pass of `CREATE TABLE IF NOT EXISTS`
  // then trips PG's pg_type uniqueness check (the IF NOT EXISTS guard
  // only consults pg_class, not pg_type). Start from a clean schema so
  // each contract suite owns its own DDL state.
  await db.execute(sql.raw("DROP SCHEMA IF EXISTS public CASCADE"));
  await db.execute(sql.raw("CREATE SCHEMA public"));
  for (const name of MIGRATIONS) {
    const file = readFileSync(resolve(migrationsDir, `${name}.sql`), "utf8");
    for (const stmt of file.split("--> statement-breakpoint")) {
      const trimmed = stmt.trim();
      if (trimmed) await db.execute(sql.raw(trimmed));
    }
  }
}

async function truncateAll(): Promise<void> {
  await db.execute(sql.raw(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY`));
}

beforeAll(async () => {
  if (!TEST_URL) return;
  db = createDb(TEST_URL);
  __setDbClient(db);
  await applyMigrations();
});

afterAll(() => {
  __resetDbClient();
});

if (TEST_URL) {
  const P = "postgres";
  brainProfileStoreContract(P, () => drizzleBrainProfiles, truncateAll);
  lessonRunStoreContract(P, () => drizzleLessonRuns, truncateAll);
  notificationStoreContract(P, () => drizzleNotifications, truncateAll);
  auditStoreContract(P, () => drizzleAudit, truncateAll);
  identityStoreContract(P, () => drizzleIdentity, truncateAll);
  learnerStoreContract(P, () => drizzleLearners, truncateAll);
  assessmentStoreContract(P, () => drizzleAssessments, truncateAll);
  assessmentSubmitContract(P, () => drizzleAssessments, truncateAll);
  curriculumStoreContract(P, () => drizzleCurriculum, truncateAll);
  complianceStoreContract(P, () => drizzleCompliance, truncateAll);
  questStoreContract(P, () => drizzleQuests, truncateAll);
  adminStoreContract(P, () => drizzleAdmin, truncateAll);
  collaborationStoreContract(P, () => drizzleCollaboration, truncateAll);
} else {
  describe("postgres store contracts", () => {
    it.skip("skipped — set AIVO_TEST_DATABASE_URL to run against Postgres", () => {});
  });
}
