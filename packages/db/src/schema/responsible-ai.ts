/**
 * Responsible AI Console schema (Sprint 7).
 *
 * Drizzle definitions mirroring
 * `services/responsible-ai-svc/src/db/migrations/0001_responsible_ai_registry.sql`.
 *
 * Table names are `rai_`-prefixed to avoid any collision with other
 * @aivo/db tables (e.g. a future generic `models`/`policies`/`incidents`).
 * CHECK-constrained columns from the authoritative SQL (modality, status,
 * scope_level, harness, severity, state) are kept as plain text/varchar
 * here and validated in the application layer — the registry routes already
 * validate these values before persisting.
 */
import {
  bigint,
  boolean,
  date,
  index,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const raiModels = pgTable(
  "rai_models",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    provider: text("provider").notNull(),
    modality: text("modality").notNull(),
    status: text("status").notNull(),
    ownerTeam: text("owner_team").notNull(),
    ownerContact: text("owner_contact").notNull(),
    intendedUse: text("intended_use").notNull().default(""),
    outOfScopeUse: text("out_of_scope_use").notNull().default(""),
    currentVersionId: text("current_version_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("idx_rai_models_status").on(table.status),
    index("idx_rai_models_modality").on(table.modality),
  ],
);

export const raiModelVersions = pgTable(
  "rai_model_versions",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id").notNull(),
    version: text("version").notNull(),
    releasedAt: timestamp("released_at", { withTimezone: true }).notNull(),
    changelog: text("changelog").notNull().default(""),
    provenanceHash: text("provenance_hash").notNull(),
  },
  (table) => [uniqueIndex("idx_rai_model_versions_model_version").on(table.modelId, table.version)],
);

export const raiModelCards = pgTable("rai_model_cards", {
  modelId: text("model_id").primaryKey(),
  markdown: text("markdown").notNull(),
  metadata: jsonb("metadata").notNull(),
});

export const raiPolicies = pgTable(
  "rai_policies",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    scopeLevel: text("scope_level").notNull(),
    scopeId: text("scope_id"),
    contentSafety: jsonb("content_safety").notNull(),
    ageGating: jsonb("age_gating").notNull(),
    regionRestrictions: jsonb("region_restrictions").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    updatedBy: text("updated_by").notNull(),
  },
  (table) => [index("idx_rai_policies_scope").on(table.scopeLevel, table.scopeId)],
);

export const raiEvals = pgTable("rai_evals", {
  id: text("id").primaryKey(),
  modelId: text("model_id").notNull(),
  harness: text("harness").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const raiEvalRuns = pgTable(
  "rai_eval_runs",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id").notNull(),
    harness: text("harness").notNull(),
    status: text("status").notNull(),
    metrics: jsonb("metrics"),
    cases: jsonb("cases").notNull().default([]),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    triggeredBy: text("triggered_by").notNull(),
  },
  (table) => [index("idx_rai_eval_runs_model").on(table.modelId, table.startedAt)],
);

export const raiIncidents = pgTable(
  "rai_incidents",
  {
    id: text("id").primaryKey(),
    modelId: text("model_id"),
    tenantId: text("tenant_id"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    severity: text("severity").notNull(),
    state: text("state").notNull(),
    reportedBy: text("reported_by").notNull(),
    reportedByRole: text("reported_by_role").notNull(),
    timeline: jsonb("timeline").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_rai_incidents_tenant").on(table.tenantId, table.createdAt)],
);

export const raiOptouts = pgTable(
  "rai_optouts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    modelId: text("model_id"),
    feature: text("feature"),
    reason: text("reason").notNull().default(""),
    createdBy: text("created_by").notNull(),
    createdByRole: text("created_by_role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("idx_rai_optouts_tenant").on(table.tenantId)],
);

export const raiUsageAggregates = pgTable(
  "rai_usage_aggregates",
  {
    modelId: text("model_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    date: date("date").notNull(),
    calls: bigint("calls", { mode: "number" }).notNull().default(0),
    tokens: bigint("tokens", { mode: "number" }).notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 2 }).notNull().default("0"),
  },
  (table) => [
    uniqueIndex("idx_rai_usage_aggregates_pk").on(table.modelId, table.tenantId, table.date),
  ],
);
