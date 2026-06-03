/**
 * Impersonation sessions (Sprint 9 — Secure "View As").
 *
 * One row per impersonation grant. The acting admin (`actorId`) views as the
 * `subjectId` user for a bounded window (`startedAt` → `endsAt`), optionally
 * with writes enabled. Rows are immutable except `endedAt`, which is stamped
 * when the session is stopped or expires. The signed JWT carries `imp_sid`
 * referencing `id` so every downstream audit event can be joined back here.
 */
import { pgTable, uuid, varchar, timestamp, boolean, text, index } from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { tenants } from "./tenants.js";

export const impersonationSessions = pgTable(
  "impersonation_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id")
      .references(() => users.id)
      .notNull(),
    subjectId: uuid("subject_id")
      .references(() => users.id)
      .notNull(),
    tenantId: uuid("tenant_id").references(() => tenants.id),
    startedAt: timestamp("started_at").defaultNow().notNull(),
    endsAt: timestamp("ends_at").notNull(),
    endedAt: timestamp("ended_at"),
    reason: text("reason").notNull(),
    allowWrites: boolean("allow_writes").notNull().default(false),
    /** Documented legal/operational basis: SUBJECT_CONSENT, GUARDIAN_CONSENT, … */
    consentBasis: varchar("consent_basis", { length: 40 }),
    ip: varchar("ip", { length: 45 }),
    ua: text("ua"),
    justificationTicketId: varchar("justification_ticket_id", { length: 128 }),
  },
  (table) => [
    index("idx_impersonation_actor").on(table.actorId, table.startedAt),
    index("idx_impersonation_subject").on(table.subjectId),
    index("idx_impersonation_active").on(table.endedAt),
  ],
);

export type ImpersonationSessionRow = typeof impersonationSessions.$inferSelect;
export type NewImpersonationSessionRow = typeof impersonationSessions.$inferInsert;
