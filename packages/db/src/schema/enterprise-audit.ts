import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

/**
 * Enterprise audit events written by the @aivo/audit-svc. This is separate
 * from the legacy `audit_events` table in `audit.ts`: it omits the strict
 * hash-chain columns (the new flow stores beforeHash/afterHash for
 * recommendation effects, not a global chain) and indexes by tenant /
 * learner / action.
 */
export const enterpriseAuditEvents = pgTable(
  "enterprise_audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id"),
    actorId: uuid("actor_id"),
    actorRole: varchar("actor_role", { length: 40 }).notNull(),
    action: varchar("action", { length: 100 }).notNull(),
    resourceType: varchar("resource_type", { length: 100 }).notNull(),
    resourceId: varchar("resource_id", { length: 255 }),
    learnerId: uuid("learner_id"),
    beforeHash: varchar("before_hash", { length: 64 }),
    afterHash: varchar("after_hash", { length: 64 }),
    reason: text("reason"),
    ipHash: varchar("ip_hash", { length: 64 }),
    userAgentHash: varchar("user_agent_hash", { length: 64 }),
    metadataJson: jsonb("metadata_json").default({}),
    occurredAt: timestamp("occurred_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_enterprise_audit_tenant").on(table.tenantId),
    index("idx_enterprise_audit_learner").on(table.learnerId),
    index("idx_enterprise_audit_action").on(table.action),
    index("idx_enterprise_audit_occurred").on(table.occurredAt),
  ],
);
