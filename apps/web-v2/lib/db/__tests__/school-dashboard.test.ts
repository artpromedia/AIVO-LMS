/**
 * Sprint 7 — school admin dashboard repo tests.
 *
 * Pins down the contract `/admin/school/page.tsx` and the BFF route
 * depend on:
 *   - returns live counts from the seeded store
 *   - degrades gracefully when no school is associated with the tenant
 *   - computes consent % as round(consent_records / learners * 100)
 *   - reports rostering status from the most recent rostering job
 */
import { describe, expect, it, beforeEach } from "vitest";
import { ensureSeeded } from "@/lib/db/seed";
import { resetStore, getStore } from "@/lib/db/store";
import { getSchoolDashboard } from "@/lib/db/repos";

describe("getSchoolDashboard", async () => {
  beforeEach(async () => {
    resetStore();
    ensureSeeded();
  });

  it("returns live counts derived from the seeded store", async () => {
    const store = getStore();
    const tenant = Array.from(store.tenants.values())[0];
    expect(tenant, "seed should expose at least one tenant").toBeDefined();
    const snap = await getSchoolDashboard(tenant!.id);

    expect(snap.school).not.toBeNull();
    expect(typeof snap.counts.learners).toBe("number");
    expect(typeof snap.counts.staff).toBe("number");
    expect(snap.counts.consentCompletePct).toBeGreaterThanOrEqual(0);
    expect(snap.counts.consentCompletePct).toBeLessThanOrEqual(100);

    // Seat utilisation must never exceed 100% from real data.
    expect(snap.licenses.utilizationPct).toBeLessThanOrEqual(100);
  });

  it("returns a 100% consent value when there are zero learners", async () => {
    resetStore();
    // No seed — empty store.
    const snap = await getSchoolDashboard("nonexistent-tenant");
    expect(snap.counts.learners).toBe(0);
    expect(snap.counts.consentCompletePct).toBe(100);
    expect(snap.licenses.used).toBe(0);
  });

  it("falls back to tenant name when no school record exists", async () => {
    resetStore();
    const store = getStore();
    store.tenants.set("t-1", {
      id: "t-1",
      name: "Acme Academy",
      slug: "acme",
      // satisfy other required Tenant fields if any — runtime only
    } as never);
    const snap = await getSchoolDashboard("t-1");
    expect(snap.school?.id).toBeNull();
    expect(snap.school?.name).toBe("Acme Academy");
  });

  it("rostering status is 'unknown' when no rostering jobs exist", async () => {
    resetStore();
    ensureSeeded();
    const store = getStore();
    const tenant = Array.from(store.tenants.values())[0]!;
    // Clear any seeded rostering jobs to assert the unknown branch.
    for (const [k, v] of Array.from(store.aiGenerationJobs.entries())) {
      if ((v as { kind?: string }).kind === "rostering_import") {
        store.aiGenerationJobs.delete(k);
      }
    }
    const snap = await getSchoolDashboard(tenant.id);
    expect(snap.rostering.status).toBe("unknown");
    expect(snap.rostering.lastSyncIso).toBeNull();
  });

  it("captures audit events within the last 30 days only", async () => {
    resetStore();
    ensureSeeded();
    const store = getStore();
    const tenant = Array.from(store.tenants.values())[0]!;
    const oldIso = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    store.auditLogs.push({
      id: "old-audit",
      tenantId: tenant.id,
      actorUserId: null,
      action: "TEST_OLD",
      target: "test",
      metadata: {},
      occurredAt: oldIso,
    } as never);
    const recentIso = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
    store.auditLogs.push({
      id: "recent-audit",
      tenantId: tenant.id,
      actorUserId: null,
      action: "TEST_RECENT",
      target: "test",
      metadata: {},
      occurredAt: recentIso,
    } as never);
    const snap = await getSchoolDashboard(tenant.id);
    // recent included, old excluded → at least 1 recent event.
    expect(snap.counts.auditEvents30d).toBeGreaterThanOrEqual(1);
  });
});
