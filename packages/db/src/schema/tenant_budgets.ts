/**
 * Sprint 14 (B) — tenant LLM budget caps.
 *
 * One row per (tenant_id, period, period_start). ai-svc owns reads and
 * writes; see services/ai-svc/src/ai_svc/budgets/tenant_caps.py.
 *
 * Migration: packages/db/migrations/0047_tenant_llm_budgets.sql.
 */
import {
  bigint,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const tenantLlmBudgets = pgTable(
  "tenant_llm_budgets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    period: text("period").notNull(), // 'daily' | 'monthly' — enforced by CHECK in SQL.
    capCents: bigint("cap_cents", { mode: "bigint" }).notNull(),
    currentCents: bigint("current_cents", { mode: "bigint" })
      .notNull()
      .default(0n),
    periodStart: timestamp("period_start", { withTimezone: true }).notNull(),
    periodEnd: timestamp("period_end", { withTimezone: true }).notNull(),
    autoDowngradedAt: timestamp("auto_downgraded_at", {
      withTimezone: true,
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    tenantPeriodStartUq: uniqueIndex(
      "tenant_llm_budgets_tenant_period_start_uq",
    ).on(t.tenantId, t.period, t.periodStart),
    tenantPeriodActiveIdx: index(
      "tenant_llm_budgets_tenant_period_active_idx",
    ).on(t.tenantId, t.period, t.periodEnd),
  }),
);

export type TenantLlmBudget = typeof tenantLlmBudgets.$inferSelect;
export type NewTenantLlmBudget = typeof tenantLlmBudgets.$inferInsert;

export type LlmBudgetPeriod = "daily" | "monthly";

export const LLM_COST_BANDS = ["economy", "standard", "premium"] as const;
export type LlmCostBand = (typeof LLM_COST_BANDS)[number];
