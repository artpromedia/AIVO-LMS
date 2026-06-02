import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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

// ── Sprint 5: Compliance Console (DSAR / retention / consent / catalog) ──────

/**
 * Data Subject Access Requests (GDPR Arts. 15-22, CCPA/CPRA, FERPA).
 * `subjectId` is the data subject (a learner or a user); `requesterId` is
 * who filed it (may be a parent acting for a minor under COPPA).
 */
export const dsarRequests = pgTable(
  "dsar_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id"),
    /** access | erasure | portability | rectification | restriction | objection */
    type: varchar("type", { length: 24 }).notNull(),
    /** Regulation the SLA clock follows: gdpr | ccpa | ferpa. */
    regulation: varchar("regulation", { length: 16 }).default("gdpr").notNull(),
    subjectId: uuid("subject_id").notNull(),
    subjectType: varchar("subject_type", { length: 24 }).default("learner").notNull(),
    subjectEmail: text("subject_email"),
    requesterId: uuid("requester_id"),
    requesterRole: varchar("requester_role", { length: 40 }),
    /** parent-on-behalf-of-minor flag for COPPA handling. */
    onBehalfOfMinor: boolean("on_behalf_of_minor").default(false).notNull(),
    /**
     * intake → identity_verification → assigned → approved → fulfilling →
     * fulfilled | rejected. Terminal: fulfilled, rejected.
     */
    status: varchar("status", { length: 32 }).default("intake").notNull(),
    identityVerified: boolean("identity_verified").default(false).notNull(),
    verificationMethod: varchar("verification_method", { length: 40 }),
    assigneeId: uuid("assignee_id"),
    /** Evidence artifacts (export refs, checksums, completion receipts). */
    evidence: jsonb("evidence").default([]),
    notes: text("notes"),
    ackDueAt: timestamp("ack_due_at"),
    fulfillmentDueAt: timestamp("fulfillment_due_at"),
    acknowledgedAt: timestamp("acknowledged_at"),
    fulfilledAt: timestamp("fulfilled_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_dsar_requests_status").on(table.status),
    index("idx_dsar_requests_subject").on(table.subjectId),
    index("idx_dsar_requests_tenant").on(table.tenantId),
    index("idx_dsar_requests_fulfillment_due").on(table.fulfillmentDueAt),
  ],
);

/** Append-only timeline of everything that happened to a DSAR. */
export const dsarEvents = pgTable(
  "dsar_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dsarId: uuid("dsar_id").notNull(),
    /** created | identity_verified | assigned | approved | rejected | fulfillment_started | service_responded | fulfilled | note */
    eventType: varchar("event_type", { length: 40 }).notNull(),
    actorId: uuid("actor_id"),
    actorRole: varchar("actor_role", { length: 40 }),
    detail: jsonb("detail").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_dsar_events_dsar").on(table.dsarId, table.createdAt)],
);

/**
 * Retention policy per data class, optionally scoped to a tenant (NULL =
 * platform default). `retentionDays` NULL means "retain indefinitely
 * (legal hold / no auto-purge)".
 */
export const retentionPolicies = pgTable(
  "retention_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id"),
    dataClass: varchar("data_class", { length: 80 }).notNull(),
    retentionDays: integer("retention_days"),
    /** purge | anonymize — what happens when the window elapses. */
    disposition: varchar("disposition", { length: 20 }).default("purge").notNull(),
    legalHold: boolean("legal_hold").default(false).notNull(),
    updatedById: uuid("updated_by_id"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idx_retention_policies_class_tenant").on(table.dataClass, table.tenantId),
  ],
);

/** Append-style consent ledger (COPPA verifiable parental consent, etc.). */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id"),
    subjectId: uuid("subject_id").notNull(),
    subjectType: varchar("subject_type", { length: 24 }).default("learner").notNull(),
    /** Consent purpose key, e.g. child_data_collection, ai_personalization. */
    consentType: varchar("consent_type", { length: 80 }).notNull(),
    granted: boolean("granted").notNull(),
    /** Who recorded the decision (a verifying parent for under-13). */
    actorId: uuid("actor_id"),
    actorRole: varchar("actor_role", { length: 40 }),
    method: varchar("method", { length: 40 }),
    policyVersion: varchar("policy_version", { length: 40 }),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_consents_subject").on(table.subjectId),
    index("idx_consents_tenant").on(table.tenantId),
    index("idx_consents_type").on(table.consentType),
  ],
);

/** Catalog of data classes: owning service, sensitivity, retention rule. */
export const dataCatalog = pgTable(
  "data_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    dataClass: varchar("data_class", { length: 80 }).notNull(),
    owningService: varchar("owning_service", { length: 60 }).notNull(),
    /** low | moderate | high | restricted (PII / FERPA education record). */
    sensitivity: varchar("sensitivity", { length: 20 }).notNull(),
    description: text("description"),
    /** Default retention rule in days; NULL = indefinite. */
    defaultRetentionDays: integer("default_retention_days"),
    /** Whether this class participates in erasure fan-out. */
    erasable: boolean("erasable").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("idx_data_catalog_class").on(table.dataClass)],
);
