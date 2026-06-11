import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  text,
  integer,
  decimal,
  boolean,
  index,
  uniqueIndex,
  bigserial,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { tenants } from "./tenants.js";

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    // No FK on purpose (Sprint B5): actors include non-user principals —
    // SCIM tokens, service identities — and an append-only audit ledger
    // must never refuse a record because the actor isn't a users row
    // (the FK silently dropped EVERY SCIM audit write via the
    // best-effort emit path).
    actorId: uuid("actor_id").notNull(),
    actorEmail: varchar("actor_email", { length: 255 }).notNull(),
    actorRole: varchar("actor_role", { length: 50 }).notNull(),
    /** Set when actor was impersonating — actor is the real admin, this is the impersonated user. */
    onBehalfOfId: uuid("on_behalf_of_id").references(() => users.id),
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }),
    details: jsonb("details"),
    ipAddress: varchar("ip_address", { length: 45 }),
    userAgent: text("user_agent"),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    prevHash: varchar("prev_hash", { length: 64 }),
    hash: varchar("hash", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_audit_log_actor").on(table.actorId),
    index("idx_audit_log_action").on(table.action),
    index("idx_audit_log_resource").on(table.resourceType, table.resourceId),
    index("idx_audit_log_created").on(table.createdAt),
  ],
);

