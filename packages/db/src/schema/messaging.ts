import { pgTable, uuid, varchar, text, timestamp, index, unique } from "drizzle-orm/pg-core";

/**
 * Unified inbox / threaded messaging (ADR 0020 — the `/messages` surface).
 *
 * A thread groups a small set of participants (e.g. a parent and a teacher)
 * around an optional learner. Messages belong to a thread; per-participant
 * `lastReadAt` drives unread counts. Tenant-scoped; participants are checked
 * on every read/write in comms-svc.
 */
export const messageThreads = pgTable(
  "message_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    createdByUserId: uuid("created_by_user_id").notNull(),
    // Optional learner the conversation is about.
    learnerId: uuid("learner_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    tenantIdx: index("message_threads_tenant_idx").on(t.tenantId),
  }),
);

export const messageThreadParticipants = pgTable(
  "message_thread_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id").notNull(),
    userId: uuid("user_id").notNull(),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("message_thread_participants_user_idx").on(t.userId),
    threadIdx: index("message_thread_participants_thread_idx").on(t.threadId),
    uniqueMember: unique("message_thread_participants_thread_user_key").on(t.threadId, t.userId),
  }),
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id").notNull(),
    senderUserId: uuid("sender_user_id").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    threadIdx: index("messages_thread_idx").on(t.threadId),
  }),
);

export type MessageThread = typeof messageThreads.$inferSelect;
export type MessageThreadParticipant = typeof messageThreadParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
