/**
 * Brain-profile BFF — least-privilege contract (Sprint C-02).
 *
 * The full brain profile carries `disabilitySignals` and the parent's
 * private `parentAssessmentSummary`, so the route is parent-only: a
 * teacher (or school_admin) session gets FORBIDDEN_ROLE and can never
 * read disability signals here, and a parent of a *different* learner is
 * stopped by `requireLearnerScope`. Also pins the missing-`await` fix —
 * the 200 body must be a real profile object (a serialized Promise would
 * be `{}`), and an unknown learner reaches the NOT_FOUND branch.
 *
 * The route handler lives under `app/` (which vitest does not collect),
 * so this lib-level test imports it via the `@/app/...` alias. The
 * session layer is mocked; the real guards, consent guard, and repos run
 * against the seeded in-memory store (lrn_demo_clone is owned by
 * u_parent_1 and has a cloned brain profile — see lib/db/seed.ts).
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const TENANT = "t_demo";
const PARENT = "u_parent_1"; // MOCK_USERS.parent.userId — owns the seeded learners
const CLONE_LEARNER = "lrn_demo_clone"; // seeded with a cloned brain profile

let currentSession: SessionProfile | null = null;

function asSession(partial: Partial<SessionProfile>): SessionProfile {
  return {
    userId: PARENT,
    tenantId: TENANT,
    role: "parent",
    email: "parent@demo.aivo",
    displayName: "Demo Parent",
    permissions: [],
    ...partial,
  } as SessionProfile;
}

vi.mock("@/lib/auth/session", () => ({
  getRequestSession: vi.fn(async () => currentSession),
  getSession: vi.fn(async () => currentSession),
}));

import { GET } from "@/app/api/bff/learners/[learnerId]/brain-profile/route";
import { ensureSeeded } from "@/lib/db/seed";
import { getStore, resetStore } from "@/lib/db/store";
import { resetPersistence } from "@/lib/db/persistence";
import { listChildProfileDisclosures } from "@/lib/db/repos";

function req(learnerId: string): Request {
  return new Request(`http://localhost/api/bff/learners/${learnerId}/brain-profile`, {
    method: "GET",
    headers: { "x-request-id": "req_test" },
  });
}

function params(learnerId: string) {
  return { params: Promise.resolve({ learnerId }) };
}

describe("brain-profile BFF route", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
    currentSession = null;
  });

  it("rejects unauthenticated callers", async () => {
    const res = await GET(req(CLONE_LEARNER), params(CLONE_LEARNER));
    expect(res.status).toBe(401);
  });

  it("forbids a teacher — disabilitySignals never leave the route", async () => {
    currentSession = asSession({ userId: "u_teacher_1", role: "teacher" });
    const res = await GET(req(CLONE_LEARNER), params(CLONE_LEARNER));
    expect(res.status).toBe(403);
    const body = await res.text();
    expect(JSON.parse(body).error.code).toBe("FORBIDDEN_ROLE");
    expect(body).not.toContain("disabilitySignals");
    expect(body).not.toContain("parentAssessmentSummary");
  });

  it("forbids a school_admin (previously over-permitted role)", async () => {
    currentSession = asSession({ userId: "u_admin_1", role: "school_admin" });
    const res = await GET(req(CLONE_LEARNER), params(CLONE_LEARNER));
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("FORBIDDEN_ROLE");
  });

  it("returns the real (awaited) profile to the learner's parent", async () => {
    currentSession = asSession({});
    const res = await GET(req(CLONE_LEARNER), params(CLONE_LEARNER));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: {
        brainProfile: {
          learnerId: string;
          cloneStage: string;
          state: { disabilitySignals: unknown };
        };
      };
    };
    expect(json.ok).toBe(true);
    // A serialized Promise (the pre-fix bug) would be `{}` — assert real fields.
    expect(json.data.brainProfile.learnerId).toBe(CLONE_LEARNER);
    expect(json.data.brainProfile.cloneStage).toBe("cloned");
    expect(json.data.brainProfile.state.disabilitySignals).toBeDefined();
  });

  it("C-12 (ADR 0042): a successful read writes a FERPA disclosure row", async () => {
    currentSession = asSession({});
    expect(await listChildProfileDisclosures(CLONE_LEARNER, TENANT)).toHaveLength(0);
    const res = await GET(req(CLONE_LEARNER), params(CLONE_LEARNER));
    expect(res.status).toBe(200);
    const rows = await listChildProfileDisclosures(CLONE_LEARNER, TENANT);
    expect(rows).toHaveLength(1);
    expect(rows[0].readerUserId).toBe(PARENT);
    expect(rows[0].readerRole).toBe("parent");
    expect(rows[0].dataClass).toBe("brain_profile_full");
    expect(rows[0].surface).toContain("brain-profile");
  });

  it("C-12 (ADR 0042): a refused read (wrong parent) writes NO disclosure row", async () => {
    currentSession = asSession({ userId: "u_parent_2" });
    const res = await GET(req(CLONE_LEARNER), params(CLONE_LEARNER));
    expect(res.status).toBe(403);
    // The read never returned data, so nothing was disclosed.
    expect(await listChildProfileDisclosures(CLONE_LEARNER, TENANT)).toHaveLength(0);
  });

  it("blocks a parent of a different learner via requireLearnerScope", async () => {
    currentSession = asSession({ userId: "u_parent_2" });
    const res = await GET(req(CLONE_LEARNER), params(CLONE_LEARNER));
    expect(res.status).toBe(403);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("FORBIDDEN_LEARNER");
  });

  it("404s when the parent's learner has no generated profile yet", async () => {
    // Before the await fix the NOT_FOUND branch was unreachable: the
    // un-awaited Promise was always truthy and the route returned 200
    // with a serialized `{}`. Remove the seeded profile to pin the branch.
    getStore().brainProfiles.delete("brp_demo_clone");
    currentSession = asSession({});
    const res = await GET(req(CLONE_LEARNER), params(CLONE_LEARNER));
    expect(res.status).toBe(404);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("NOT_FOUND");
  });
});
