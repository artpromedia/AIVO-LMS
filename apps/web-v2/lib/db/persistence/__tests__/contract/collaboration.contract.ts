/**
 * Shared CollaborationStore contract (Sprint 4).
 *
 * Run against any implementation (memory now, postgres when a test DB is
 * available) so the drizzle adapter is proven equivalent to the in-memory
 * store: insight round-trip + newest-first ordering, accepted-only member
 * filtering, and tenant scoping on every read.
 */
import { describe, it, expect, beforeEach } from "vitest";
import type { CollaboratorInsight, CollaboratorMember } from "@/lib/db/types";
import type { CollaborationStore } from "../../types";

const T = "t_1";

function insight(over: Partial<CollaboratorInsight> = {}): CollaboratorInsight {
  return {
    id: "ci_1",
    learnerId: "lrn_1",
    tenantId: T,
    authorUserId: "u_author",
    authorRole: "therapist",
    insightText: "Uses AAC for expressive language.",
    domain: "communication",
    source: "therapist",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

function member(over: Partial<CollaboratorMember> = {}): CollaboratorMember {
  return {
    id: "cm_1",
    learnerId: "lrn_1",
    tenantId: T,
    role: "therapist",
    email: "ot@example.com",
    memberUserId: "u_member",
    status: "accepted",
    acceptedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

export function collaborationStoreContract(
  label: string,
  makeStore: () => CollaborationStore,
  reset: () => void | Promise<void>,
): void {
  describe(`CollaborationStore contract — ${label}`, () => {
    let store: CollaborationStore;

    beforeEach(async () => {
      await reset();
      store = makeStore();
    });

    it("round-trips an insight and lists it for the learner", async () => {
      await store.addInsight(insight());
      const got = await store.listInsightsForLearner("lrn_1", T);
      expect(got).toHaveLength(1);
      expect(got[0]!.id).toBe("ci_1");
      expect(got[0]!.domain).toBe("communication");
    });

    it("lists insights newest-first", async () => {
      await store.addInsight(insight({ id: "ci_old", createdAt: "2026-01-01T00:00:00.000Z" }));
      await store.addInsight(insight({ id: "ci_new", createdAt: "2026-02-01T00:00:00.000Z" }));
      const got = await store.listInsightsForLearner("lrn_1", T);
      expect(got.map((i) => i.id)).toEqual(["ci_new", "ci_old"]);
    });

    it("scopes insight reads by tenant", async () => {
      await store.addInsight(insight());
      expect(await store.listInsightsForLearner("lrn_1", "t_other")).toEqual([]);
    });

    it("listAcceptedMembers returns only accepted members, tenant-scoped", async () => {
      await store.upsertMember(member({ id: "cm_accepted", status: "accepted" }));
      await store.upsertMember(member({ id: "cm_pending", status: "pending" }));
      const accepted = await store.listAcceptedMembers("lrn_1", T);
      expect(accepted.map((m) => m.id)).toEqual(["cm_accepted"]);
      expect(await store.listAcceptedMembers("lrn_1", "t_other")).toEqual([]);
    });

    it("upsertMember updates status in place (e.g. accept flips pending→accepted)", async () => {
      await store.upsertMember(member({ id: "cm_1", status: "pending" }));
      expect(await store.listAcceptedMembers("lrn_1", T)).toHaveLength(0);
      await store.upsertMember(member({ id: "cm_1", status: "accepted" }));
      expect((await store.listAcceptedMembers("lrn_1", T)).map((m) => m.id)).toEqual(["cm_1"]);
    });
  });
}
