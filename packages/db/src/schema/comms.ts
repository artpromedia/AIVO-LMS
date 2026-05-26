import { pgTable, uuid, varchar, timestamp, text, boolean, bigint, index, uniqueIndex } from "drizzle-orm/pg-core";

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

// ─── Sprint 13: messaging ─────────────────────────────────────────────────
// See packages/db/migrations/0046_messaging.sql and
// docs/comms/boundaries.md for the boundary policy these tables encode.

export const messageThreads = pgTable(
  "message_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    kind: text("kind").notNull(), // parent_teacher | learner_teacher_lesson | therapist_family | district_announcement
    tenantId: uuid("tenant_id").notNull(),
    learnerId: uuid("learner_id"),
    lessonId: uuid("lesson_id"),
    createdBy: uuid("created_by").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_message_threads_tenant_kind").on(table.tenantId, table.kind),
    index("idx_message_threads_learner").on(table.learnerId),
    index("idx_message_threads_lesson").on(table.lessonId),
  ],
);

export const messageThreadParticipants = pgTable(
  "message_thread_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id").notNull(),
    userId: uuid("user_id").notNull(),
    role: text("role").notNull(), // author | reader | observer
    joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("uq_thread_participant").on(table.threadId, table.userId),
    index("idx_message_thread_participants_user").on(table.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id").notNull(),
    authorId: uuid("author_id").notNull(),
    body: text("body").notNull(),
    bodyFormat: text("body_format").notNull().default("plain"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    editedAt: timestamp("edited_at", { withTimezone: true }),
    redactedAt: timestamp("redacted_at", { withTimezone: true }),
    redactedReason: text("redacted_reason"),
  },
  (table) => [index("idx_messages_thread_created").on(table.threadId, table.createdAt)],
);

export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id").notNull(),
    storageUrl: text("storage_url").notNull(),
    mimeType: text("mime_type").notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number" }).notNull(),
    sanitizerStatus: text("sanitizer_status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index("idx_message_attachments_message").on(table.messageId)],
);

export const messageReadReceipts = pgTable(
  "message_read_receipts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id").notNull(),
    userId: uuid("user_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_message_read_receipt").on(table.messageId, table.userId),
    index("idx_message_read_receipts_user").on(table.userId),
  ],
);

export const messageConsent = pgTable(
  "message_consent",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    channel: text("channel").notNull(), // email | sms | push | in_app
    optedIn: boolean("opted_in").notNull(),
    optedInAt: timestamp("opted_in_at", { withTimezone: true }).defaultNow().notNull(),
    source: text("source"),
  },
  (table) => [
    uniqueIndex("uq_message_consent_user_channel").on(table.userId, table.channel),
    index("idx_message_consent_user").on(table.userId),
  ],
);

export type MessageThread = typeof messageThreads.$inferSelect;
export type MessageThreadInsert = typeof messageThreads.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type MessageInsert = typeof messages.$inferInsert;
export type MessageThreadParticipant = typeof messageThreadParticipants.$inferSelect;
export type MessageThreadParticipantInsert = typeof messageThreadParticipants.$inferInsert;
export type MessageAttachment = typeof messageAttachments.$inferSelect;
export type MessageAttachmentInsert = typeof messageAttachments.$inferInsert;
export type MessageReadReceipt = typeof messageReadReceipts.$inferSelect;
export type MessageConsent = typeof messageConsent.$inferSelect;
export type MessageConsentInsert = typeof messageConsent.$inferInsert;
