import { beforeEach, describe, expect, it, vi } from "vitest";
import { Permission } from "@aivo/security";
import type { SessionProfile } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({
  parentCanAccessLearner: vi.fn(),
  teacherCanAccessLearner: vi.fn(),
  getLearner: vi.fn(),
  getBrainProfile: vi.fn(),
  listLearnersForMember: vi.fn(),
}));

vi.mock("@/lib/db/repos", () => ({
  parentCanAccessLearner: mocks.parentCanAccessLearner,
  teacherCanAccessLearner: mocks.teacherCanAccessLearner,
  getLearner: mocks.getLearner,
  getBrainProfile: mocks.getBrainProfile,
}));

vi.mock("@/lib/db/team-invites", () => ({
  listLearnersForMember: mocks.listLearnersForMember,
}));

const { requireApprovedBrainForPin, requireLearnerScope, requirePermission, requireRole } = await import("./guards");

const baseSession: SessionProfile = {
  userId: "u_platform",
  tenantId: "t_platform",
  role: "platform_admin",
  email: "platform@example.com",
  displayName: "Platform Admin",
  permissions: ["*"],
  capabilities: ["*"],
};

describe("requirePermission", () => {
  it("allows a session whose active role grants the permission", () => {
    expect(requirePermission(baseSession, Permission.UserRead, "req_1")).toBeNull();
  });

  it("rejects when the active role does not grant the permission", () => {
    const res = requirePermission(
      { ...baseSession, role: "marketing", permissions: [], capabilities: [] },
      Permission.UserRead,
      "req_2",
    );
    expect(res?.status).toBe(403);
  });
});

describe("requireRole", () => {
  it("continues to enforce explicit role guards for backward compatibility", () => {
    expect(requireRole(baseSession, ["platform_admin"], "req_3")).toBeNull();
    expect(requireRole({ ...baseSession, role: "support" }, ["platform_admin"], "req_4")?.status).toBe(
      403,
    );
  });
});

describe("requireLearnerScope", () => {
  beforeEach(() => {
    mocks.parentCanAccessLearner.mockReset();
    mocks.teacherCanAccessLearner.mockReset();
    mocks.getLearner.mockReset();
    mocks.getBrainProfile.mockReset();
    mocks.listLearnersForMember.mockReset();
  });

  it("keeps parent access tied to parent/learner relationships", async () => {
    mocks.parentCanAccessLearner.mockResolvedValueOnce(false);
    const res = await requireLearnerScope(
      { ...baseSession, role: "parent", userId: "p1", tenantId: "t1" },
      "learner_b",
      "req_parent",
    );
    expect(res?.status).toBe(403);
    expect(mocks.parentCanAccessLearner).toHaveBeenCalledWith("p1", "learner_b", "t1");
  });

  it("allows a teacher only through roster access or accepted team membership", async () => {
    mocks.teacherCanAccessLearner.mockResolvedValueOnce(false);
    mocks.listLearnersForMember.mockResolvedValueOnce(["learner_a"]);
    const denied = await requireLearnerScope(
      { ...baseSession, role: "teacher", userId: "teacher_1", email: "t@example.com", tenantId: "tenant_1" },
      "learner_b",
      "req_teacher_denied",
    );
    expect(denied?.status).toBe(403);

    mocks.teacherCanAccessLearner.mockResolvedValueOnce(false);
    mocks.listLearnersForMember.mockResolvedValueOnce(["learner_b"]);
    await expect(
      requireLearnerScope(
        { ...baseSession, role: "teacher", userId: "teacher_1", email: "t@example.com", tenantId: "tenant_1" },
        "learner_b",
        "req_teacher_allowed",
      ),
    ).resolves.toBeNull();
  });

  it("blocks same-tenant caregiver access without an accepted learner grant", async () => {
    mocks.listLearnersForMember.mockResolvedValueOnce(["learner_a"]);
    const res = await requireLearnerScope(
      { ...baseSession, role: "caregiver", userId: "care_1", email: "care@example.com", tenantId: "tenant_1" },
      "learner_b",
      "req_caregiver",
    );
    expect(res?.status).toBe(403);
    expect(mocks.getLearner).not.toHaveBeenCalled();
  });

  it("blocks same-tenant therapist access without an accepted learner grant", async () => {
    mocks.listLearnersForMember.mockResolvedValueOnce([]);
    const res = await requireLearnerScope(
      { ...baseSession, role: "therapist", userId: "thera_1", email: "ot@example.com", tenantId: "tenant_1" },
      "learner_b",
      "req_therapist",
    );
    expect(res?.status).toBe(403);
    expect(mocks.getLearner).not.toHaveBeenCalled();
  });
});


describe("requireApprovedBrainForPin", () => {
  beforeEach(() => {
    mocks.getBrainProfile.mockReset();
  });

  it("blocks PIN activation until the brain profile is approved", async () => {
    mocks.getBrainProfile.mockResolvedValueOnce(null);
    expect((await requireApprovedBrainForPin(baseSession, "learner_a", "req_pin_missing"))?.status).toBe(412);

    mocks.getBrainProfile.mockResolvedValueOnce({ cloneStage: "cloned" });
    expect((await requireApprovedBrainForPin(baseSession, "learner_a", "req_pin_cloned"))?.status).toBe(412);

    mocks.getBrainProfile.mockResolvedValueOnce({ cloneStage: "approved" });
    await expect(requireApprovedBrainForPin(baseSession, "learner_a", "req_pin_ok")).resolves.toBeNull();
  });
});
