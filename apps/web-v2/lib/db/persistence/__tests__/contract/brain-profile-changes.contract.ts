/**
 * Shared BrainProfileChangeStore contract (Sprint C-13).
 *
 * Run against any implementation (memory + postgres) so the drizzle adapter is
 * proven equivalent to the in-memory store: a change record round-trips with
 * every field, is tenant-scoped, ordered newest-first; `ack` flips ONLY a
 * pending structural delta (idempotent), never a mastery row; and
 * `listPendingStructural` returns exactly the un-acked structural changes.
 * Import and call from a `*.test.ts`.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { LearnerBrainProfileChange } from "@/lib/db/types";
import type { BrainProfileChangeStore } from "../../types";

function change(over: Partial<LearnerBrainProfileChange> = {}): LearnerBrainProfileChange {
  return {
    id: "bpc_1",
    tenantId: "t_1",
    learnerId: "lrn_1",
    brainProfileId: "bp_1",
    revision: 2,
    kind: "structural",
    fields: ["accommodation.read_aloud"],
    summary: "Read-aloud turned on.",
    source: "baseline_reclone",
    requiresAck: true,
    ackedAt: null,
    reminderSentAt: null,
    createdAt: "2026-06-13T12:00:00.000Z",
    ...over,
  };
}

export function brainProfileChangeStoreContract(
  label: string,
  makeStore: () => BrainProfileChangeStore,
  reset: () => void | Promise<void>,
): void {
  describe(`BrainProfileChangeStore contract — ${label}`, () => {
    let store: BrainProfileChangeStore;

    beforeEach(async () => {
      await reset();
      store = makeStore();
    });

    it("returns an empty history for an unknown learner", async () => {
      expect(await store.listForLearner("nope", "t_1")).toEqual([]);
    });

    it("records and reads back a change with every field intact", async () => {
      const rec = change({
        kind: "mastery",
        fields: ["masteryLevels.math"],
        summary: "Math mastery moved up.",
        source: "engagement_sync",
        requiresAck: false,
      });
      await store.record(rec);
      const [got] = await store.listForLearner("lrn_1", "t_1");
      expect(got).toEqual(rec);
    });

    it("scopes reads by tenant", async () => {
      await store.record(change());
      expect(await store.listForLearner("lrn_1", "other_tenant")).toEqual([]);
    });

    it("is append-only and ordered newest-first", async () => {
      await store.record(change({ id: "bpc_1", createdAt: "2026-06-13T10:00:00.000Z" }));
      await store.record(change({ id: "bpc_2", createdAt: "2026-06-13T12:00:00.000Z" }));
      const history = await store.listForLearner("lrn_1", "t_1");
      expect(history.map((c) => c.id)).toEqual(["bpc_2", "bpc_1"]);
    });

    it("ack stamps a pending structural delta and is idempotent", async () => {
      await store.record(change({ id: "bpc_s" }));
      const first = await store.ack("bpc_s", "lrn_1", "t_1", "2026-06-14T08:00:00.000Z");
      expect(first).not.toBeNull();
      expect(first!.ackedAt).toBe("2026-06-14T08:00:00.000Z");
      // Re-ack: returns the row but never overwrites the original ack time.
      const second = await store.ack("bpc_s", "lrn_1", "t_1", "2026-06-15T08:00:00.000Z");
      expect(second!.ackedAt).toBe("2026-06-14T08:00:00.000Z");
    });

    it("ack refuses a mastery (non-requiresAck) row", async () => {
      await store.record(
        change({ id: "bpc_m", kind: "mastery", requiresAck: false, fields: ["masteryLevels.ela"] }),
      );
      expect(await store.ack("bpc_m", "lrn_1", "t_1", "2026-06-14T08:00:00.000Z")).toBeNull();
    });

    it("ack is tenant + learner scoped", async () => {
      await store.record(change({ id: "bpc_t" }));
      expect(await store.ack("bpc_t", "lrn_1", "other_tenant", "2026-06-14T08:00:00.000Z")).toBeNull();
      expect(await store.ack("bpc_t", "other_learner", "t_1", "2026-06-14T08:00:00.000Z")).toBeNull();
    });

    it("listPendingStructural returns only un-acked structural changes, newest-first", async () => {
      await store.record(change({ id: "bpc_p1", createdAt: "2026-06-13T10:00:00.000Z" }));
      await store.record(change({ id: "bpc_p2", createdAt: "2026-06-13T12:00:00.000Z" }));
      await store.record(
        change({ id: "bpc_m", kind: "mastery", requiresAck: false, createdAt: "2026-06-13T13:00:00.000Z" }),
      );
      // Ack one structural change — it drops out of pending.
      await store.ack("bpc_p1", "lrn_1", "t_1", "2026-06-14T08:00:00.000Z");
      const pending = await store.listPendingStructural("lrn_1", "t_1");
      expect(pending.map((c) => c.id)).toEqual(["bpc_p2"]);
    });
  });
}
