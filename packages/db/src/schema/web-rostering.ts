/**
 * Web-owned rostering / SIS / lesson-sync persistence tables (Sprint 6).
 *
 * The `admin` domain already owns schools / classrooms / enrollments; this
 * extends rostering with the web-owned operational aggregates: courses, the
 * roster-import job + per-row error log (must be durable + re-runnable), the
 * SIS connection + external-roster-mapping aggregates web surfaces, and the
 * multi-device lesson-sync state (keyed by lessonRunId, optimistic-concurrency
 * `version`).
 *
 * Boundary (ADR 0015): the CANONICAL SIS sync is owned by integrations-svc and
 * the teacher-rostering grant by identity-svc — those are read over REST
 * (lib/rostering/integrations-svc-client.ts; the in-memory lib/db/sis-store.ts
 * + lib/db/rostering-grants.ts are documented dev mocks of that service data,
 * not web_* migration targets). `deviceSessions` has no repos accessor and is
 * intentionally omitted.
 *
 * RLS: NOT applied. These are tenant-scoped (app code filters by tenant_id),
 * but roster-import jobs have a platform-admin CROSS-TENANT escape hatch
 * (getRosterImportJobAny) and lesson-sync enforces learner/tenant scoping in
 * app code — so, like the other admin-accessed web_* tables, a per-connection
 * tenant policy is omitted in favour of explicit app-layer scoping.
 *
 * Conventions match web-domain.ts: TEXT ids, full object in `data` JSONB,
 * predicate columns only for the WHERE filters the store uses.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

export const webCourses = pgTable(
  "web_courses",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_courses_tenant_idx").on(t.tenantId) }),
);

export const webRosterImportJobs = pgTable(
  "web_roster_import_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_roster_import_jobs_tenant_idx").on(t.tenantId) }),
);

export const webRosterImportErrors = pgTable(
  "web_roster_import_errors",
  {
    id: text("id").primaryKey(),
    jobId: text("job_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_roster_import_errors_job_idx").on(t.jobId) }),
);

export const webSisConnections = pgTable(
  "web_sis_connections",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_sis_connections_tenant_idx").on(t.tenantId) }),
);

export const webExternalRosterMappings = pgTable(
  "web_external_roster_mappings",
  {
    id: text("id").primaryKey(),
    connectionId: text("connection_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_external_roster_mappings_conn_idx").on(t.connectionId) }),
);

export const webLessonSyncStates = pgTable("web_lesson_sync_states", {
  lessonRunId: text("lesson_run_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  data: jsonb("data").notNull(),
});
