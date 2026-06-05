/**
 * Phase 5 — Data isolation review.
 *
 * ADR 0020 §4 and Phase 5 ("Hardening & policy") require that BFF
 * authorization keys off the server-authoritative `session.role` (the
 * *active* role), not just `session.roles` (the set of roles the user
 * is entitled to act as). The client-side role switcher must never be
 * the only gate — a request landing at a BFF route handler with an
 * active role of `learner` must be rejected by `requireRole(["parent"])`
 * even when the same user also holds the `parent` role.
 *
 * These tests pin the `requireRole` and `requireLearnerScope` guards
 * against the active-role contract so a future "convenience" refactor
 * that accepts `roles.includes(...)` instead of `role === ...` will
 * fail loudly in CI.
 */
import { describe, expect, it } from "vitest";
import { requireRole, requireLearnerScope } from "@/lib/bff/guards";
import type { SessionProfile } from "@/lib/auth/types";

function session(overrides: Partial<SessionProfile>): SessionProfile {
  return {
    userId: "u_phase5",
    tenantId: "t_phase5",
    role: "learner",
    email: "phase5@demo.aivo",
    displayName: "Phase 5",
    permissions: [],
    learnerId: "lrn_phase5",
    ...overrides,
  };
}

describe("Phase 5 data isolation — requireRole keys off active role", () => {
  it("allows when session.role matches one of the required roles", () => {
    const err = requireRole(session({ role: "parent" }), ["parent"], "req_1");
    expect(err).toBeNull();
  });

  it("rejects when session.role is not in the required roles (even if held)", () => {
    // Defense in depth: holding `parent` in `roles[]` must NOT grant
    // access while the active role is something else. The server is the
    // only authority on what the user is currently acting as.
    const dualRoleAsLearner = session({
      role: "learner",
      roles: ["learner", "parent"],
    });
    const err = requireRole(dualRoleAsLearner, ["parent"], "req_2");
    expect(err).not.toBeNull();
    expect(err!.status).toBe(403);
  });

  it("rejects when none of the required roles match the active role", () => {
    const err = requireRole(session({ role: "teacher" }), ["parent", "platform_admin"], "req_3");
    expect(err).not.toBeNull();
    expect(err!.status).toBe(403);
  });
});

describe("Phase 5 data isolation — requireLearnerScope enforces self/parent-link", () => {
  it("blocks a learner from accessing a learnerId that is not their own", async () => {
    const err = await requireLearnerScope(
      session({ role: "learner", learnerId: "lrn_phase5" }),
      "lrn_someone_else",
      "req_4",
    );
    expect(err).not.toBeNull();
    expect(err!.status).toBe(403);
  });

  it("allows a learner to access their own learnerId", async () => {
    const err = await requireLearnerScope(
      session({ role: "learner", learnerId: "lrn_phase5" }),
      "lrn_phase5",
      "req_5",
    );
    expect(err).toBeNull();
  });
});
