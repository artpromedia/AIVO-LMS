/**
 * contributionAcknowledgements — memory == postgres parity (Sprint C-16).
 *
 * The acknowledgement record (role, contributor key, learner first name, the
 * contributor's own folded items, the per-channel delivery flags) must persist
 * byte-for-byte through either backend: an idempotent record (the natural key
 * dedupes), own-scoped listForContributor (by userId OR email),
 * listForLearner / listForTenant newest-first, and markNotified.
 */
import { it, expect } from "vitest";
import type { ContributionAcknowledgement } from "@/lib/db/types";
import { getPersistence } from "@/lib/db/persistence";
import { runInBothModes } from "./parity.harness";

const T = "t_demo";
const L = "lrn_demo_sky";

function ack(over: Partial<ContributionAcknowledgement> = {}): ContributionAcknowledgement {
  return {
    id: "cack-parity-1",
    tenantId: T,
    learnerId: L,
    brainProfileId: "brp-parity-1",
    profileRevision: 2,
    role: "therapist",
    contributorUserId: "u_ot",
    contributorEmail: "ot@clinic.example",
    learnerFirstName: "Sky",
    foldedItems: [
      {
        kind: "accommodation",
        key: "aac_communication_support",
        label: "AAC / communication support",
        reasoning: "therapist insight (communication): uses a speech device.",
      },
    ],
    acknowledgedAt: "2026-06-13T12:00:00.000Z",
    notifiedInApp: false,
    notifiedEmail: false,
    createdAt: "2026-06-13T12:00:00.000Z",
    ...over,
  };
}

runInBothModes("contributionAcknowledgements", () => {
  it("record + listForLearner round-trips and is tenant-scoped", async () => {
    const s = getPersistence().contributionAcknowledgements;
    const { created } = await s.record(ack());
    expect(created).toBe(true);
    const [got] = await s.listForLearner(L, T);
    expect(got).toEqual(ack());
    expect(await s.listForLearner(L, "t_other")).toEqual([]);
  });

  it("is idempotent on (learner, revision, role, email) — re-record returns existing", async () => {
    const s = getPersistence().contributionAcknowledgements;
    await s.record(ack({ id: "cack-1" }));
    const second = await s.record(ack({ id: "cack-2" })); // same natural key, different id
    expect(second.created).toBe(false);
    // Only one row persisted; it kept the FIRST id.
    const rows = await s.listForLearner(L, T);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("cack-1");
  });

  it("a different revision earns a fresh row", async () => {
    const s = getPersistence().contributionAcknowledgements;
    await s.record(ack({ id: "cack-r2", profileRevision: 2 }));
    const next = await s.record(ack({ id: "cack-r3", profileRevision: 3 }));
    expect(next.created).toBe(true);
    expect((await s.listForLearner(L, T)).length).toBe(2);
  });

  it("listForContributor scopes to the contributor (by userId or email), own items only", async () => {
    const s = getPersistence().contributionAcknowledgements;
    await s.record(ack({ id: "mine", contributorUserId: "u_ot", contributorEmail: "ot@clinic.example" }));
    await s.record(
      ack({
        id: "theirs",
        role: "teacher",
        profileRevision: 2,
        contributorUserId: "u_teacher",
        contributorEmail: "teacher@school.example",
      }),
    );
    // By userId.
    const byId = await s.listForContributor({
      tenantId: T,
      contributorUserId: "u_ot",
      contributorEmail: "ignored@x.io",
      learnerId: L,
    });
    expect(byId.map((a) => a.id)).toEqual(["mine"]);
    // By email (no userId).
    const byEmail = await s.listForContributor({
      tenantId: T,
      contributorUserId: null,
      contributorEmail: "ot@clinic.example",
    });
    expect(byEmail.map((a) => a.id)).toEqual(["mine"]);
  });

  it("markNotified flips the per-channel delivery flags", async () => {
    const s = getPersistence().contributionAcknowledgements;
    await s.record(ack({ id: "cack-n" }));
    const updated = await s.markNotified("cack-n", { notifiedInApp: true, notifiedEmail: true });
    expect(updated?.notifiedInApp).toBe(true);
    expect(updated?.notifiedEmail).toBe(true);
    const [reread] = await s.listForLearner(L, T);
    expect(reread.notifiedInApp).toBe(true);
  });

  it("listForTenant returns newest-first across learners", async () => {
    const s = getPersistence().contributionAcknowledgements;
    await s.record(ack({ id: "old", acknowledgedAt: "2026-06-01T00:00:00.000Z" }));
    await s.record(
      ack({ id: "new", learnerId: "lrn_other", profileRevision: 5, acknowledgedAt: "2026-06-10T00:00:00.000Z" }),
    );
    const all = await s.listForTenant(T);
    expect(all.map((a) => a.id)).toEqual(["new", "old"]);
  });
});
