import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Speech Buddy parent-consent store (family-svc).
 *
 * Replaces the `SPEECH_BUDDY_DEV_CONSENTS` env allow-list with a real
 * per-(tenant, learner) consent record carrying the granted age band.
 * tutor-svc verifies against this on every Speech Buddy session start;
 * the parent grant/revoke UI writes it.
 *
 * An *active* grant is a row with `revoked_at IS NULL`. Granting again
 * after a revoke inserts a fresh row (the history is retained for audit);
 * the lookup always takes the most recent active row.
 */
export const speechBuddyConsents = pgTable(
  "speech_buddy_consents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    learnerId: uuid("learner_id").notNull(),
    parentUserId: uuid("parent_user_id").notNull(),
    // "6-9" | "10-12" | "13-15"
    ageBand: varchar("age_band", { length: 8 }).notNull(),
    // Reserved for future Speech-Buddy-adjacent scopes; defaults to the
    // only scope today so the verify lookup is stable.
    scope: varchar("scope", { length: 32 }).notNull().default("speech_buddy"),
    grantedAt: timestamp("granted_at", { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => ({
    tenantLearnerIdx: index("speech_buddy_consents_tenant_learner_idx").on(
      t.tenantId,
      t.learnerId,
    ),
    learnerIdx: index("speech_buddy_consents_learner_idx").on(t.learnerId),
  }),
);

export type SpeechBuddyConsent = typeof speechBuddyConsents.$inferSelect;
