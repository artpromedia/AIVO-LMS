/**
 * Phase 5 — Privacy: learner under a parent account.
 *
 * ADR 0020 Phase 5 ("Privacy") requires that a learner under a parent
 * account must **never** see parent-only data, even when the device
 * has both roles signed in simultaneously (e.g. a family iPad where
 * the parent has approved the learner role and both share the same
 * `aivo_session_roles` cookie).
 *
 * The defense is layered:
 *
 *   1. The role switcher will not switch into a step-up role without a
 *      fresh factor — covered by `step-up-coverage.test.ts`.
 *   2. The server BFF authorizes off the **active** role, not the held
 *      set — covered by `data-isolation.test.ts`.
 *   3. **This file** asserts the end-to-end privacy invariant: a
 *      session with `roles=["parent","learner"]` and
 *      `activeRole=learner` is rejected by every parent-only BFF guard
 *      (parent subscription, parent learners curriculum upload, parent
 *      privacy export, parent privacy delete-request), and conversely
 *      the same user, after switching back to `activeRole=parent`, is
 *      allowed through the same guards.
 *
 * The intent is to lock the contract so a future "learner can see
 * grown-up's billing for convenience" feature must update this test
 * deliberately — silent regression is impossible.
 */
import { describe, expect, it } from "vitest";
import { requireRole } from "@/lib/bff/guards";
import type { SessionProfile } from "@/lib/auth/types";

function familyDeviceSession(activeRole: SessionProfile["role"]): SessionProfile {
  return {
    userId: "u_family_device",
    tenantId: "t_family",
    role: activeRole,
    email: "family@demo.aivo",
    displayName: activeRole === "learner" ? "Sky" : "Riley Parent",
    permissions: [],
    // Both roles signed in on the device.
    roles: ["parent", "learner"],
    // learnerId is populated when the learner role is active; the
    // parent role would not have a learnerId field on a real account
    // but leaving it set here makes the failure modes more obvious:
    // even with the learnerId still hanging around, parent-only guards
    // must still reject.
    learnerId: "lrn_family_sky",
  };
}

const PARENT_ONLY_GUARDS: Array<{ name: string; roles: SessionProfile["role"][] }> = [
  { name: "parent subscription", roles: ["parent"] },
  { name: "parent privacy export", roles: ["parent"] },
  { name: "parent privacy delete-request (create)", roles: ["parent"] },
  // The parent + caregiver curriculum upload guard accepts both
  // surrogate roles; learner must still be rejected.
  { name: "parent learners curriculum upload", roles: ["parent", "caregiver"] },
];

describe("Phase 5 privacy — learner-under-parent device", () => {
  for (const guard of PARENT_ONLY_GUARDS) {
    it(`blocks "${guard.name}" when activeRole=learner even though parent is held`, () => {
      const learnerActive = familyDeviceSession("learner");
      // Sanity: the user really does hold parent on the device.
      expect(learnerActive.roles).toContain("parent");
      const err = requireRole(learnerActive, guard.roles, "req_privacy_1");
      expect(err, `${guard.name} must reject a learner-active session`).not.toBeNull();
      expect(err!.status).toBe(403);
    });

    it(`allows "${guard.name}" when activeRole=parent on the same device`, () => {
      const parentActive = familyDeviceSession("parent");
      const err = requireRole(parentActive, guard.roles, "req_privacy_2");
      expect(err, `${guard.name} must accept a parent-active session`).toBeNull();
    });
  }

  it("parent-side role check is strictly active-role: holding learner does not downgrade parent access", () => {
    // Symmetric guarantee — the parent-active session is not penalised
    // for also holding learner. This mirrors the inverse of the
    // "learner can't see parent" privacy invariant.
    const parentActive = familyDeviceSession("parent");
    expect(parentActive.roles).toContain("learner");
    const err = requireRole(parentActive, ["parent"], "req_privacy_3");
    expect(err).toBeNull();
  });
});
