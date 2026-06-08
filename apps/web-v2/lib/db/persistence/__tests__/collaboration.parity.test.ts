/**
 * collaboration — memory == postgres parity (Sprint 1).
 * Insights are newest-first; accepted members exclude pending/declined.
 */
import { it, expect } from "vitest";
import type { CollaboratorInsight, CollaboratorMember } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky";

runInBothModes("collaboration", () => {
  it("insights list newest-first for a learner", async () => {
    const s = getPersistence().collaboration;
    const insight = (id: string, createdAt: string): CollaboratorInsight =>
      ({
        id,
        learnerId: L,
        tenantId: T,
        authorUserId: "u_demo_parent",
        role: "caregiver",
        body: "note",
        createdAt,
      }) as unknown as CollaboratorInsight;
    await s.addInsight(insight("ins-1", "2026-01-01T00:00:00.000Z"));
    await s.addInsight(insight("ins-2", "2026-01-03T00:00:00.000Z"));
    const listed = await s.listInsightsForLearner(L, T);
    const ids = listed.filter((i) => i.id.startsWith("ins-")).map((i) => i.id);
    expect(ids).toEqual(["ins-2", "ins-1"]);
  });

  it("listAcceptedMembers excludes non-accepted statuses", async () => {
    const s = getPersistence().collaboration;
    const member = (id: string, status: string): CollaboratorMember =>
      ({
        id,
        learnerId: L,
        tenantId: T,
        email: `${id}@example.com`,
        role: "caregiver",
        status,
      }) as unknown as CollaboratorMember;
    await s.upsertMember(member("mem-accepted", "accepted"));
    await s.upsertMember(member("mem-pending", "pending"));
    const accepted = await s.listAcceptedMembers(L, T);
    expect(accepted.some((m) => m.id === "mem-accepted")).toBe(true);
    expect(accepted.some((m) => m.id === "mem-pending")).toBe(false);
    // The full care-team view still includes both.
    const all = await s.listMembersForLearner(L, T);
    expect(all.some((m) => m.id === "mem-pending")).toBe(true);
  });
});
