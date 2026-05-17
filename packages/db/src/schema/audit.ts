import { pgTable, uuid, varchar, timestamp, jsonb, text, bigserial } from "drizzle-orm/pg-core";

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  /**
   * Monotonic sequence used for deterministic chain ordering. Inserts at the
   * SQL level rely on the DB to assign the next value; readers walk
   * `ORDER BY seq ASC` to verify the hash chain.
   */
  seq: bigserial("seq", { mode: "number" }).notNull(),
  tenantId: uuid("tenant_id"),
  userId: uuid("user_id"),
  /** When set, `userId` was acting on behalf of this admin (impersonation). */
  onBehalfOfId: uuid("on_behalf_of_id"),
  eventType: varchar("event_type", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 100 }),
  resourceId: varchar("resource_id", { length: 255 }),
  details: jsonb("details").default({}),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  /** sha256 hex of the previous row's `hash`, or empty string for the genesis row. */
  prevHash: varchar("prev_hash", { length: 64 }),
  /** sha256 hex of `prevHash || canonicalJSON(payload)`. */
  hash: varchar("hash", { length: 64 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
