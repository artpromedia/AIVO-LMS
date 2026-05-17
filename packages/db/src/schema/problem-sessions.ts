import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  varchar,
  boolean,
} from "drizzle-orm/pg-core";

export const problemSessions = pgTable(
  "problem_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    learnerId: uuid("learner_id").notNull(),
    subject: varchar("subject", { length: 100 }).notNull(),
    skillCode: varchar("skill_code", { length: 100 }),
    standardCode: varchar("standard_code", { length: 100 }),
    source: varchar("source", { length: 50 }).notNull(),
    sourceSessionId: uuid("source_session_id"),
    tutorSku: varchar("tutor_sku", { length: 100 }),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
    metadataJson: jsonb("metadata_json").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_problem_sessions_tenant").on(table.tenantId),
    index("idx_problem_sessions_learner").on(table.learnerId),
    index("idx_problem_sessions_subject").on(table.subject),
    index("idx_problem_sessions_skill").on(table.skillCode),
    index("idx_problem_sessions_standard").on(table.standardCode),
  ],
);

export const problemSessionEvents = pgTable(
  "problem_session_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    problemSessionId: uuid("problem_session_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    learnerId: uuid("learner_id").notNull(),
    eventType: varchar("event_type", { length: 80 }).notNull(),
    eventPayloadJson: jsonb("event_payload_json").default({}),
    redactedPayloadJson: jsonb("redacted_payload_json").default({}),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_problem_session_events_session").on(table.problemSessionId),
    index("idx_problem_session_events_type").on(table.eventType),
    index("idx_problem_session_events_occurred").on(table.occurredAt),
    index("idx_problem_session_events_tenant").on(table.tenantId),
  ],
);

export const problemSessionSurfaceSnapshots = pgTable(
  "problem_session_surface_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    problemSessionId: uuid("problem_session_id").notNull(),
    surfaceId: varchar("surface_id", { length: 100 }).notNull(),
    snapshotType: varchar("snapshot_type", { length: 30 }).notNull(),
    snapshotJson: jsonb("snapshot_json").default({}),
    storageUrl: text("storage_url"),
    strokeCount: integer("stroke_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_problem_session_snapshots_session").on(table.problemSessionId),
    index("idx_problem_session_snapshots_surface").on(table.surfaceId),
  ],
);

export const problemSessionAttempts = pgTable(
  "problem_session_attempts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    problemSessionId: uuid("problem_session_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    responseJson: jsonb("response_json").default({}),
    correct: boolean("correct").default(false),
    score: real("score"),
    latencyMs: integer("latency_ms").default(0),
    hintCount: integer("hint_count").default(0),
    eraserCount: integer("eraser_count").default(0),
    toolChangeCount: integer("tool_change_count").default(0),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_problem_session_attempts_session").on(table.problemSessionId),
    index("idx_problem_session_attempts_number").on(table.attemptNumber),
  ],
);
