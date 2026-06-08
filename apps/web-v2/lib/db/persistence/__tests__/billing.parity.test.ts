/**
 * billing — memory == postgres parity (Sprint 2).
 *
 * Covers the WEB-OWNED billing/AI-cost rows now durable in web_* tables:
 * billing-account snapshots (latest-by-createdAt), AI budgets (one per
 * tenant), the append-only AI cost ledger (newest-first, limit-capped),
 * coupons (newest-first), and daily batches (newest run-date first). The
 * canonical subscription/invoice/seat data is billing-svc's and out of scope
 * here (ADR 0015).
 */
import { it, expect } from "vitest";
import type { AICostEvent, BillingAccount, Coupon, DailyBillingBatch } from "@/lib/db/types";
import {
  getAIBudget,
  updateAIBudget,
  monthToDateSpendCents,
  recordAICostEvent,
  listAICostEvents,
  getBillingForTenant,
  listBillingForTenants,
  listCoupons,
  listDailyBillingBatches,
} from "@/lib/db/repos";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_billing_parity";

runInBothModes("billing", (ctx) => {
  it("billing account: latest-by-createdAt + cross-tenant list ordering", async () => {
    const billing = getPersistence().billing;
    const acct = (id: string, createdAt: string): BillingAccount =>
      ({ id, tenantId: T, plan: "family", status: "active", createdAt }) as BillingAccount;
    await billing.upsertAccount(acct("ba1", "2026-01-01T00:00:00.000Z"));
    await billing.upsertAccount(acct("ba2", "2026-03-01T00:00:00.000Z"));
    // latest-by-createdAt wins.
    expect((await getBillingForTenant(T))?.id).toBe("ba2");
    // cross-tenant list is createdAt-ascending and tenant-filtered.
    const list = await listBillingForTenants([T]);
    expect(list.map((b) => b.id)).toEqual(["ba1", "ba2"]);
    expect(await getBillingForTenant("t_absent")).toBeNull();
  });

  it("AI budget: default materialization + patch persists", async () => {
    // No row yet → repo materializes the paid-tenant default.
    const def = await getAIBudget(T);
    expect(def.monthlyCapCents).toBe(5000);
    expect(def.hardStop).toBe(false);
    // Platform tenant is unbounded.
    expect((await getAIBudget("t_platform")).monthlyCapCents).toBeNull();
    // Patch persists through the adapter.
    const updated = await updateAIBudget(T, { monthlyCapCents: 9000, hardStop: true });
    expect(updated.monthlyCapCents).toBe(9000);
    expect((await getAIBudget(T)).hardStop).toBe(true);
  });

  it("AI cost ledger: month-to-date sum + newest-first list", async () => {
    const cost = (id: string, occurredAt: string, amountCents: number): AICostEvent =>
      ({
        id,
        tenantId: T,
        feature: "lesson_plan",
        provider: "anthropic",
        model: "claude",
        amountCents,
        promptTokens: 10,
        completionTokens: 20,
        learnerId: null,
        occurredAt,
      }) as AICostEvent;
    const at = new Date("2026-06-15T00:00:00.000Z");
    await recordAICostEvent(cost("ac1", "2026-06-02T00:00:00.000Z", 100));
    await recordAICostEvent(cost("ac2", "2026-06-20T00:00:00.000Z", 250));
    // Different month — excluded from June month-to-date.
    await recordAICostEvent(cost("ac3", "2026-05-31T00:00:00.000Z", 999));
    expect(await monthToDateSpendCents(T, at)).toBe(350);
    const recent = await listAICostEvents({ tenantId: T });
    expect(recent.map((e) => e.id)).toEqual(["ac2", "ac1", "ac3"]);
    expect((await listAICostEvents({ tenantId: T, limit: 1 })).map((e) => e.id)).toEqual(["ac2"]);
  });

  it("coupons + daily batches: seeded reference parity (stable fields)", async () => {
    // Newest-first; compare the stable code/runDate set across backends.
    await ctx.parity(
      "couponCodes",
      () => listCoupons(),
      (cs: Coupon[]) => cs.map((c) => c.code).sort(),
    );
    await ctx.parity(
      "batchRunDates",
      () => listDailyBillingBatches(),
      (bs: DailyBillingBatch[]) => bs.map((b) => b.runDate).sort(),
    );
  });
});
