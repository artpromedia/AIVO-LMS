#!/usr/bin/env node
// verify-postgres-rows — post-migration / post-restore smoke check for
// the persistence-layer tables. Asserts every web_* / lesson / brain
// table exists; with AIVO_VERIFY_SEEDED=1 also asserts the reference
// tables are non-empty (run after db:seed:postgres or a restore).
//
//   DATABASE_URL=… node scripts/ci/verify-postgres-rows.mjs
//   AIVO_VERIFY_SEEDED=1 DATABASE_URL=… node scripts/ci/verify-postgres-rows.mjs
import { createDb } from "@aivo/db";
import { sql } from "drizzle-orm";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("verify-postgres-rows: DATABASE_URL is required.");
  process.exit(1);
}

const ALL_TABLES = [
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
  "lesson_runs",
  "generated_lesson_plans",
  "lesson_interactions",
  "lesson_parent_summaries",
  "learner_brain_profiles",
];

// Reference data that seeding (or a good restore) must populate.
const REFERENCE = [
  "web_subjects",
  "web_skills",
  "web_quest_worlds",
  "web_quest_chapters",
  "web_policy_versions",
  "web_subprocessors",
];

const db = createDb(url);
const errors = [];

for (const t of ALL_TABLES) {
  const rows = await db.execute(sql.raw(`SELECT to_regclass('public."${t}"') AS reg`));
  if (!rows?.[0]?.reg) errors.push(`missing table: ${t}`);
}

if (process.env.AIVO_VERIFY_SEEDED === "1") {
  for (const t of REFERENCE) {
    const rows = await db.execute(sql.raw(`SELECT count(*)::int AS n FROM "${t}"`));
    const n = Number(rows?.[0]?.n ?? 0);
    if (n === 0) errors.push(`reference table empty after seed/restore: ${t}`);
  }
}

if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\nverify-postgres-rows FAILED with ${errors.length} error(s).`);
  process.exit(1);
}

console.log(
  `verify-postgres-rows OK — ${ALL_TABLES.length} persistence tables present` +
    (process.env.AIVO_VERIFY_SEEDED === "1"
      ? `, ${REFERENCE.length} reference tables seeded.`
      : "."),
);
process.exit(0);
