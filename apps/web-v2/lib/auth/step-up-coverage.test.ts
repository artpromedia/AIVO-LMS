/**
 * Phase 5 — Step-up coverage for `POST /api/bff/me/active-role`.
 *
 * ADR 0020 Phase 5 ("Hardening & policy") requires that switching
 * *into* any role with `ROLE_META[role].requiresStepUp === true` is
 * blocked when no fresh step-up factor is present, for **every** such
 * role. The existing `active-role.test.ts` covers individual scenarios;
 * this file is the exhaustive matrix gate so a future role that
 * forgets to require step-up cannot slip past CI.
 *
 * The test runs the same pure-logic decision function the route uses
 * (`decideActiveRoleSwitch`), with a session that holds every role,
 * then asserts each `requiresStepUp` role rejects with
 * `STEP_UP_REQUIRED` when no token is presented and that a freshly-
 * minted token unblocks the switch. Non-step-up roles (currently only
 * learner) are asserted to switch without any token.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  serverEnv: { AUTH_MODE: "mock" },
}));

import { ROLES, ROLE_META, type Role as NavRole } from "@aivo/nav";
import { buildMockStepUpToken } from "./step-up-verify";
import { decideActiveRoleSwitch } from "./active-role";
import { toWebRole } from "./role-session";
import type { Role as WebRole, SessionProfile } from "./types";

function multiRoleSession(active: WebRole, held: WebRole[]): SessionProfile {
  const roles = held.includes(active) ? held : [active, ...held];
  return {
    userId: "u_phase5",
    tenantId: "t_phase5",
    role: active,
    email: "phase5@demo.aivo",
    displayName: "Phase 5",
    permissions: [],
    roles,
  };
}

const headersWith = (record: Record<string, string>) => (name: string) =>
  record[name.toLowerCase()] ?? null;

describe("Phase 5 — every requiresStepUp role is blocked without a fresh factor", () => {
  // Build a single session that holds every web role so we can exercise
  // the switch into each target without re-mocking session state per
  // case. `activeRole` defaults to `learner` (the only non-step-up
  // role) so the "switch into X" semantics are unambiguous.
  const allHeld = (ROLES as readonly NavRole[]).map(toWebRole);
  const session = multiRoleSession("learner", allHeld);

  for (const role of ROLES as readonly NavRole[]) {
    if (!ROLE_META[role].requiresStepUp) continue;

    it(`blocks switching into "${role}" when no x-step-up-token is presented`, async () => {
      const r = await decideActiveRoleSwitch({
        session,
        body: { role },
        getHeader: headersWith({}),
      });
      expect(r.ok).toBe(false);
      if (r.ok) return;
      expect(r.code).toBe("STEP_UP_REQUIRED");
      expect(r.status).toBe(403);
      expect(r.stepUp?.scope).toBe("role:change");
    });

    it(`blocks switching into "${role}" with an expired token`, async () => {
      const expired = `mock-stepup.${toWebRole(role)}.${Math.floor(Date.now() / 1000) - 10}`;
      const r = await decideActiveRoleSwitch({
        session,
        body: { role },
        getHeader: headersWith({ "x-step-up-token": expired }),
      });
      expect(r.ok === false && r.code).toBe("STEP_UP_REQUIRED");
    });

    it(`blocks switching into "${role}" with a token minted for a different role`, async () => {
      // Pick another step-up role distinct from `role`.
      const other = (ROLES as readonly NavRole[]).find(
        (r) => r !== role && ROLE_META[r].requiresStepUp,
      )!;
      const wrong = buildMockStepUpToken(other);
      const r = await decideActiveRoleSwitch({
        session,
        body: { role },
        getHeader: headersWith({ "x-step-up-token": wrong }),
      });
      expect(r.ok === false && r.code).toBe("STEP_UP_REQUIRED");
    });

    it(`allows switching into "${role}" with a freshly-minted token`, async () => {
      const token = buildMockStepUpToken(role);
      const r = await decideActiveRoleSwitch({
        session,
        body: { role },
        getHeader: headersWith({ "x-step-up-token": token }),
      });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.payload.activeRole).toBe(role);
    });
  }
});

describe("Phase 5 — non-step-up roles still switch without a token", () => {
  const allHeld = (ROLES as readonly NavRole[]).map(toWebRole);
  for (const role of ROLES as readonly NavRole[]) {
    if (ROLE_META[role].requiresStepUp) continue;
    it(`"${role}" switches without any x-step-up-token`, async () => {
      // Start a learner-active session: the non-step-up role we're
      // exercising is already the active role, so the "switch into X"
      // is the trivial no-op path that we still want to verify accepts
      // without a token.
      const learnerSession = multiRoleSession(toWebRole(role), allHeld);
      const r = await decideActiveRoleSwitch({
        session: learnerSession,
        body: { role },
        getHeader: headersWith({}),
      });
      expect(r.ok).toBe(true);
    });
  }
});