export const platformConfig = pgTable("platform_config", {
  id: uuid("id").defaultRandom().primaryKey(),
  config: jsonb("config").notNull(),
  changedBy: uuid("changed_by").references(() => users.id),
  changeDescription: text("change_description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dataRequests = pgTable("data_requests", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("submitted"),
  subjectId: uuid("subject_id").references(() => users.id),
  subjectEmail: varchar("subject_email", { length: 255 }),
  requesterId: uuid("requester_id").references(() => users.id),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  slaDeadline: timestamp("sla_deadline"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const aiUsageLog = pgTable(
  "ai_usage_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: varchar("provider", { length: 50 }).notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    latencyMs: integer("latency_ms").notNull(),
    estimatedCostUsd: decimal("estimated_cost_usd", { precision: 10, scale: 6 }),
    learnerId: uuid("learner_id"),
    tutorKey: varchar("tutor_key", { length: 50 }),
    sessionId: uuid("session_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_ai_usage_created").on(table.createdAt),
    index("idx_ai_usage_provider").on(table.provider, table.createdAt),
  ],
);

export const contentModerationQueue = pgTable("content_moderation_queue", {
  id: uuid("id").defaultRandom().primaryKey(),
  content: text("content").notNull(),
  contentType: varchar("content_type", { length: 50 }).notNull(),
  flagReason: varchar("flag_reason", { length: 100 }).notNull(),
  flagConfidence: decimal("flag_confidence", { precision: 3, scale: 2 }),
  tutorKey: varchar("tutor_key", { length: 50 }),
  provider: varchar("provider", { length: 50 }),
  learnerId: uuid("learner_id"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  reviewerAction: varchar("reviewer_action", { length: 50 }),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailTemplates = pgTable("email_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: varchar("key", { length: 100 }).unique().notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyHtml: text("body_html").notNull(),
  bodyText: text("body_text"),
  variables: jsonb("variables").default([]),
  active: boolean("active").default(true),
  updatedBy: uuid("updated_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const webhooks = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  url: varchar("url", { length: 2048 }).notNull(),
  events: jsonb("events").notNull(),
  secret: varchar("secret", { length: 255 }).notNull(),
  active: boolean("active").default(true),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  createdBy: uuid("created_by").references(() => users.id),
  lastDeliveryAt: timestamp("last_delivery_at"),
  lastDeliveryStatus: varchar("last_delivery_status", { length: 20 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const webhookDeliveries = pgTable("webhook_deliveries", {
  id: uuid("id").defaultRandom().primaryKey(),
  webhookId: uuid("webhook_id")
    .references(() => webhooks.id)
    .notNull(),
  event: varchar("event", { length: 100 }).notNull(),
  payload: jsonb("payload").notNull(),
  responseStatus: integer("response_status"),
  responseBody: text("response_body"),
  deliveredAt: timestamp("delivered_at").defaultNow().notNull(),
});

export const leadSubmissions = pgTable(
  "lead_submissions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: varchar("type", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    company: varchar("company", { length: 255 }),
    role: varchar("role", { length: 100 }),
    message: text("message"),
    schoolSize: varchar("school_size", { length: 50 }),
    gradeBand: varchar("grade_band", { length: 50 }),
    interestArea: varchar("interest_area", { length: 100 }),
    source: varchar("source", { length: 50 }).default("website"),
    // Lead lifecycle: new → contacted → qualified → pilot → won/lost.
    status: varchar("status", { length: 50 }).notNull().default("new"),
    // Campaign attribution so a pilot coupon can be traced to its source.
    utmSource: varchar("utm_source", { length: 120 }),
    utmMedium: varchar("utm_medium", { length: 120 }),
    utmCampaign: varchar("utm_campaign", { length: 120 }),
    couponCode: varchar("coupon_code", { length: 64 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_lead_submissions_type").on(table.type),
    index("idx_lead_submissions_email").on(table.email),
    index("idx_lead_submissions_created").on(table.createdAt),
    index("idx_lead_submissions_status").on(table.status),
  ],
);

/**
 * Sprint 11: nightly SOC 2 evidence bundles. Each row points at a
 * locally generated tar.gz on disk; `sha256` is the content hash so
 * the compliance UI can let auditors verify integrity. In production
 * the bundle should be mirrored to a WORM-locked S3 bucket — see
 * `services/admin-svc/src/lib/soc2-evidence.ts` for the swap point.
 */
export const evidenceBundles = pgTable(
  "evidence_bundles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** YYYY-MM-DD the bundle covers (UTC). One bundle per day. */
    bundleDate: varchar("bundle_date", { length: 10 }).notNull().unique(),
    filename: varchar("filename", { length: 255 }).notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    sha256: varchar("sha256", { length: 64 }).notNull(),
    storageUri: varchar("storage_uri", { length: 2048 }),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    /** Counts of items inside each artifact, for at-a-glance review. */
    summary: jsonb("summary").notNull(),
    generatedAt: timestamp("generated_at").defaultNow().notNull(),
  },
  (table) => [index("idx_evidence_bundles_date").on(table.bundleDate)],
);

/**
 * Sprint 7: API keys with rotation grace and expiry.
 * `rotatedFromId` is set on the new key minted by a rotation; the old key
 * keeps working until `gracePeriodEndsAt` so callers have a 24h window to
 * roll over. `expiresAt` defaults to now()+90d at creation.
 */
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    keyHash: varchar("key_hash", { length: 255 }).notNull(),
    keyPrefix: varchar("key_prefix", { length: 10 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    scopes: jsonb("scopes").notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    createdBy: uuid("created_by").references(() => users.id),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    rotatedFromId: uuid("rotated_from_id"),
    gracePeriodEndsAt: timestamp("grace_period_ends_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_api_keys_prefix").on(table.keyPrefix),
    index("idx_api_keys_tenant").on(table.tenantId),
  ],
);

/**
 * Sprint 6: per-tenant SCIM 2.0 bearer tokens. Token plaintext is shown
 * exactly once at creation; we store sha256 hash + 8-char prefix for
 * display. Rotation issues a new row and revokes the prior one.
 */
export const scimTokens = pgTable(
  "scim_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    tokenHash: varchar("token_hash", { length: 64 }).notNull().unique(),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    createdBy: uuid("created_by").references(() => users.id),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("idx_scim_tokens_tenant").on(table.tenantId)],
);

/**
 * Sprint B5: IdP group pushes that did NOT match the class-group naming
 * convention (or referenced an unknown school). Recorded — never silently
 * dropped — so the district SIS page can show exactly what the IdP tried
 * to push and why it was skipped. `lastSeenAt`/`seenCount` dedupe repeat
 * pushes of the same group; `resolvedAt` hides reviewed rows.
 */
export const scimUnmappedGroups = pgTable(
  "scim_unmapped_groups",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .references(() => tenants.id)
      .notNull(),
    displayName: varchar("display_name", { length: 512 }).notNull(),
    externalId: varchar("external_id", { length: 255 }),
    reason: varchar("reason", { length: 64 }).notNull(),
    memberCount: integer("member_count").default(0).notNull(),
    firstSeenAt: timestamp("first_seen_at").defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    seenCount: integer("seen_count").default(1).notNull(),
    resolvedAt: timestamp("resolved_at"),
    resolvedBy: uuid("resolved_by").references(() => users.id),
  },
  (table) => [
    index("idx_scim_unmapped_groups_tenant").on(table.tenantId),
    uniqueIndex("idx_scim_unmapped_groups_unique").on(table.tenantId, table.displayName),
  ],
);
