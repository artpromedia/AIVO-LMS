/**
 * RBAC contract for the teacher team-builder server actions:
 *  - inviteTeamMemberAction requires the teacher role, requires access to the
 *    learner, and only accepts caregiver|therapist (never teacher);
 *  - revokeTeamMemberAction withdraws ONLY invites this teacher sent
 *    (invitedBy === session.userId), regardless of role gating.
 * These are the security-critical paths, so they are pinned directly.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const requirePageRole = vi.fn();
vi.mock("@/lib/auth/server", () => ({
  requirePageRole: (...a: unknown[]) => requirePageRole(...a),
}));

const teacherCanAccessLearner = vi.fn();
vi.mock("@/lib/db/repos", () => ({
  teacherCanAccessLearner: (...a: unknown[]) => teacherCanAccessLearner(...a),
}));

const createInvite = vi.fn();
const getCareTeam = vi.fn();
const revokeInvite = vi.fn();
vi.mock("@/lib/db/team-invites", () => ({
  createInvite: (...a: unknown[]) => createInvite(...a),
  getCareTeam: (...a: unknown[]) => getCareTeam(...a),
  revokeInvite: (...a: unknown[]) => revokeInvite(...a),
}));

vi.mock("@/lib/bff/audit", () => ({ audit: vi.fn() }));
vi.mock("@/lib/observability/logger", () => ({ newRequestId: () => "req-test" }));

import { inviteTeamMemberAction, revokeTeamMemberAction } from "./actions";

const SESSION = { role: "teacher", userId: "usr-teacher", tenantId: "t-1" };
const INITIAL = { ok: false, error: null };

function inviteForm(fields: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

beforeEach(() => {
  vi.clearAllMocks();
  requirePageRole.mockResolvedValue(SESSION);
  teacherCanAccessLearner.mockResolvedValue(true);
  createInvite.mockResolvedValue({ ok: true, record: { id: "inv-new" } });
});

describe("inviteTeamMemberAction", () => {
  it("requires the teacher role", async () => {
    await inviteTeamMemberAction(INITIAL, inviteForm({ learnerId: "l1", role: "caregiver", email: "a@b.co" }));
    expect(requirePageRole).toHaveBeenCalledWith(["teacher"]);
  });

  it("invites a caregiver when the teacher has access", async () => {
    const res = await inviteTeamMemberAction(
      INITIAL,
      inviteForm({ learnerId: "l1", role: "caregiver", email: "grandma@b.co" }),
    );
    expect(res.ok).toBe(true);
    expect(createInvite).toHaveBeenCalledWith(
      expect.objectContaining({ role: "caregiver", learnerId: "l1", invitedBy: "usr-teacher" }),
    );
  });

  it("denies invites for a learner the teacher cannot access", async () => {
    teacherCanAccessLearner.mockResolvedValue(false);
    const res = await inviteTeamMemberAction(
      INITIAL,
      inviteForm({ learnerId: "l1", role: "caregiver", email: "a@b.co" }),
    );
    expect(res.ok).toBe(false);
    expect(createInvite).not.toHaveBeenCalled();
  });

  it("rejects the teacher role (single teacher seat is parent-owned)", async () => {
    const res = await inviteTeamMemberAction(
      INITIAL,
      inviteForm({ learnerId: "l1", role: "teacher", email: "a@b.co" }),
    );
    expect(res.ok).toBe(false);
    expect(createInvite).not.toHaveBeenCalled();
  });
});

describe("revokeTeamMemberAction", () => {
  it("withdraws an invite the teacher sent", async () => {
    getCareTeam.mockResolvedValue({
      teachers: [],
      caregivers: [{ id: "inv-1", invitedBy: "usr-teacher", status: "PENDING" }],
      therapists: [],
    });
    await revokeTeamMemberAction(inviteForm({ learnerId: "l1", role: "caregiver", inviteId: "inv-1" }));
    expect(revokeInvite).toHaveBeenCalledWith("caregiver", "inv-1", "l1", "t-1");
  });

  it("does NOT withdraw an invite the teacher did not send", async () => {
    getCareTeam.mockResolvedValue({
      teachers: [],
      caregivers: [{ id: "inv-1", invitedBy: "usr-parent", status: "PENDING" }],
      therapists: [],
    });
    await revokeTeamMemberAction(inviteForm({ learnerId: "l1", role: "caregiver", inviteId: "inv-1" }));
    expect(revokeInvite).not.toHaveBeenCalled();
  });

  it("does NOT withdraw an already-accepted invite (lifecycle guard)", async () => {
    getCareTeam.mockResolvedValue({
      teachers: [],
      caregivers: [{ id: "inv-1", invitedBy: "usr-teacher", status: "ACCEPTED" }],
      therapists: [],
    });
    await revokeTeamMemberAction(inviteForm({ learnerId: "l1", role: "caregiver", inviteId: "inv-1" }));
    expect(revokeInvite).not.toHaveBeenCalled();
  });

  it("does nothing without learner access", async () => {
    teacherCanAccessLearner.mockResolvedValue(false);
    await revokeTeamMemberAction(inviteForm({ learnerId: "l1", role: "caregiver", inviteId: "inv-1" }));
    expect(getCareTeam).not.toHaveBeenCalled();
    expect(revokeInvite).not.toHaveBeenCalled();
  });
});
