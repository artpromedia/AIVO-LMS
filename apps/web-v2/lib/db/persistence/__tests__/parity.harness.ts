/**
 * Parity harness (Sprint 0) — the reusable rig every later sprint imports.
 *
 * `runInBothModes(name, suite)` registers the *same* `suite` twice:
 *   1. against the in-memory adapters (reset + seeded per test), and
 *   2. against a real, migrated Postgres (testcontainer or
 *      `AIVO_TEST_DATABASE_URL`), truncated + reseeded per test.
 *
 * Every domain is forced to the active mode via the test-only
 * `__setPersistenceModeOverride` seam, so `getPersistence()` — and any
 * `repos.ts` function that calls it — resolves to a single backend for the
 * duration of the suite. That is what lets a suite written once prove that
 * memory and postgres are byte-for-byte equivalent.
 *
 * Cross-mode value parity: a suite can wrap a read in `ctx.parity(label, fn)`.
 * The memory pass records the (normalised) return value; the postgres pass
 * re-runs the same read and `expect(...).toEqual(...)` against the recorded
 * value. Because the two describe blocks run sequentially within the file,
 * the recorded values are available to the postgres pass. Use this for reads
 * of seeded reference data (ids/timestamps are stable across modes); for
 * mutation flows whose ids/timestamps are generated per run, assert the
 * invariant directly inside the suite (it still runs against both backends).
 *
 * Postgres is opt-in at collection time: set `AIVO_TEST_DATABASE_URL` (CI
 * provisions a Postgres service) or `AIVO_PARITY_POSTGRES=1` (local Docker via
 * testcontainers). With neither, the postgres pass registers a single skipped
 * test so the file stays green on Docker-less machines — mirroring the
 * skip-when-no-DB convention in `stores.postgres.contract.test.ts`.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore } from "@/lib/db/store";
import {
  getPersistence,
  resetPersistence,
  __setPersistenceModeOverride,
  type Persistence,
  type PersistenceMode,
} from "..";
import { seedPostgres } from "../seed-postgres";
import { startPostgres, type PostgresHandle } from "./pg-testcontainer";

/** Every table the web-v2 adapters touch — truncated between postgres cases. */
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
  "web_mastery_snapshots",
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
  "web_billing_accounts",
  "web_ai_budgets",
  "web_ai_cost_events",
  "web_coupons",
  "web_daily_billing_batches",
  "web_iep_ai_drafts",
  "web_security_controls",
  "web_control_evidence",
  "web_risk_register",
  "web_incidents",
  "web_incident_timeline",
  "web_vendors",
  "web_state_privacy_requirements",
  "web_state_privacy_mappings",
  "web_vulnerability_reports",
  "web_consent_versions",
  "web_terms_acceptances",
  "web_data_inventory",
  "web_data_retention_policies",
  "web_disclosure_logs",
  "web_data_export_requests",
  "web_data_deletion_requests",
  "web_iep_doc_access_logs",
  "web_courses",
  "web_roster_import_jobs",
  "web_roster_import_errors",
  "web_sis_connections",
  "web_external_roster_mappings",
  "web_lesson_sync_states",
  "web_audio_assets",
  "web_tts_generation_jobs",
  "web_pronunciation_overrides",
  "web_learner_voice_preferences",
  "web_read_aloud_usage_events",
  "web_audio_cache_entries",
  "web_safety_policy_versions",
  "web_moderation_events",
  "web_human_review_cases",
  "web_blocked_generations",
  "web_tutor_response_audits",
  "web_homework_input_audits",
  "web_support_tickets",
  "web_ai_generation_jobs",
  "web_tenant_settings",
  "web_platform_api_keys",
  "web_platform_email_templates",
  "web_platform_webhook_endpoints",
  "web_notification_preferences",
  "web_digest_schedules",
  "web_homework_help_sessions",
  "web_calm_sessions",
  "web_learner_engagement",
  "web_learner_badges",
  "web_learner_sensory_profiles",
  "web_standards_frameworks",
  "web_standard_documents",
  "web_standards",
  "web_domains",
  "web_skill_prerequisites",
  "web_skill_versions",
  "web_curriculum_maps",
  "web_lesson_objective_templates",
  "web_assessment_blueprints",
  "web_curriculum_import_jobs",
  "web_baseline_bank",
] as const;

