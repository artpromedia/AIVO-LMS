/**
 * Sprint 3 fold-in — the care-team invite registry is persistence-backed.
 *
 * Proves invites round-trip through the `collaboration` persistence domain
 * (no process-local global): create → read (grouped + seats) → seat cap →
 * revoke → accept-by-email → member-side learner lookup. The same data is
 * visible through getPersistence().collaboration, so it survives a restart
 * in postgres mode (here exercised against the memory adapter).
 */
import { describe, it, expect, beforeEach } from "vitest";
import { resetStore } from "@/lib/db/store";
import { resetPersistence, getPersistence } from "@/lib/db/persistence";
import {
  createInvite,
  getCareTeam,
  revokeInvite,
  acceptAllInvitesForEmail,
  listLearnersForMember,
  listPendingInvitesForEmail,
} from "@/lib/db/team-invites";

const TENANT = "t_demo";
const LEARNER = "lrn_team";
const PARENT = "u_parent";

describe("team-invites — persistence-backed", () => {
  beforeEach(() => {
    resetStore();
    resetPersistence();
  });

  it("creates an invite that lands in the collaboration domain and the care team", async () => {
    const res = await createInvite({
      role: "teacher",
      tenantId: TENANT,
      learnerId: LEARNER,
      email: "Teach@Example.com",
      invitedBy: PARENT,
    });
    expect(res.ok).toBe(true);

    // Visible through the persistence adapter (durable store).
    const members = await getPersistence().collaboration.listMembersForLearner(LEARNER, TENANT);
    expect(members).toHaveLength(1);
    expect(members[0]!.email).toBe("teach@example.com");
    expect(members[0]!.status).toBe("pending");

    const team = await getCareTeam(LEARNER, TENANT);
    expect(team.teachers).toHaveLength(1);
    expect(team.teachers[0]!.status).toBe("PENDING");
    expect(team.seats.teacher).toEqual({ used: 1, max: 1 });
  });

  it("enforces the seat cap and dedupes", async () => {
    await createInvite({ role: "teacher", tenantId: TENANT, learnerId: LEARNER, email: "a@x.com", invitedBy: PARENT });
    const dupe = await createInvite({ role: "teacher", tenantId: TENANT, learnerId: LEARNER, email: "a@x.com", invitedBy: PARENT });
    expect(dupe.ok).toBe(false);
    const full = await createInvite({ role: "teacher", tenantId: TENANT, learnerId: LEARNER, email: "b@x.com", invitedBy: PARENT });
    expect(full.ok).toBe(false);
    if (!full.ok) expect(full.status).toBe(400);
  });

  it("revoke removes the member from the care team", async () => {
    const res = await createInvite({ role: "caregiver", tenantId: TENANT, learnerId: LEARNER, email: "gran@x.com", invitedBy: PARENT, relationship: "Grandparent" });
    expect(res.ok).toBe(true);
    const id = res.ok ? res.record.id : "";
    await revokeInvite("caregiver", id, LEARNER, TENANT);
    const team = await getCareTeam(LEARNER, TENANT);
    expect(team.caregivers).toHaveLength(0);
  });

  it("accept-by-email links the user; member-side lookup then finds the learner", async () => {
    await createInvite({ role: "therapist", tenantId: TENANT, learnerId: LEARNER, email: "ot@x.com", invitedBy: PARENT, specialty: "OT" });
    expect(await listPendingInvitesForEmail("ot@x.com", TENANT)).toHaveLength(1);

    const accepted = await acceptAllInvitesForEmail("ot@x.com", "u_ot", TENANT);
    expect(accepted.count).toBe(1);

    const learners = await listLearnersForMember("u_ot", "ot@x.com", "therapist", TENANT);
    expect(learners).toEqual([LEARNER]);

    // Another tenant sees nothing.
    expect(await listLearnersForMember("u_ot", "ot@x.com", "therapist", "t_other")).toEqual([]);
  });
});
