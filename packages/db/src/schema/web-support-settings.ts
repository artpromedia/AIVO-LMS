/**
 * Web-owned support + settings persistence tables (Sprint 8).
 *
 * Support tickets + the AI-generation job log, plus tenant settings and the
 * platform settings catalogs (API keys, email templates, webhook endpoints).
 *
 * RLS: NOT applied. Support tickets + AI jobs are read by admin consoles
 * ACROSS tenants (listSupportTickets/listAiGenerationJobs take a tenantId
 * SET), tenant settings are keyed by tenant and read by that tenant's admin,
 * and the platform settings are global. App-layer scoping, like the other
 * admin-accessed web_* tables.
 *
 * Conventions match web-domain.ts: TEXT ids, full object in `data` JSONB.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

export const webSupportTickets = pgTable(
  "web_support_tickets",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_support_tickets_tenant_idx").on(t.tenantId) }),
);

export const webAiGenerationJobs = pgTable(
  "web_ai_generation_jobs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_ai_generation_jobs_tenant_idx").on(t.tenantId) }),
);

export const webTenantSettings = pgTable("web_tenant_settings", {
  tenantId: text("tenant_id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webPlatformApiKeys = pgTable("web_platform_api_keys", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webPlatformEmailTemplates = pgTable("web_platform_email_templates", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webPlatformWebhookEndpoints = pgTable("web_platform_webhook_endpoints", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});
