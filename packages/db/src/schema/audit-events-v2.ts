import {
  bigint,
  index,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Sprint 3 — canonical, hash-chained, append-only audit log (migration 0048,
 * table `audit_events_v2`, monthly range-partitioned on occurred_at).
 *
 * Distinct from the legacy `audit_events` (audit.ts / migration 0005): this
 * is the structured `/events` model surfaced by the audit console — actor /
 * entity / outcome / request_id, uuidv7 ids, and the prev_hash/hash chain.
 */
export const auditEventsV2 = pgTable(
  "audit_events_v2",
  {
    id: uuid("id").notNull(), // uuidv7
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    tenantId: uuid("tenant_id"), // null = platform-global
    actorId: varchar("actor_id", { length: 128 }).notNull(),
    actorRole: varchar("actor_role", { length: 48 }).notNull(),
    actorIp: varchar("actor_ip", { length: 64 }).notNull().default(""),
    actorUa: text("actor_ua").notNull().default(""),
    action: varchar("action", { length: 128 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 255 }).notNull().default(""),
    outcome: varchar("outcome", { length: 16 }).notNull(),
    details: jsonb("details").notNull().default({}),
    requestId: varchar("request_id", { length: 128 }).notNull().default(""),
    prevHash: varchar("prev_hash", { length: 64 }).notNull().default(""),
    hash: varchar("hash", { length: 64 }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.id, t.occurredAt] }),
    index("audit_events_v2_tenant_idx").on(t.tenantId, t.occurredAt),
    index("audit_events_v2_action_idx").on(t.action, t.occurredAt),
    index("audit_events_v2_actor_idx").on(t.actorId, t.occurredAt),
    index("audit_events_v2_entity_idx").on(t.entityType, t.entityId),
  ],
);

/** Daily tamper-evidence anchor mirrored to WORM / object-lock storage. */
export const auditAnchors = pgTable("audit_anchors", {
  id: uuid("id").defaultRandom().primaryKey(),
  anchoredAt: timestamp("anchored_at", { withTimezone: true }).defaultNow().notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
  eventCount: bigint("event_count", { mode: "number" }).notNull(),
  headHash: varchar("head_hash", { length: 64 }).notNull(),
  wormRef: text("worm_ref"),
});
