import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const mocks = vi.hoisted(() => ({ listLearnersForMember: vi.fn() }));
vi.mock("@/lib/db/team-invites", () => ({ listLearnersForMember: mocks.listLearnersForMember }));
const { caregiverCapabilityMatrix, requireCaregiverCapability } = await import("./caregiver-capabilities");

const session: SessionProfile = {
  userId: "caregiver_1",
  tenantId: "tenant_1",
  role: "caregiver",
  email: "care@example.test",
  displayName: "Care Giver",
  permissions: [],
  capabilities: [],
};

describe("caregiver capability enforcement", () => {
  beforeEach(() => mocks.listLearnersForMember.mockReset());

  it("allows an explicitly granted caregiver capability only for granted learners", async () => {
    mocks.listLearnersForMember.mockResolvedValueOnce(["learner_a"]);
    await expect(requireCaregiverCapability(session, "learner_a", "caregiver.add_observation", "req_ok")).resolves.toBeNull();

    mocks.listLearnersForMember.mockResolvedValueOnce(["learner_a"]);
    const denied = await requireCaregiverCapability(session, "learner_b", "caregiver.add_observation", "req_deny");
    expect(denied?.status).toBe(403);
  });

  it("documents parent-only powers that caregiver grants never include", () => {
    expect(caregiverCapabilityMatrix().parentOnlyDenied).toEqual(
      expect.arrayContaining(["billing.manage", "consent.manage", "data.export", "data.delete", "brain.approve"]),
    );
  });
});
