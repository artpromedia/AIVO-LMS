import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  text,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const contactSubmissions = pgTable("contact_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: varchar("type", { length: 50 }).notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).notNull(),
  company: varchar("company", { length: 255 }),
  role: varchar("role", { length: 100 }),
  schoolSize: varchar("school_size", { length: 50 }),
  message: text("message"),
  source: varchar("source", { length: 100 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Durable transactional-email outbox. comms-svc enqueues every send here
 * before the Postmark API is touched; a drain worker reserves rows with
 * SELECT ... FOR UPDATE SKIP LOCKED and updates them with the provider
 * outcome. status values:
 *   pending     - new row, will be picked up on next drain
 *   sending     - reserved by a worker (in-flight)
 *   sent        - successfully handed to Postmark; provider_message_id set
 *   failed      - last attempt failed, will retry after next_retry_at
 *   dead_letter - exceeded max_attempts; requires manual intervention
 *   bounced     - reconciled via Postmark webhook
 *   complained  - reconciled via Postmark webhook (spam complaint)
 */
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    dedupeKey: text("dedupe_key"),
    sendKind: text("send_kind").notNull().default("raw"),
    toEmail: text("to_email").notNull(),
    subject: text("subject"),
    htmlBody: text("html_body"),
    textBody: text("text_body"),
    templateAlias: text("template_alias"),
    templateModel: jsonb("template_model"),
    tag: text("tag"),
    replyTo: text("reply_to"),
    metadata: jsonb("metadata"),
    status: text("status").notNull().default("pending"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(6),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }).defaultNow().notNull(),
    lastError: text("last_error"),
    providerMessageId: text("provider_message_id"),
    tenantId: uuid("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    failedAt: timestamp("failed_at", { withTimezone: true }),
  },
  (t) => ({
    dedupeUidx: uniqueIndex("email_outbox_dedupe_key_uidx").on(t.dedupeKey),
    pendingIdx: index("email_outbox_pending_idx").on(t.nextRetryAt),
    providerMessageIdIdx: index("email_outbox_provider_message_id_idx").on(t.providerMessageId),
    statusIdx: index("email_outbox_status_idx").on(t.status),
  }),
);
