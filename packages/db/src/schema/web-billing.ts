/**
 * Web-owned billing / AI-cost persistence tables (Sprint 2).
 *
 * ADR 0015 ("two stores of record"): the canonical subscription / invoice /
 * seat-pool state is owned by `services/billing-svc` (Stripe-backed) and read
 * by web-v2 over REST. These `web_*` tables hold only the web app's OWN
 * operational/aggregate rows that previously lived in the in-memory Map — the
 * P0 durability gap, since they are real money/quota data lost on restart:
 *
 *   - web_billing_accounts  — per-tenant plan/status snapshot the web surfaces.
 *   - web_ai_budgets        — per-tenant monthly AI spend cap + thresholds.
 *   - web_ai_cost_events    — append-only per-request AI cost ledger.
 *   - web_coupons           — platform-wide promo catalog (admin coupon wizard).
 *   - web_daily_billing_batches — platform-wide nightly batch run log.
 *
 * Conventions match web-domain.ts: TEXT ids, ISO-8601 TEXT timestamps, the
 * full domain object in a `data` JSONB column, predicate columns only for the
 * WHERE/ORDER the stores use.
 *
 * RLS: these are deliberately NOT RLS-protected (see migration 0081). Billing
 * accounts / AI budgets / cost events carry a tenant_id but are read by
 * PLATFORM-ADMIN flows that scan across tenants, so — like web_users /
 * web_audit_logs in 0050 — a per-connection tenant policy would hide exactly
 * the rows those admin consoles need. Tenant scoping is enforced in app code.
 */
import { pgTable, text, jsonb, index } from "drizzle-orm/pg-core";

// ── billing accounts (tenant-scoped) ────────────────────────────────
export const webBillingAccounts = pgTable(
  "web_billing_accounts",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    createdAt: text("created_at").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_billing_accounts_tenant_idx").on(t.tenantId, t.createdAt) }),
);

// ── AI budgets (tenant-scoped, one row per tenant) ──────────────────
export const webAiBudgets = pgTable("web_ai_budgets", {
  tenantId: text("tenant_id").primaryKey(),
  updatedAt: text("updated_at").notNull(),
  data: jsonb("data").notNull(),
});

// ── AI cost events (tenant-scoped, append-only ledger) ──────────────
export const webAiCostEvents = pgTable(
  "web_ai_cost_events",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id").notNull(),
    occurredAt: text("occurred_at").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_ai_cost_events_tenant_idx").on(t.tenantId, t.occurredAt) }),
);

// ── coupons (platform-wide reference/operational) ───────────────────
export const webCoupons = pgTable(
  "web_coupons",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    createdAt: text("created_at").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_coupons_code_idx").on(t.code) }),
);

// ── daily billing batches (platform-wide run log) ───────────────────
export const webDailyBillingBatches = pgTable(
  "web_daily_billing_batches",
  {
    id: text("id").primaryKey(),
    runDate: text("run_date").notNull(),
    data: jsonb("data").notNull(),
  },
  (t) => ({ idx: index("web_daily_billing_batches_date_idx").on(t.runDate) }),
);
