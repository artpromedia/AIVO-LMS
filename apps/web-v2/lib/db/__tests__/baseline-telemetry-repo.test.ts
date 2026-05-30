/**
 * Tenant-scoping + aggregation wiring for the baseline telemetry reads.
 * The recalibration data must never leak across tenants.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetStore, getStore } from "@/lib/db/store";
import {
  listBaselineTelemetry,
  getBaselineRecalibration,
  getBaselineRecalibrationForTenants,
} from "@/lib/db/repos";
import type { BaselineItemResponseLog } from "@/lib/db/types";

let seq = 0;
function pushLog(tenantId: string, itemKey: string, correct: boolean): void {
  seq += 1;
  const [skillId, difficulty] = itemKey.split("|");
  const log: BaselineItemResponseLog = {
    id: `brl${seq}`,
    tenantId,
    learnerId: `lrn${seq}`,
    baselineId: `bas${seq}`,
    questionId: `q${seq}`,
    itemKey,
    skillId: skillId!,
    subjectId: "sub1",
    difficulty: difficulty as BaselineItemResponseLog["difficulty"],
    difficultyTheta: 0.4,
    correct,
    skipped: false,
    thetaBefore: 0,
    thetaAfter: correct ? 0.2 : -0.2,
    modality: "reading",
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
  };
  getStore().baselineItemResponseLogs.push(log);
}

describe("baseline telemetry repo reads", () => {
  beforeEach(() => {
    resetStore();
    seq = 0;
    for (let i = 0; i < 6; i++) pushLog("tenantA", "skA|grade_level", i % 2 === 0);
    for (let i = 0; i < 6; i++) pushLog("tenantB", "skB|stretch", false);
  });

  it("listBaselineTelemetry returns only the requested tenant's logs", () => {
    const a = listBaselineTelemetry({ tenantId: "tenantA" });
    expect(a).toHaveLength(6);
    expect(a.every((l) => l.tenantId === "tenantA")).toBe(true);
  });

  it("getBaselineRecalibration is tenant-scoped (no cross-tenant leak)", () => {
    const a = getBaselineRecalibration({ tenantId: "tenantA" });
    expect(a.map((r) => r.itemKey)).toEqual(["skA|grade_level"]);
    expect(a.map((r) => r.itemKey)).not.toContain("skB|stretch");
  });

  it("getBaselineRecalibrationForTenants aggregates the requested set", () => {
    const both = getBaselineRecalibrationForTenants({ tenantIds: ["tenantA", "tenantB"] });
    expect(both.map((r) => r.itemKey).sort()).toEqual(["skA|grade_level", "skB|stretch"]);

    const onlyB = getBaselineRecalibrationForTenants({ tenantIds: ["tenantB"] });
    expect(onlyB.map((r) => r.itemKey)).toEqual(["skB|stretch"]);
  });
});
