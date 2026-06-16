/**
 * Learner PIN route — identity-svc is the source of truth (Task #34).
 *
 * The mobile `pin-login` flow verifies the PIN stored in identity-svc. So when
 * identity-svc is enabled and we hold a bearer, the route MUST NOT report
 * success by writing to the in-memory store if it cannot resolve/provision the
 * canonical learner — that would tell the parent the PIN is set while mobile
 * login keeps failing (a silent cross-platform desync). It must surface a
 * retriable error instead, and only write to identity-svc on the happy path.
 *
 * Guards + collaborators are mocked so the test isolates the identity
 * resolution branch.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/bff/guards", () => ({
  requireSession: vi.fn(async () => ({
    session: { userId: "u_parent", tenantId: "t_demo", role: "parent" },
  })),
  requireRole: vi.fn(() => null),
  requireLearnerScope: vi.fn(async () => null),
  requireApprovedBrainForPin: vi.fn(async () => null),
}));

vi.mock("@/lib/bff/identity-learners", () => ({
  isIdentitySvcEnabled: () => true,
  getIdentityBearer: vi.fn(async () => "Bearer x"),
  setLearnerPinViaIdentity: vi.fn(async () => ({
    ok: true,
    data: { success: true, learnerId: "uuid-1" },
  })),
}));

vi.mock("@/lib/bff/learner-unification", () => ({ provisionAndLink: vi.fn() }));

vi.mock("@/lib/db/repos", () => ({
  getLearner: vi.fn(async () => ({
    id: "lrn_x",
    tenantId: "t_demo",
    firstName: "Kid",
    displayName: "Kid",
    birthYear: 2016,
    identityLearnerId: null,
  })),
}));

vi.mock("@/lib/onboarding-state", () => ({ advanceOnboarding: vi.fn(async () => {}) }));
vi.mock("@/lib/bff/audit", () => ({ audit: vi.fn() }));

vi.mock("@/lib/db/learner-pin-store", () => ({
  isValidPin: () => true,
  setStoredLearnerPin: vi.fn(() => ({ hasPin: true })),
  getStoredLearnerPinMeta: () => ({ hasPin: false }),
}));

import { POST } from "@/app/api/bff/learners/[learnerId]/pin/route";
import { provisionAndLink } from "@/lib/bff/learner-unification";
import { setLearnerPinViaIdentity } from "@/lib/bff/identity-learners";
import { setStoredLearnerPin } from "@/lib/db/learner-pin-store";

const provisionMock = vi.mocked(provisionAndLink);
const identityPinMock = vi.mocked(setLearnerPinViaIdentity);
const memoryPinMock = vi.mocked(setStoredLearnerPin);

function req(): Request {
  return new Request("http://localhost/api/bff/learners/lrn_x/pin", {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "req_test" },
    body: JSON.stringify({ pin: "1234" }),
  });
}
const params = { params: Promise.resolve({ learnerId: "lrn_x" }) };

const baseProfile = {
  id: "lrn_x",
  tenantId: "t_demo",
  firstName: "Kid",
  displayName: "Kid",
  birthYear: 2016,
};

describe("PIN route — identity-svc resolution", () => {
  beforeEach(() => {
    provisionMock.mockReset();
    identityPinMock.mockClear();
    memoryPinMock.mockClear();
  });

  it("does NOT report success via memory fallback when the canonical learner cannot be resolved", async () => {
    // identity create/link failed → still unlinked.
    provisionMock.mockResolvedValue({ ...baseProfile, identityLearnerId: null } as never);

    const res = await POST(req(), params);

    expect(res.status).toBe(502);
    // The crux: no in-memory PIN write that would falsely report success.
    expect(memoryPinMock).not.toHaveBeenCalled();
    expect(identityPinMock).not.toHaveBeenCalled();
  });

  it("writes the PIN to identity-svc on the happy path", async () => {
    provisionMock.mockResolvedValue({ ...baseProfile, identityLearnerId: "uuid-1" } as never);

    const res = await POST(req(), params);

    expect(res.status).toBe(201);
    expect(identityPinMock).toHaveBeenCalledWith("Bearer x", "uuid-1", "1234");
    expect(memoryPinMock).not.toHaveBeenCalled();
  });
});