const POSTGRES_ENABLED =
  Boolean(process.env.AIVO_TEST_DATABASE_URL) || process.env.AIVO_PARITY_POSTGRES === "1";

/** Drop undefined / normalise ordering so deep-equality is backend-agnostic. */
function normalise<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value ?? null));
}

/** Context handed to a parity suite. */
export interface ParityContext {
  /** The backend the suite is currently running against. */
  readonly mode: PersistenceMode;
  /** A fresh, mode-forced persistence handle. */
  persistence(): Persistence;
  /**
   * Record (memory pass) then assert (postgres pass) deep-equality of a
   * read's return value across both backends. Returns the raw value so it
   * can be used inline.
   *
   * The seed assigns random surrogate ids (`newId()`), so those differ
   * between the two seed runs and are not a parity signal. Pass `project`
   * to compare a stable view (e.g. sorted slugs) — that is what actually
   * proves the same reference set landed in both backends.
   */
  parity<T>(label: string, fn: () => Promise<T> | T, project?: (value: T) => unknown): Promise<T>;
}

/** Recorded memory-pass values, keyed by `${name}::${label}`, read by postgres. */
const recorded = new Map<string, unknown>();

function makeContext(name: string, mode: PersistenceMode): ParityContext {
  return {
    mode,
    persistence: () => getPersistence(),
    async parity<T>(
      label: string,
      fn: () => Promise<T> | T,
      project?: (value: T) => unknown,
    ): Promise<T> {
      const value = await fn();
      const comparable = normalise(project ? project(value) : value);
      const key = `${name}::${label}`;
      if (mode === "memory") {
        recorded.set(key, comparable);
      } else {
        expect(recorded.has(key), `parity label "${label}" was not recorded in memory mode`).toBe(
          true,
        );
        expect(comparable).toEqual(recorded.get(key));
      }
      return value;
    },
  };
}

async function truncateAll(handle: PostgresHandle): Promise<void> {
  await handle.db.execute(
    sql.raw(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`),
  );
}

/**
 * Register `suite` against both the memory and postgres adapters.
 */
export function runInBothModes(name: string, suite: (ctx: ParityContext) => void): void {
  // ── memory ────────────────────────────────────────────────────────
  describe(`${name} — memory`, () => {
    beforeEach(() => {
      resetStore();
      ensureSeeded();
      __setPersistenceModeOverride("memory");
      resetPersistence();
    });
    afterEach(() => {
      __setPersistenceModeOverride(null);
    });
    suite(makeContext(name, "memory"));
  });

  // ── postgres ──────────────────────────────────────────────────────
  if (!POSTGRES_ENABLED) {
    describe(`${name} — postgres`, () => {
      it.skip("skipped — set AIVO_TEST_DATABASE_URL or AIVO_PARITY_POSTGRES=1", () => {});
    });
    return;
  }

  describe(`${name} — postgres`, () => {
    let handle: PostgresHandle | null = null;

    beforeAll(async () => {
      handle = await startPostgres();
      if (!handle) {
        throw new Error(
          "[parity] postgres mode enabled but no Postgres available — start " +
            "Docker (testcontainers) or set AIVO_TEST_DATABASE_URL.",
        );
      }
    });

    afterAll(async () => {
      __setPersistenceModeOverride(null);
      if (handle) await handle.teardown();
      handle = null;
    });

    beforeEach(async () => {
      if (!handle) return;
      // seedPostgres copies the in-memory store into postgres, so the memory
      // store must be pristine first — otherwise rows a prior memory-pass test
      // created leak into the postgres seed and skew counts.
      resetStore();
      ensureSeeded();
      await truncateAll(handle);
      await seedPostgres(handle.db);
      __setPersistenceModeOverride("postgres");
      resetPersistence();
    });

    suite(makeContext(name, "postgres"));
  });
}
