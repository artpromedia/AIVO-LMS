import { pgTable, uuid, varchar, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Support ticket queue. Owned by admin-svc, surfaced in the web-admin platform
 * console. Replaces the in-memory store the legacy web-v2 admin used.
 *
 * `status` ∈ open | in_progress | resolved.
 */
export const supportTickets = pgTable(
  "support_tickets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    /** Reporting tenant; NULL for platform-level tickets. */
    tenantId: uuid("tenant_id"),
    /** Reporting user. */
    userId: uuid("user_id"),
    subject: varchar("subject", { length: 256 }).notNull(),
    body: text("body").notNull().default(""),
    status: varchar("status", { length: 16 }).notNull().default("open"),
    /** Admin/support agent the ticket is assigned to. */
    assigneeId: uuid("assignee_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_support_tickets_status").on(table.status),
    index("idx_support_tickets_tenant").on(table.tenantId),
  ],
);
