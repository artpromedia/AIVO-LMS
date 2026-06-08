/**
 * Web-owned engagement / learning-session / notification-prefs tables (Sprint 8
 * remainder).
 *
 * Notification preferences (keyed by userId) + digest schedules; homework-help
 * + calm sessions; per-learner engagement snapshot, badges, and sensory
 * profile (keyed by learnerId).
 *
 * Boundary (ADR 0015): the live gradebook/leaderboard engagement signal is
 * owned by engagement-svc / learning-svc and read over REST
 * (lib/engagement/engagement-svc-client.ts). These web_* rows are the web app's
 * OWN durable copies (the dev/mock surface + the per-learner sensory profile
 * the web actually authors).
 *
 * RLS: NOT applied — per-learner/per-user, app-layer scoping, consistent with
 * the other recent web_* domains.
 *
 * Conventions match web-domain.ts: TEXT ids, full object in `data` JSONB.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

export const webNotificationPreferences = pgTable("web_notification_preferences", {
  userId: text("user_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  data: jsonb("data").notNull(),
});

export const webDigestSchedules = pgTable(
  "web_digest_schedules",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_digest_schedules_tenant_idx").on(t.tenantId) }),
);

export const webHomeworkHelpSessions = pgTable(
  "web_homework_help_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_homework_help_sessions_tenant_idx").on(t.tenantId) }),
);

export const webCalmSessions = pgTable(
  "web_calm_sessions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_calm_sessions_tenant_idx").on(t.tenantId) }),
);

export const webLearnerEngagement = pgTable("web_learner_engagement", {
  learnerId: text("learner_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  data: jsonb("data").notNull(),
});

export const webLearnerBadges = pgTable(
  "web_learner_badges",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_learner_badges_tenant_idx").on(t.tenantId) }),
);

export const webLearnerSensoryProfiles = pgTable("web_learner_sensory_profiles", {
  learnerId: text("learner_id").primaryKey(),
  tenantId: text("tenant_id").notNull(),
  data: jsonb("data").notNull(),
});
