/**
 * compliance — memory == postgres parity (Sprint 1).
 * Consent active/revoked semantics, IEP upsert/get/delete, and the
 * platform-wide reference catalogs (policies + subprocessors).
 */
import { it, expect } from "vitest";
import type { ConsentRecord, IEPDocument } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const PARENT = "u_demo_parent";
const L = "lrn_demo_sky";

runInBothModes("compliance", (ctx) => {
  it("getActiveConsentForUser respects revokedAt", async () => {
    const c = getPersistence().compliance;
    const now = new Date().toISOString();
    const rec = (revokedAt: string | null): ConsentRecord =>
      ({
        id: "consent-parity-1",
        tenantId: T,
        parentUserId: PARENT,
        learnerId: null,
        consentType: "child_data_collection",
        version: "v1",
        acceptedAt: now,
        revokedAt,
        ipHash: null,
        userAgent: null,
      }) as unknown as ConsentRecord;
    await c.upsertConsent(rec(null));
    expect(
      (await c.getActiveConsentForUser(PARENT, "child_data_collection", T, null))?.id,
    ).toBe("consent-parity-1");
    await c.upsertConsent(rec(new Date().toISOString()));
    expect(await c.getActiveConsentForUser(PARENT, "child_data_collection", T, null)).toBeNull();
  });

  it("IEP upsert/get/delete round-trips", async () => {
    const c = getPersistence().compliance;
    const now = new Date().toISOString();
    const doc = {
      id: "iep-parity-1",
      learnerId: L,
      tenantId: T,
      fileName: "iep.pdf",
      mimeType: "application/pdf",
      bytes: 10,
      uploadedAt: now,
      status: "pending",
      extraction: null,
      acceptedAccommodations: null,
      confirmedAt: null,
    } as unknown as IEPDocument;
    await c.upsertIEP(doc);
    expect((await c.getIEPForLearner(L, T))?.id).toBe("iep-parity-1");
    expect(await c.deleteIEP(L, T)).toBe(true);
    expect(await c.getIEPForLearner(L, T)).toBeNull();
  });

  it("policy + subprocessor reference catalogs match across backends", async () => {
    await ctx.parity(
      "policyVersions",
      () => getPersistence().compliance.listPolicyVersions(),
      // ids are random surrogate keys; kind+version is the stable identity.
      (p) => p.map((x) => `${x.kind}:${x.version}`).sort(),
    );
    await ctx.parity(
      "subprocessors",
      () => getPersistence().compliance.listSubprocessors(),
      (s) => s.map((x) => x.name).sort(),
    );
  });
});
