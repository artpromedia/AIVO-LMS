import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  text,
  decimal,
  boolean,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { tenants } from "./tenants.js";
import { users } from "./users.js";

export const moderationStatusEnum = pgEnum("moderation_status", [
  "PENDING",
  "APPROVED",
  "REJECTED",
  "ESCALATED",
  "LOW_CONFIDENCE",
]);

export const contentModerationLog = pgTable(
  "content_moderation_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    learnerId: uuid("learner_id"),
    sessionId: uuid("session_id"),
    contentType: varchar("content_type", { length: 50 }).notNull(),
    content: text("content").notNull(),
    flagReason: varchar("flag_reason", { length: 100 }).notNull(),
    flagConfidence: decimal("flag_confidence", { precision: 4, scale: 3 }),
    gateResults: jsonb("gate_results"),
    tutorSku: varchar("tutor_sku", { length: 100 }),
    modelUsed: varchar("model_used", { length: 100 }),
    status: moderationStatusEnum("status").notNull().default("PENDING"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at"),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_moderation_log_status").on(table.status),
    index("idx_moderation_log_created").on(table.createdAt),
    index("idx_moderation_log_tenant").on(table.tenantId),
    index("idx_moderation_log_tutor").on(table.tutorSku),
  ],
);

export const moderationPolicies = pgTable(
  "moderation_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    name: varchar("name", { length: 255 }).notNull(),
    patterns: jsonb("patterns").notNull(),
    action: varchar("action", { length: 20 }).notNull().default("flag"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_moderation_policies_tenant").on(table.tenantId),
    index("idx_moderation_policies_enabled").on(table.enabled),
  ],
);
