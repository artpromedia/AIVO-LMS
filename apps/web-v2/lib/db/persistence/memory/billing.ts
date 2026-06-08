/**
 * In-memory BillingStore — wraps the billingAccounts / aiBudgets /
 * aiCostEvents / coupons / dailyBillingBatches Maps. Test-only reference
 * semantics the drizzle adapter must match exactly. Sort order mirrors the
 * legacy repo functions:
 *   - billing accounts: latest-by-createdAt (single), createdAt-asc (list).
 *   - AI cost events: newest-first by occurredAt, capped at `limit` (200).
 *   - coupons: newest-first by createdAt.
 *   - daily batches: newest run-date first.
 */
import { getStore } from "@/lib/db/store";
import type {
  AIBudget,
  AICostEvent,
  BillingAccount,
  Coupon,
  DailyBillingBatch,
} from "@/lib/db/types";
import type { BillingStore } from "../types";

export const memoryBilling: BillingStore = {
  async getAccountForTenant(tenantId): Promise<BillingAccount | null> {
    let latest: BillingAccount | null = null;
    for (const b of getStore().billingAccounts.values()) {
      if (b.tenantId !== tenantId) continue;
      if (!latest || b.createdAt > latest.createdAt) latest = b;
    }
    return latest;
  },

  async listAccountsForTenants(tenantIds): Promise<BillingAccount[]> {
    const ids = new Set(tenantIds);
    return Array.from(getStore().billingAccounts.values())
      .filter((b) => ids.has(b.tenantId))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async upsertAccount(account): Promise<BillingAccount> {
    getStore().billingAccounts.set(account.id, account);
    return account;
  },

  async getAIBudget(tenantId): Promise<AIBudget | null> {
    return getStore().aiBudgets.get(tenantId) ?? null;
  },

  async upsertAIBudget(budget): Promise<AIBudget> {
    getStore().aiBudgets.set(budget.tenantId, budget);
    return budget;
  },

  async recordAICostEvent(event): Promise<AICostEvent> {
    getStore().aiCostEvents.set(event.id, event);
    return event;
  },

  async listAICostEvents({ tenantId, limit }): Promise<AICostEvent[]> {
    let arr = Array.from(getStore().aiCostEvents.values());
    if (tenantId) arr = arr.filter((e) => e.tenantId === tenantId);
    arr.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
    return arr.slice(0, limit ?? 200);
  },

  async listCoupons(): Promise<Coupon[]> {
    return Array.from(getStore().coupons.values()).sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );
  },

  async upsertCoupon(coupon): Promise<Coupon> {
    getStore().coupons.set(coupon.id, coupon);
    return coupon;
  },

  async listDailyBillingBatches(): Promise<DailyBillingBatch[]> {
    return Array.from(getStore().dailyBillingBatches.values()).sort((a, b) =>
      b.runDate.localeCompare(a.runDate),
    );
  },

  async upsertDailyBillingBatch(batch): Promise<DailyBillingBatch> {
    getStore().dailyBillingBatches.set(batch.id, batch);
    return batch;
  },
};
