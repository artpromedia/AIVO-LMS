/**
 * Shared BrainProfileApprovalStore contract (Sprint C-06).
 *
 * Run against any implementation (memory + postgres) so the drizzle adapter
 * is proven equivalent to the in-memory store: the dedicated approval record
 * round-trips with every field (consent/RAI versions, actor, revision, folded
 * modifications, ipHash), is tenant-scoped, append-only, and ordered
 * newest-first. Import and call from a `*.test.ts`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { BrainProfileApproval } from "@/lib/db/types";
import type { BrainProfileApprovalStore } from "../../types";

function approval(over: Partial<BrainProfileApproval> = {}): BrainProfileApproval {
  return {
    id: "bpa_1",
    tenantId: "t_1",
    learnerId: "lrn_1",
    brainProfileId: "bp_1",
    profileRevision: 1,
    actorUserId: "u_parent_1",
    action: "approved",
    consentVersion: "1.0",
    raiVersion: "1",
    modifications: [],
    ipHash: "abc123",
    createdAt: "2026-06-13T12:00:00.000Z",
    ...over,
  };
}

export function brainProfileApprovalStoreContract(
  label: string,
  makeStore: () => BrainProfileApprovalStore,
  reset: () => void | Promise<void>,
): void {
  describe(`BrainProfileApprovalStore contract — ${label}`, () => {
    let store: BrainProfileApprovalStore;

    beforeEach(async () => {
      await reset();
      store = makeStore();
    });

    it("returns an empty history for an unknown learner", async () => {
      expect(await store.listForLearner("nope", "t_1")).toEqual([]);
    });

    it("records and reads back an approval with every field intact", async () => {
      const rec = approval({
        action: "amended",
        consentVersion: "2.1",
        raiVersion: "3",
        ipHash: "deadbeef",
        modifications: [
          {
            field: "accommodation.read_aloud",
            originalValue: false,
            parentValue: true,
            parentNote: "Reads along better aloud.",
            modifiedAt: "2026-06-13T11:59:00.000Z",
          },
        ],
      });
      await store.record(rec);
      const [got] = await store.listForLearner("lrn_1", "t_1");
      expect(got).toEqual(rec);
    });

    it("scopes reads by tenant", async () => {
      await store.record(approval());
      expect(await store.listForLearner("lrn_1", "other_tenant")).toEqual([]);
    });

    it("is append-only and ordered newest-first", async () => {
      await store.record(
        approval({ id: "bpa_1", action: "amended", createdAt: "2026-06-13T10:00:00.000Z" }),
      );
      await store.record(
        approval({ id: "bpa_2", action: "approved", createdAt: "2026-06-13T12:00:00.000Z" }),
      );
      const history = await store.listForLearner("lrn_1", "t_1");
      expect(history.map((a) => a.id)).toEqual(["bpa_2", "bpa_1"]);
    });

    it("records a decline action", async () => {
      await store.record(approval({ action: "declined" }));
      const [got] = await store.listForLearner("lrn_1", "t_1");
      expect(got.action).toBe("declined");
    });
  });
}
