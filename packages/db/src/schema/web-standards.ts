/**
 * Web-owned standards / skill-graph persistence tables (Sprint 8 remainder).
 *
 * Platform-global curriculum-standards reference + skill-graph metadata:
 * standards frameworks + documents + standards + domains, skill prerequisites
 * + versions, curriculum maps, lesson-objective templates, assessment
 * blueprints, and the curriculum-import job log.
 *
 * Boundary (ADR 0015): per-learner curriculum uploads + term syllabi are owned
 * by tutor-svc (the `curriculum_uploads` table; live path gated by
 * isLiveCurriculum()/INTERNAL_SERVICE_TOKEN) and read/written over REST — they
 * are NOT web_* migration targets and keep their in-memory dev mock.
 *
 * RLS: NOT applied — platform-global reference data, like web_policy_versions /
 * web_subprocessors.
 *
 * Conventions match web-domain.ts: TEXT ids, full object in `data` JSONB.
 * (Tables are spelled out explicitly — not via a helper — so the schema-drift
 * scanner can see each `pgTable("web_…")` string literal.)
 */
import { pgTable, text, jsonb } from "drizzle-orm/pg-core";

export const webStandardsFrameworks = pgTable("web_standards_frameworks", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webStandardDocuments = pgTable("web_standard_documents", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webStandards = pgTable("web_standards", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webDomains = pgTable("web_domains", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webSkillPrerequisites = pgTable("web_skill_prerequisites", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webSkillVersions = pgTable("web_skill_versions", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webCurriculumMaps = pgTable("web_curriculum_maps", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webLessonObjectiveTemplates = pgTable("web_lesson_objective_templates", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webAssessmentBlueprints = pgTable("web_assessment_blueprints", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webCurriculumImportJobs = pgTable("web_curriculum_import_jobs", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

/**
 * Pre-generated baseline question bank. Each row is ONE bank item (a question
 * tagged with its subject × grade band × functioning level × difficulty cell),
 * stored as the full object in `data`. Grown daily by the
 * `baseline-bank-generator` CronJob (it calls assessment-svc/ai-svc and upserts
 * new questions here) and read by web-v2 `createBaseline` to serve baselines
 * instantly without an on-request LLM call. Platform-global reference data ⇒ no
 * RLS, like the rest of this file.
 */
export const webBaselineBank = pgTable("web_baseline_bank", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});
