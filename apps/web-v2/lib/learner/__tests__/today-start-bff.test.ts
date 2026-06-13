/**
 * Sprint C-01 — POST /today/start surfaces the teach gate as a typed
 * `brain_not_approved` PRECONDITION_FAILED, and an approved learner gets a
 * real run.
 *
 * The route handler lives under `app/` (which vitest does not collect), so
 * this lib-level test imports it via the `@/app/...` alias — same pattern as
 * `calm-bff.test.ts`. Auth/guard/rate-limit/consent layers are mocked; the
 * picker, gate, generator, and persistence run for real against a fresh
 * in-memory store.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const TENANT = "t_demo";
const PARENT = "u_demo_parent";

const parentSession: SessionProfile = {
  userId: PARENT,
  tenantId: TENANT,
  role: "parent",
  email: "parent@demo.aivo",
  displayName: "Riley Parent",
  permissions: [],
};

const auditMock = vi.fn();

vi.mock("@/lib/bff/guards", () => ({
  requireSession: vi.fn(async () => ({ session: parentSession, response: null })),
  requireRole: vi.fn(() => null),
  requireLearnerScope: vi.fn(async () => null),
}));
vi.mock("@/lib/bff/audit", () => ({
  audit: (...args: unknown[]) => auditMock(...args),
}));
vi.mock("@/lib/bff/rate-limit", () => ({
  checkRateLimit: vi.fn(() => null),
  RATE_LIMITS: { AI_GENERATION: { limit: 30, windowMs: 60_000 } },
}));
vi.mock("@/lib/bff/consent-guard", () => ({
  requireLearnerConsent: vi.fn(async () => null),
}));

import { POST } from "@/app/api/bff/learners/[learnerId]/today/start/route";
import { ensureSeeded } from "@/lib/db/seed";
import { newId, nowIso, resetStore } from "@/lib/db/store";
import { getPersistence, resetPersistence } from "@/lib/db/persistence";
import {
  approveBrainClone,
  cloneBrainFromBaseline,
  createLearner,
} from "@/lib/db/repos";
import type { BaselineAssessment } from "@/lib/db/types";

function postReq(learnerId: string): Request {
  return new Request(`http://localhost/api/bff/learners/${learnerId}/today/start`, {
    method: "POST",
    headers: { "x-request-id": "req_test" },
  });
}

function params(learnerId: string) {
  return { params: Promise.resolve({ learnerId }) };
}

/** Learner with a completed baseline and a freshly cloned (unapproved) brain. */
async function setupClonedLearner(): Promise<string> {
  const learner = await createLearner({
    tenantId: TENANT,
    parentUserId: PARENT,
    data: { firstName: "Gate", birthYear: 2016 },
  });
  await getPersistence().assessments.upsertBaseline({
    id: `bas_${learner.id}`,
    learnerId: learner.id,
    tenantId: TENANT,
    createdAt: "2026-01-01T00:00:00.000Z",
    status: "complete",
    summary: { totalAnswered: 5 },
  } as unknown as BaselineAssessment);
  const cloned = await cloneBrainFromBaseline(learner.id, TENANT);
  expect(cloned?.cloneStage).toBe("cloned");
  return learner.id;
}

/** Mastery map + a one-node learning path so the picker has a mission. */
async function seedPath(learnerId: string): Promise<void> {
  const curriculum = getPersistence().curriculum;
  const math = (await curriculum.listSubjects()).find((s) => s.slug === "math");
  expect(math, "seed must include a math subject").toBeTruthy();
  const skill = (await curriculum.listSkills(math!.id))[0];
  const now = nowIso();
  await curriculum.upsertMasteryMap({
    id: newId("mmap"),
    learnerId,
    tenantId: TENANT,
    generatedAt: now,
    updatedAt: now,
  });
  await curriculum.replaceLearningPath(learnerId, TENANT, {
    id: newId("lp"),
    learnerId,
    tenantId: TENANT,
    generatedAt: now,
    basedOnMasteryMapId: null,
    nodes: [
      {
        id: newId("lpn"),
        order: 0,
        subjectId: math!.id,
        skillId: skill.id,
        kind: "first_skill",
        reason: "baseline follow-up",
        estimatedMinutes: 10,
      },
    ],
  });
}

describe("POST /today/start — brain-approval gate", () => {
  beforeEach(() => {
    resetStore();
    ensureSeeded();
    resetPersistence();
    auditMock.mockClear();
  });

  it("blocked: unapproved brain → 412 with typed code brain_not_approved", async () => {
    const learnerId = await setupClonedLearner();
    await seedPath(learnerId);

    const res = await POST(postReq(learnerId), params(learnerId));
    expect(res.status).toBe(412);
    const json = (await res.json()) as { ok: boolean; error: { code: string } };
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("brain_not_approved");
    expect(auditMock).not.toHaveBeenCalled();
  });

  it("approved: same learner → 200 with a generated run", async () => {
    const learnerId = await setupClonedLearner();
    await seedPath(learnerId);
    await approveBrainClone(learnerId, TENANT);

    const res = await POST(postReq(learnerId), params(learnerId));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      ok: boolean;
      data: { lessonRun: { id: string; status: string }; resumed: boolean };
    };
    expect(json.ok).toBe(true);
    expect(json.data.resumed).toBe(false);
    expect(json.data.lessonRun.status).toBe("ready");
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][1]).toBe("today.start");
  });
});
