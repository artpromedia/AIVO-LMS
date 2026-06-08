/**
 * Web-owned safety / moderation persistence tables (Sprint 7).
 *
 * Moderation events, human-review cases, the safety-policy-version catalog,
 * blocked generations, and the tutor-response / homework-input safety audits.
 * Moderation events + audits are append-only compliance trails.
 *
 * RLS: NOT applied. These carry tenant_id (except the platform-global safety
 * policy catalog) but are read by the safety/trust admin console ACROSS tenants
 * (listModerationEvents / listHumanReviewCases / listBlockedGenerations accept
 * an OPTIONAL tenant filter) — the same admin-cross-tenant rationale as the
 * other web_* tables; tenant scoping is enforced in app code. Canonical
 * responsible-AI evals/models are read from responsible-ai-svc over REST.
 *
 * Conventions match web-domain.ts: TEXT ids, full object in `data` JSONB.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

export const webSafetyPolicyVersions = pgTable("web_safety_policy_versions", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webModerationEvents = pgTable(
  "web_moderation_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_moderation_events_tenant_idx").on(t.tenantId) }),
);

export const webHumanReviewCases = pgTable(
  "web_human_review_cases",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_human_review_cases_tenant_idx").on(t.tenantId) }),
);

export const webBlockedGenerations = pgTable(
  "web_blocked_generations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_blocked_generations_tenant_idx").on(t.tenantId) }),
);

export const webTutorResponseAudits = pgTable(
  "web_tutor_response_audits",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_tutor_response_audits_tenant_idx").on(t.tenantId) }),
);

export const webHomeworkInputAudits = pgTable(
  "web_homework_input_audits",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_homework_input_audits_tenant_idx").on(t.tenantId) }),
);
