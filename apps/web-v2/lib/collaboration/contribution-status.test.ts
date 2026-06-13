/**
 * Sprint C-08 — web BFF contribution-status derivation.
 *
 * Mirrors the family-svc rule from its own stack: teacher contribution comes
 * from the C-07 `hasTeacherContributed`; therapist/caregiver from authored
 * insights/observations. Verifies the per-role flip and the voices roll-up
 * (invited = live members; contributed = those with a landed contribution).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { LearnerCareTeam, TeamMemberRecord } from "@/lib/db/team-invites";

// ── Mock the four dependencies the derivation composes. ──
const hasTeacherContributed = vi.fn();
const listInsightsForLearner = vi.fn();
const listCaregiverObservations = vi.fn();

vi.mock("@/lib/teacher/teacher-assessment-status", () => ({
  hasTeacherContributed: (...a: unknown[]) => hasTeacherContributed(...a),
}));
vi.mock("@/lib/db/persistence", () => ({
  getPersistence: () => ({
    collaboration: { listInsightsForLearner: (...a: unknown[]) => listInsightsForLearner(...a) },
  }),
}));
vi.mock("@/lib/db/repos", () => ({
  listCaregiverObservations: (...a: unknown[]) => listCaregiverObservations(...a),
}));
// getCareTeam is only used when no careTeam is passed; we always pass one.
vi.mock("@/lib/db/team-invites", async (orig) => {
  const actual = (await orig()) as Record<string, unknown>;
  return { ...actual, getCareTeam: vi.fn() };
});

import { getContributionStatus } from "./contribution-status";

function member(over: Partial<TeamMemberRecord>): TeamMemberRecord {
  return {
    id: "m1",
    tenantId: "t1",
    learnerId: "l1",
    email: "person@x.com",
    memberUserId: "u1",
    invitedBy: "parent",
    invitedAt: "2026-06-01T00:00:00.000Z",
    acceptedAt: "2026-06-02T00:00:00.000Z",
    status: "ACCEPTED",
    relationship: null,
    specialty: null,
    credentials: null,
    ...over,
  };
}

function careTeam(over: Partial<LearnerCareTeam>): LearnerCareTeam {
  return {
    teachers: [],
    caregivers: [],
    therapists: [],
    seats: {
      teacher: { used: 0, max: 1 },
      caregiver: { used: 0, max: 2 },
      therapist: { used: 0, max: 1 },
    },
    ...over,
  };
}

beforeEach(() => {
  hasTeacherContributed.mockReset().mockResolvedValue(false);
  listInsightsForLearner.mockReset().mockResolvedValue([]);
  listCaregiverObservations.mockReset().mockReturnValue([]);
});

describe("getContributionStatus", () => {
  it("flags a teacher as contributed via hasTeacherContributed (C-07)", async () => {
    hasTeacherContributed.mockResolvedValue(true);
    const team = careTeam({
      teachers: [member({ id: "t", memberUserId: "u-teacher" })],
    });
    const res = await getContributionStatus("l1", "t1", team);
    const t = res.members.find((m) => m.kind === "teacher")!;
    expect(t.contributed).toBe(true);
    expect(res.voices).toEqual({ invited: 1, contributed: 1 });
  });

  it("a teacher with no submitted assessment is not contributed", async () => {
    hasTeacherContributed.mockResolvedValue(false);
    const team = careTeam({ teachers: [member({ id: "t", memberUserId: "u-teacher" })] });
    const res = await getContributionStatus("l1", "t1", team);
    expect(res.members[0].contributed).toBe(false);
    expect(res.voices).toEqual({ invited: 1, contributed: 0 });
  });

  it("a therapist is contributed when they authored an insight", async () => {
    listInsightsForLearner.mockResolvedValue([
      { authorRole: "therapist", authorUserId: "u-ot", createdAt: "2026-06-09T00:00:00.000Z" },
    ]);
    const team = careTeam({
      therapists: [member({ id: "th", memberUserId: "u-ot" })],
    });
    const res = await getContributionStatus("l1", "t1", team);
    const th = res.members.find((m) => m.kind === "therapist")!;
    expect(th.contributed).toBe(true);
    expect(th.lastContributionAt).toBe("2026-06-09T00:00:00.000Z");
  });

  it("a caregiver is contributed when they authored an observation", async () => {
    listCaregiverObservations.mockReturnValue([
      { caregiverUserId: "u-grandma", observedAt: "2026-06-08T00:00:00.000Z", createdAt: "x" },
    ]);
    const team = careTeam({
      caregivers: [member({ id: "cg", memberUserId: "u-grandma" })],
    });
    const res = await getContributionStatus("l1", "t1", team);
    const cg = res.members.find((m) => m.kind === "caregiver")!;
    expect(cg.contributed).toBe(true);
    expect(cg.lastContributionAt).toBe("2026-06-08T00:00:00.000Z");
  });

  it("a caregiver's observation does not credit a different caregiver", async () => {
    listCaregiverObservations.mockReturnValue([
      { caregiverUserId: "u-a", observedAt: "2026-06-08T00:00:00.000Z", createdAt: "x" },
    ]);
    const team = careTeam({
      caregivers: [
        member({ id: "cgA", memberUserId: "u-a" }),
        member({ id: "cgB", memberUserId: "u-b", email: "b@x.com" }),
      ],
    });
    const res = await getContributionStatus("l1", "t1", team);
    expect(res.members.find((m) => m.id === "cgA")!.contributed).toBe(true);
    expect(res.members.find((m) => m.id === "cgB")!.contributed).toBe(false);
    expect(res.voices).toEqual({ invited: 2, contributed: 1 });
  });

  it("a pending invite is resendable and counts toward invited but not contributed", async () => {
    const team = careTeam({
      teachers: [member({ id: "t", status: "PENDING", acceptedAt: null, memberUserId: null })],
    });
    const res = await getContributionStatus("l1", "t1", team);
    expect(res.members[0].resendable).toBe(true);
    expect(res.members[0].contributed).toBe(false);
    expect(res.voices).toEqual({ invited: 1, contributed: 0 });
  });

  it("rolls up mixed teams across all three roles", async () => {
    hasTeacherContributed.mockResolvedValue(true);
    listInsightsForLearner.mockResolvedValue([
      { authorRole: "therapist", authorUserId: "u-ot", createdAt: "2026-06-09T00:00:00.000Z" },
    ]);
    const team = careTeam({
      teachers: [member({ id: "t", memberUserId: "u-teacher" })],
      therapists: [member({ id: "th", memberUserId: "u-ot" })],
      caregivers: [member({ id: "cg", status: "PENDING", acceptedAt: null, memberUserId: null })],
    });
    const res = await getContributionStatus("l1", "t1", team);
    // teacher + therapist contributed; caregiver pending.
    expect(res.voices).toEqual({ invited: 3, contributed: 2 });
  });
});
