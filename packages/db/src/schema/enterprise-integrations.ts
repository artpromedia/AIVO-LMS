import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const enterpriseSisConnections = pgTable(
  "enterprise_sis_connections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id").notNull(),
    vendor: varchar("vendor", { length: 50 }).notNull(),
    status: varchar("status", { length: 30 }).default("inactive").notNull(),
    metadataJson: jsonb("metadata_json").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_enterprise_sis_conn_district").on(table.districtId),
    index("idx_enterprise_sis_conn_vendor").on(table.vendor),
  ],
);

export const enterpriseSisImportJobs = pgTable(
  "enterprise_sis_import_jobs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id").notNull(),
    connectionId: uuid("connection_id"),
    status: varchar("status", { length: 30 }).default("queued").notNull(),
    schoolsCount: integer("schools_count").default(0),
    classesCount: integer("classes_count").default(0),
    studentsCount: integer("students_count").default(0),
    enrollmentsCount: integer("enrollments_count").default(0),
    warningsJson: jsonb("warnings_json").default([]),
    errorMessage: text("error_message"),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    completedAt: timestamp("completed_at"),
  },
  (table) => [
    index("idx_enterprise_sis_jobs_district").on(table.districtId),
    index("idx_enterprise_sis_jobs_status").on(table.status),
  ],
);

export const enterpriseLtiTools = pgTable(
  "enterprise_lti_tools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    districtId: uuid("district_id"),
    issuer: text("issuer").notNull(),
    clientId: text("client_id").notNull(),
    deploymentId: text("deployment_id"),
    metadataJson: jsonb("metadata_json").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_enterprise_lti_tools_district").on(table.districtId),
    index("idx_enterprise_lti_tools_issuer").on(table.issuer),
  ],
);

export const enterpriseLtiLaunches = pgTable(
  "enterprise_lti_launches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    toolId: uuid("tool_id"),
    learnerId: uuid("learner_id"),
    contextId: text("context_id"),
    resourceLinkId: text("resource_link_id"),
    status: varchar("status", { length: 30 }).default("validated").notNull(),
    issuesJson: jsonb("issues_json").default([]),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_enterprise_lti_launches_tool").on(table.toolId),
    index("idx_enterprise_lti_launches_learner").on(table.learnerId),
  ],
);
