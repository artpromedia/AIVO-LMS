import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCareTeam: vi.fn(),
  getActiveBaselineForLearner: vi.fn(),
  getBrainProfile: vi.fn(),
  findParentAssessment: vi.fn(),
}));
vi.mock("@/lib/db/team-invites", () => ({ getCareTeam: mocks.getCareTeam }));
vi.mock("@/lib/db/repos", () => ({
  getActiveBaselineForLearner: mocks.getActiveBaselineForLearner,
  getBrainProfile: mocks.getBrainProfile,
  findParentAssessment: mocks.findParentAssessment,
}));
const { advanceOnboarding, deriveOnboardingState, listOnboardingTransitions, resetOnboardingStateForTests, requireOnboardingState } = await import("./onboarding-state");

describe("onboarding state machine", () => {
  beforeEach(() => {
    resetOnboardingStateForTests();
    mocks.getCareTeam.mockResolvedValue({ teachers: [], caregivers: [], therapists: [] });
    mocks.getActiveBaselineForLearner.mockResolvedValue(null);
    mocks.getBrainProfile.mockResolvedValue(null);
    mocks.findParentAssessment.mockResolvedValue(null);
  });

  it("moves submitted parent assessments immediately to baseline_ready when no contributors are awaited", async () => {
    const state = await advanceOnboarding("learner_1", "tenant_1", "parent_assessment_submitted", "parent_1");
    expect(state.state).toBe("baseline_ready");
    expect(listOnboardingTransitions("learner_1", "tenant_1")).toHaveLength(1);
  });

  it("records awaited contributors but does not block baseline under the chosen policy", async () => {
    mocks.getCareTeam.mockResolvedValue({ teachers: [{ status: "PENDING" }], caregivers: [], therapists: [] });
    const state = await advanceOnboarding("learner_1", "tenant_1", "parent_assessment_submitted", "parent_1");
    expect(state.state).toBe("baseline_ready");
    expect(state.awaitedContributorCount).toBe(1);
  });

  it("rejects baseline preconditions before parent assessment completion", async () => {
    const gate = await requireOnboardingState("learner_1", "tenant_1", ["baseline_ready"]);
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.record.state).toBe("learner_created");
  });

  it("derives approval state from the current brain profile", async () => {
    mocks.findParentAssessment.mockResolvedValue({ submittedAt: "2026-06-14T00:00:00.000Z", completedSections: ["goals"] });
    mocks.getActiveBaselineForLearner.mockResolvedValue({ status: "complete" });
    mocks.getBrainProfile.mockResolvedValue({ cloneStage: "approved" });
    await expect(deriveOnboardingState("learner_1", "tenant_1")).resolves.toMatchObject({ state: "brain_approved" });
  });
});
