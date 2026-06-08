/**
 * Drizzle-backed BillingStore — the web-owned billing/AI-cost tables
 * (web_billing_accounts, web_ai_budgets, web_ai_cost_events, web_coupons,
 * web_daily_billing_batches). Tenant-scoped fetches use the indexed columns;
 * the memory store's localeCompare / createdAt / occurredAt sort + `limit`
 * cap are applied in app code so the behaviour is byte-for-byte equivalent.
 *
 * Per ADR 0015 this never touches canonical billing-svc data (subscriptions,
 * invoices, seats) — those are read over REST (lib/billing/billing-svc-client).
 */
import { eq, inArray } from "drizzle-orm";
import {
  webBillingAccounts,
  webAiBudgets,
  webAiCostEvents,
  webCoupons,
  webDailyBillingBatches,
} from "@aivo/db";
import type {
  AIBudget,
  AICostEvent,
  BillingAccount,
  Coupon,
  DailyBillingBatch,
} from "@/lib/db/types";
import type { BillingStore } from "../types";
import { getDb } from "./client";

export const drizzleBilling: BillingStore = {
  async getAccountForTenant(tenantId): Promise<BillingAccount | null> {
    const rows = await getDb()
      .select()
      .from(webBillingAccounts)
      .where(eq(webBillingAccounts.tenantId, tenantId));
    // latest-by-createdAt (the memory store kept the max).
    let latest: BillingAccount | null = null;
    for (const r of rows) {
      const b = r.data as BillingAccount;
      if (!latest || b.createdAt > latest.createdAt) latest = b;
    }
    return latest;
  },

  async listAccountsForTenants(tenantIds): Promise<BillingAccount[]> {
    if (tenantIds.length === 0) return [];
    const rows = await getDb()
      .select()
      .from(webBillingAccounts)
      .where(inArray(webBillingAccounts.tenantId, tenantIds));
    return rows
      .map((r) => r.data as BillingAccount)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async upsertAccount(account): Promise<BillingAccount> {
    await getDb()
      .insert(webBillingAccounts)
      .values({ id: account.id, tenantId: account.tenantId, createdAt: account.createdAt, data: account })
      .onConflictDoUpdate({
        target: webBillingAccounts.id,
        set: { tenantId: account.tenantId, createdAt: account.createdAt, data: account },
      });
    return account;
  },

  async getAIBudget(tenantId): Promise<AIBudget | null> {
    const [row] = await getDb()
      .select()
      .from(webAiBudgets)
      .where(eq(webAiBudgets.tenantId, tenantId))
      .limit(1);
    return row ? (row.data as AIBudget) : null;
  },

  async upsertAIBudget(budget): Promise<AIBudget> {
    await getDb()
      .insert(webAiBudgets)
      .values({ tenantId: budget.tenantId, updatedAt: budget.updatedAt, data: budget })
      .onConflictDoUpdate({
        target: webAiBudgets.tenantId,
        set: { updatedAt: budget.updatedAt, data: budget },
      });
    return budget;
  },

  async recordAICostEvent(event): Promise<AICostEvent> {
    await getDb()
      .insert(webAiCostEvents)
      .values({ id: event.id, tenantId: event.tenantId, occurredAt: event.occurredAt, data: event })
      .onConflictDoNothing({ target: webAiCostEvents.id });
    return event;
  },

  async listAICostEvents({ tenantId, limit }): Promise<AICostEvent[]> {
    const rows = tenantId
      ? await getDb().select().from(webAiCostEvents).where(eq(webAiCostEvents.tenantId, tenantId))
      : await getDb().select().from(webAiCostEvents);
    return rows
      .map((r) => r.data as AICostEvent)
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
      .slice(0, limit ?? 200);
  },

  async listCoupons(): Promise<Coupon[]> {
    const rows = await getDb().select().from(webCoupons);
    return rows.map((r) => r.data as Coupon).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async upsertCoupon(coupon): Promise<Coupon> {
    await getDb()
      .insert(webCoupons)
      .values({ id: coupon.id, code: coupon.code, createdAt: coupon.createdAt, data: coupon })
      .onConflictDoUpdate({
        target: webCoupons.id,
        set: { code: coupon.code, createdAt: coupon.createdAt, data: coupon },
      });
    return coupon;
  },

  async listDailyBillingBatches(): Promise<DailyBillingBatch[]> {
    const rows = await getDb().select().from(webDailyBillingBatches);
    return rows
      .map((r) => r.data as DailyBillingBatch)
      .sort((a, b) => b.runDate.localeCompare(a.runDate));
  },

  async upsertDailyBillingBatch(batch): Promise<DailyBillingBatch> {
    await getDb()
      .insert(webDailyBillingBatches)
      .values({ id: batch.id, runDate: batch.runDate, data: batch })
      .onConflictDoUpdate({
        target: webDailyBillingBatches.id,
        set: { runDate: batch.runDate, data: batch },
      });
    return batch;
  },
};
