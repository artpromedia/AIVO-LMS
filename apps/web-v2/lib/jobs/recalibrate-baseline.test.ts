import { describe, it, expect, beforeEach } from "vitest";
import { resetStore, getStore } from "@/lib/db/store";
import type { BaselineItemResponseLog } from "@/lib/db/types";
import { runBaselineRecalibrationJob } from "./recalibrate-baseline";

let seq = 0;
function pushLog(tenantId: string, itemKey: string, correct: boolean, thetaBefore = 0): void {
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
    difficultyTheta: -1.0,
    correct,
    skipped: false,
    thetaBefore,
    thetaAfter: correct ? 0.2 : -0.2,
    modality: "reading",
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, seq)).toISOString(),
  };
  getStore().baselineItemResponseLogs.push(log);
}

describe("runBaselineRecalibrationJob", () => {
  beforeEach(() => {
    resetStore();
    seq = 0;
  });

  it("summarizes per-tenant item health from persisted telemetry", async () => {
    // tenantA: a 'foundational' item (seed -1.0) that learners at θ≈0 fail
    // 9/10 → calibratable + flagged + retire.
    for (let i = 0; i < 9; i++) pushLog("tenantA", "skA|foundational", false, 0);
    pushLog("tenantA", "skA|foundational", true, 0);
    // tenantB: too little data to calibrate.
    pushLog("tenantB", "skB|grade_level", true, 0);

    const result = await runBaselineRecalibrationJob({ tenantIds: ["tenantA", "tenantB"] });

    expect(result.tenantCount).toBe(2);
    const a = result.tenants.find((t) => t.tenantId === "tenantA")!;
    expect(a.itemsObserved).toBe(1);
    expect(a.calibratable).toBe(1);
    expect(a.flagged).toBeGreaterThanOrEqual(1);
    expect(a.recommendedForRetire).toBe(1);
    expect(a.calibrationKeys).toBe(1);

    const b = result.tenants.find((t) => t.tenantId === "tenantB")!;
    expect(b.calibratable).toBe(0); // below exposure floor
    expect(b.calibrationKeys).toBe(0);
  });

  it("is tenant-scoped — never mixes one tenant's telemetry into another", async () => {
    for (let i = 0; i < 6; i++) pushLog("tenantA", "skA|grade_level", i % 2 === 0, 0);
    const result = await runBaselineRecalibrationJob({ tenantIds: ["tenantB"] });
    expect(result.tenants[0]!.itemsObserved).toBe(0);
  });
});
