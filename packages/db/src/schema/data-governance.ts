import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const dpaAcceptances = pgTable(
  "dpa_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id").notNull(),
    version: varchar("version", { length: 60 }).notNull(),
    acceptedById: uuid("accepted_by_id").notNull(),
    acceptedByName: text("accepted_by_name").notNull(),
    acceptedByRole: varchar("accepted_by_role", { length: 40 }).notNull(),
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_dpa_acceptances_district").on(table.districtId),
    index("idx_dpa_acceptances_version").on(table.version),
  ],
);

export const deletionRequests = pgTable(
  "deletion_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id").notNull(),
    requesterId: uuid("requester_id").notNull(),
    requesterRole: varchar("requester_role", { length: 40 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("PENDING_REVIEW"),
    exportBeforeDelete: jsonb("export_before_delete").default(true),
    retentionHoldJson: jsonb("retention_hold_json"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_deletion_requests_learner").on(table.learnerId),
    index("idx_deletion_requests_status").on(table.status),
  ],
);

export const dataExportJobs = pgTable(
  "data_export_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    learnerId: uuid("learner_id").notNull(),
    requestedById: uuid("requested_by_id").notNull(),
    requestedByRole: varchar("requested_by_role", { length: 40 }).notNull(),
    status: varchar("status", { length: 30 }).default("queued").notNull(),
    formats: jsonb("formats").default([]),
    storageRefs: jsonb("storage_refs").default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_data_export_jobs_learner").on(table.learnerId),
    index("idx_data_export_jobs_status").on(table.status),
  ],
);
