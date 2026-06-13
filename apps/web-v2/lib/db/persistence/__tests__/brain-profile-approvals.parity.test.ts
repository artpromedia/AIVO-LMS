/**
 * brainProfileApprovals — memory == postgres parity (Sprint C-06).
 *
 * The dedicated approval record (consent/RAI versions, actor, reviewed
 * revision, folded modifications, ipHash) must persist byte-for-byte through
 * either backend: record + listForLearner round-trips, is tenant-scoped,
 * append-only, and ordered newest-first.
 */
import { it, expect } from "vitest";
import type { BrainProfileApproval } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky";

function approval(over: Partial<BrainProfileApproval> = {}): BrainProfileApproval {
  return {
    id: "bpa-parity-1",
    tenantId: T,
    learnerId: L,
    brainProfileId: "brp-parity-1",
    profileRevision: 1,
    actorUserId: "u_demo_parent",
    action: "approved",
    consentVersion: "1.0",
    raiVersion: "1",
    modifications: [],
    ipHash: "hash_demo",
    createdAt: "2026-06-13T12:00:00.000Z",
    ...over,
  };
}

runInBothModes("brainProfileApprovals", () => {
  it("record + listForLearner round-trips and is tenant-scoped", async () => {
    const s = getPersistence().brainProfileApprovals;
    await s.record(approval());
    const [got] = await s.listForLearner(L, T);
    expect(got).toEqual(approval());
    expect(await s.listForLearner(L, "t_other")).toEqual([]);
  });

  it("preserves folded modifications and is append-only newest-first", async () => {
    const s = getPersistence().brainProfileApprovals;
    await s.record(
      approval({ id: "bpa-1", action: "approved", createdAt: "2026-06-13T10:00:00.000Z" }),
    );
    await s.record(
      approval({
        id: "bpa-2",
        action: "amended",
        profileRevision: 2,
        createdAt: "2026-06-13T12:00:00.000Z",
        modifications: [
          {
            field: "mathComfort",
            originalValue: "growing",
            parentValue: "confident",
            parentNote: null,
            modifiedAt: "2026-06-13T11:59:00.000Z",
          },
        ],
      }),
    );
    const history = await s.listForLearner(L, T);
    expect(history.map((a) => a.id)).toEqual(["bpa-2", "bpa-1"]);
    expect(history[0].modifications).toHaveLength(1);
    expect(history[0].modifications[0].field).toBe("mathComfort");
  });
});
