/**
 * Web-owned privacy / DSAR / terms persistence tables (Sprint 5).
 *
 * Extends the compliance domain (consent records / IEP docs / age gate already
 * live in web-domain.ts) with the DSAR + governance surface: consent-version
 * catalog, terms acceptances, the data inventory + retention policies, FERPA
 * disclosure logs, DSAR export/deletion requests, and IEP-document access
 * logs. DSAR export/deletion are legal obligations with SLAs — durability is
 * non-negotiable.
 *
 * RLS: NOT applied. These carry tenant_id but are read by PLATFORM/ADMIN flows
 * — the DPO/compliance console reviews the DSAR queue + disclosures ACROSS
 * tenants (listAll*, the explicit "cross-tenant lookup, platform_admin only"
 * getById helpers), and the disclosure + IEP-access logs are append-only audit
 * trails. A per-connection tenant policy would hide exactly the rows those
 * consoles need — the same exclusion 0050 makes for web_users / web_audit_logs.
 * Tenant scoping is enforced in app code via the indexed tenant_id columns.
 *
 * Conventions match web-domain.ts: TEXT ids, full object in `data` JSONB,
 * predicate columns only for the WHERE filters the store uses.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

export const webConsentVersions = pgTable("web_consent_versions", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webTermsAcceptances = pgTable("web_terms_acceptances", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webDataInventory = pgTable("web_data_inventory", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webDataRetentionPolicies = pgTable("web_data_retention_policies", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webDisclosureLogs = pgTable(
  "web_disclosure_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_disclosure_logs_tenant_idx").on(t.tenantId) }),
);

export const webDataExportRequests = pgTable("web_data_export_requests", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webDataDeletionRequests = pgTable("web_data_deletion_requests", {
  id: text("id").primaryKey(),
  data: jsonb("data").notNull(),
});

export const webIepDocAccessLogs = pgTable(
  "web_iep_doc_access_logs",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_iep_doc_access_logs_idx").on(t.tenantId, t.learnerId) }),
);

/**
 * Sprint C-12 (ADR 0042) — FERPA cross-role reads of a child's brain profile,
 * web-v2 side. The web counterpart of the services' `CHILD_PROFILE_DISCLOSED`
 * audit event. Append-only, queried per-learner + time-bounded by the
 * compliance surface. `disclosed_at` is a predicate column so the time-window
 * query is indexed; the full tuple lives in `data`.
 */
export const webChildProfileDisclosures = pgTable(
  "web_child_profile_disclosures",
  {
    id: text("id").primaryKey(),
    learnerId: text("learner_id").notNull(),
    tenantId: text("tenant_id").notNull(),
    disclosedAt: text("disclosed_at").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({
    idx: index("web_child_profile_disclosures_idx").on(t.tenantId, t.learnerId, t.disclosedAt),
  }),
);
