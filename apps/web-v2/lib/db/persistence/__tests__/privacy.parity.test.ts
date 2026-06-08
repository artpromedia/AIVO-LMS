/**
 * privacy / DSAR / terms — memory == postgres parity (Sprint 5).
 *
 * The compliance domain's privacy extension: DSAR export/deletion requests
 * (legal obligations with SLAs — must survive restart), FERPA disclosure
 * logs, IEP-document access logs (append-only audit integrity), retention
 * policies, and the consent-version / data-inventory reference catalogs.
 */
import { it, expect } from "vitest";
import {
  listConsentVersions,
  recordTermsAcceptance,
  listDataInventory,
  listRetentionPolicies,
  updateRetentionPolicy,
  recordDisclosure,
  listDisclosures,
  createDataExportRequest,
  getDataExportRequest,
  getDataExportRequestById,
  listDataExportRequestsForUser,
  listAllDataExportRequests,
  updateDataExportRequestStatus,
  createDataDeletionRequest,
  getDataDeletionRequest,
  listAllDataDeletionRequests,
  logIepAccess,
  listIepAccessForLearner,
} from "@/lib/db/repos";
import { runInBothModes } from "./parity.harness";

const T = "t_privacy_parity";
const U = "u_parent_privacy";
const L = "lrn_privacy_parity";

runInBothModes("privacy", (ctx) => {
  it("seeded reference catalogs match across backends", async () => {
    await ctx.parity(
      "consentVersions",
      () => listConsentVersions(),
      (vs) => vs.map((v) => `${v.consentType}:${v.version}`).sort(),
    );
    await ctx.parity(
      "dataInventory",
      () => listDataInventory(),
      (xs) => xs.map((x) => x.key).sort(),
    );
  });

  it("terms acceptance is recorded durably", async () => {
    const t = await recordTermsAcceptance({ tenantId: T, userId: U, termsVersion: "2026-01" });
    expect(t.userId).toBe(U);
    expect(t.termsVersion).toBe("2026-01");
  });

  it("retention policy update persists through the adapter", async () => {
    const policies = await listRetentionPolicies();
    expect(policies.length).toBeGreaterThan(0);
    const target = policies[0]!;
    const updated = await updateRetentionPolicy(target.id, { retentionDays: 365 }, "u_dpo");
    expect(updated?.retentionDays).toBe(365);
    expect(updated?.updatedByUserId).toBe("u_dpo");
    expect(await updateRetentionPolicy("rp-absent", { retentionDays: 1 }, "u")).toBeNull();
  });

  it("disclosures append and list tenant-scoped, newest-first", async () => {
    await recordDisclosure({
      tenantId: T,
      learnerId: L,
      recipientType: "agency",
      recipientName: "State Dept",
      reason: "audit",
      ferpaBasis: "studies",
      disclosedByUserId: "u_dpo",
    } as never);
    await recordDisclosure({
      tenantId: "t_other_priv",
      learnerId: L,
      recipientType: "agency",
      recipientName: "Other",
      reason: "x",
      ferpaBasis: "y",
      disclosedByUserId: "u_dpo",
    } as never);
    const mine = await listDisclosures(T);
    expect(mine.every((d) => d.tenantId === T)).toBe(true);
    expect(mine.some((d) => d.recipientName === "State Dept")).toBe(true);
    expect(mine.some((d) => d.recipientName === "Other")).toBe(false);
  });

  it("DSAR export request: create, tenant-scoped get, cross-tenant getById, status SLA stamp", async () => {
    const req = await createDataExportRequest({ tenantId: T, parentUserId: U, learnerId: L });
    expect(req.status).toBe("pending");
    // tenant-scoped get
    expect((await getDataExportRequest(req.id, T))?.id).toBe(req.id);
    expect(await getDataExportRequest(req.id, "t_wrong")).toBeNull();
    // platform-admin cross-tenant lookup
    expect((await getDataExportRequestById(req.id))?.id).toBe(req.id);
    // per-user list + admin list-all both see it
    expect((await listDataExportRequestsForUser(U, T)).some((r) => r.id === req.id)).toBe(true);
    expect((await listAllDataExportRequests()).some((r) => r.id === req.id)).toBe(true);
    // completing stamps completedAt + exportUrl
    const done = await updateDataExportRequestStatus(req.id, "completed", "https://x/export.zip");
    expect(done?.status).toBe("completed");
    expect(done?.completedAt).not.toBeNull();
    expect(done?.exportUrl).toBe("https://x/export.zip");
  });

  it("DSAR deletion request: create + scoped get + admin list-all", async () => {
    const req = await createDataDeletionRequest({
      tenantId: T,
      parentUserId: U,
      learnerId: L,
      scope: "learner",
    });
    expect(req.scope).toBe("learner");
    expect((await getDataDeletionRequest(req.id, T))?.id).toBe(req.id);
    expect(await getDataDeletionRequest(req.id, "t_wrong")).toBeNull();
    expect((await listAllDataDeletionRequests()).some((r) => r.id === req.id)).toBe(true);
  });

  it("IEP access log is append-only, learner/tenant scoped, newest-first", async () => {
    await logIepAccess({
      tenantId: T,
      learnerId: L,
      documentId: "doc-1",
      accessedByUserId: "u_teacher",
      purpose: "review" as never,
    });
    const logs = await listIepAccessForLearner(L, T);
    expect(logs.some((x) => x.documentId === "doc-1")).toBe(true);
    expect(await listIepAccessForLearner(L, "t_wrong")).toHaveLength(0);
  });
});
