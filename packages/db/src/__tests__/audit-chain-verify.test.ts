import { describe, it, expect } from "vitest";
import { computeAuditHash } from "@aivo/security";
import {
  verifyChainRows,
  AUDIT_CHAIN_PROFILES,
  type ChainRow,
} from "../audit-chain-verify.js";

const PROFILE = AUDIT_CHAIN_PROFILES.district_activity_log;
const KEYS = PROFILE[0];

/** Build a chained fixture exactly the way appendAudit writes it. */
function buildChain(count: number, startSeq = 1): ChainRow[] {
  const rows: ChainRow[] = [];
  let prev = "";
  for (let i = 0; i < count; i++) {
    const payload: Record<string, unknown> = {
      tenantId: "tenant-1",
      action: `district.event.${i}`,
      actorId: `actor-${i % 2}`,
      actorName: i % 2 ? "Alex Admin" : null,
      onBehalfOfId: null,
      resourceType: "learner",
      resourceId: `learner-${i}`,
      details: i % 3 ? { page: i } : null,
    };
    const hash = computeAuditHash(prev, payload);
    rows.push({ seq: startSeq + i, prevHash: prev, hash, ...payload });
    prev = hash;
  }
  return rows;
}

describe("verifyChainRows", () => {
  it("reports an untampered chain intact (anchored at genesis)", () => {
    const rows = buildChain(5);
    const result = verifyChainRows(rows, PROFILE, undefined);
    expect(result).toMatchObject({
      intact: true,
      checkedRows: 5,
      firstSeq: 1,
      lastSeq: 5,
      brokenAtSeq: null,
      anchored: true,
    });
  });

  it("detects a tampered payload field", () => {
    const rows = buildChain(5);
    rows[2].resourceId = "swapped-learner"; // tamper after hashing
    const result = verifyChainRows(rows, PROFILE, undefined);
    expect(result.intact).toBe(false);
    expect(result.brokenAtSeq).toBe(3);
    expect(result.checkedRows).toBe(2);
  });

  it("detects a deleted row (prevHash linkage break)", () => {
    const rows = buildChain(5);
    rows.splice(2, 1); // remove the middle row
    const result = verifyChainRows(rows, PROFILE, undefined);
    expect(result.intact).toBe(false);
    expect(result.brokenAtSeq).toBe(4);
  });

  it("detects a forged hash even when prevHash linkage is reconstructed", () => {
    const rows = buildChain(3);
    // Attacker rewrites row 2's payload AND recomputes its hash, then fixes
    // row 3's prevHash — but cannot make row 2's hash match the canonical
    // payload AND keep row 3's stored hash valid simultaneously.
    rows[1].action = "district.event.evil";
    const forged = computeAuditHash(String(rows[1].prevHash), {
      ...Object.fromEntries(KEYS.map((k) => [k, rows[1][k]])),
    });
    rows[1].hash = forged;
    rows[2].prevHash = forged;
    const result = verifyChainRows(rows, PROFILE, undefined);
    expect(result.intact).toBe(false);
    expect(result.brokenAtSeq).toBe(3); // row 3's hash no longer matches
  });

  it("verifies a mid-table slice against its anchor hash", () => {
    const rows = buildChain(6);
    const slice = rows.slice(3); // seq 4..6
    const anchor = String(rows[2].hash);
    expect(verifyChainRows(slice, PROFILE, anchor).intact).toBe(true);
    expect(verifyChainRows(slice, PROFILE, anchor).anchored).toBe(true);
    // Wrong anchor = the slice was cut loose from the real chain.
    const bad = verifyChainRows(slice, PROFILE, "0".repeat(64));
    expect(bad.intact).toBe(false);
    expect(bad.brokenAtSeq).toBe(4);
  });

  it("skips pre-chain legacy rows (NULL hash) and reports them", () => {
    const legacy: ChainRow = {
      seq: 1,
      prevHash: null,
      hash: null,
      tenantId: "tenant-1",
      action: "district.legacy",
      actorId: "actor-0",
      actorName: null,
      onBehalfOfId: null,
      resourceType: "learner",
      resourceId: null,
      details: null,
    };
    const chained = buildChain(3, 2);
    const result = verifyChainRows([legacy, ...chained], PROFILE, undefined);
    expect(result.intact).toBe(true);
    expect(result.skippedLegacyRows).toBe(1);
    expect(result.checkedRows).toBe(3);
    expect(result.anchored).toBe(false); // seed after a legacy row is trusted
  });

  it("accepts rows written under a recorded legacy writer profile", () => {
    const adminProfiles = AUDIT_CHAIN_PROFILES.admin_audit_log;
    const legacyKeys = adminProfiles[2]; // Sprint B3 export profile
    const payload: Record<string, unknown> = {
      action: "admin.data.exported",
      actorId: "admin-1",
      actorEmail: "a@x.test",
      actorRole: "PLATFORM_ADMIN",
      resourceType: "audit_log",
      resourceId: null,
      tenantId: null,
      details: { filters: {} },
    };
    const hash = computeAuditHash("", payload);
    const row: ChainRow = {
      seq: 1,
      prevHash: "",
      hash,
      ...payload,
      // Columns the legacy writer never passed read back as NULL.
      onBehalfOfId: null,
      ipAddress: null,
      userAgent: null,
    };
    const result = verifyChainRows([row], adminProfiles, undefined);
    expect(result.intact).toBe(true);
    void legacyKeys;
  });

  it("an empty range is intact", () => {
    const result = verifyChainRows([], PROFILE, undefined);
    expect(result).toMatchObject({ intact: true, checkedRows: 0, firstSeq: null });
  });
});
