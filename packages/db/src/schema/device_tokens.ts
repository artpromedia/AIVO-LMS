import { pgTable, uuid, text, varchar, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Push device-token registry (comms-svc).
 *
 * Maps an owning user to the FCM/APNs device tokens for their installs, so
 * user-addressed push (`POST /api/comms/push`) can resolve a userId to the
 * concrete tokens the push-router needs. Previously that endpoint returned a
 * fake "queued" status because there was no token store.
 *
 * `token` is globally unique — a device token belongs to one install; on
 * re-register (refresh, or device handed to a new user) we upsert by token.
 * Tokens the provider reports as invalid are pruned on send.
 */
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id").notNull(),
    token: text("token").notNull().unique(),
    // "fcm" | "apns"
    kind: varchar("kind", { length: 8 }).notNull(),
    // "ios" | "android" | "web" (optional, informational)
    platform: varchar("platform", { length: 16 }),
    // APNs topic / bundle id (optional; defaults to APNS_BUNDLE_ID at send time)
    topic: varchar("topic", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userIdx: index("device_tokens_user_idx").on(t.userId),
  }),
);

export type DeviceToken = typeof deviceTokens.$inferSelect;
