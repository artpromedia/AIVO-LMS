/**
 * Phase 5 — Step-up coverage gate (nav package, pure logic).
 *
 * ADR 0020 Phase 5 requires that switching *into* any role marked
 * `requiresStepUp` is gated by a fresh authentication factor. The web
 * shell enforces the HTTP side of this contract (see
 * `apps/web-v2/lib/auth/step-up-coverage.test.ts`); this test pins the
 * pure-data side that the rest of the stack reads:
 *
 *   - `requiresStepUpForRole(role)` must agree with
 *     `ROLE_META[role].requiresStepUp` for **every** role in `ROLES`.
 *   - The roles flagged as `requiresStepUp` must exactly match the
 *     ADR 0020 §4 list (parent, teacher, therapist, caregiver,
 *     schoolAdmin, districtAdmin, internal). The learner role is the
 *     only one that intentionally does not require step-up so kids
 *     can sign back in without WebAuthn ceremony.
 *
 * Adding a new role without classifying its step-up policy will fail
 * the second assertion, which is the desired guard — every role must
 * be a conscious decision rather than defaulting to "no factor".
 */
import { describe, expect, it } from "vitest";
import { ROLE_META, ROLES, type Role } from "../roles.js";
import { requiresStepUpForRole } from "../session.js";

const EXPECTED_STEP_UP: ReadonlySet<Role> = new Set<Role>([
  "parent",
  "teacher",
  "therapist",
  "caregiver",
  "schoolAdmin",
  "districtAdmin",
  "internal",
]);

describe("Phase 5 step-up coverage (nav)", () => {
  for (const role of ROLES) {
    it(`requiresStepUpForRole("${role}") matches ROLE_META`, () => {
      expect(requiresStepUpForRole(role)).toBe(ROLE_META[role].requiresStepUp);
    });
  }

  it("the set of step-up roles matches ADR 0020 §4", () => {
    const actual = new Set<Role>(ROLES.filter((r) => ROLE_META[r].requiresStepUp));
    expect([...actual].sort()).toEqual([...EXPECTED_STEP_UP].sort());
  });

  it("learner is the only non-step-up role", () => {
    const nonStepUp = ROLES.filter((r) => !ROLE_META[r].requiresStepUp);
    expect(nonStepUp).toEqual(["learner"]);
  });
});
