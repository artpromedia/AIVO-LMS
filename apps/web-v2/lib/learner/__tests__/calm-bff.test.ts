/**
 * Calm Corner BFF — POST persists a record AND emits the audit event, an
 * unknown activityId is rejected (Phase 1 behaviour), and GET surfaces the
 * learner's streak.
 *
 * The route handler lives under `app/` (which vitest does not collect), so
 * this lib-level test imports it via the `@/app/...` alias. The auth/guard
 * layer and feature flags are mocked; the repo + calm catalog run for real
 * against a fresh in-memory store.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import type { SessionProfile } from "@/lib/auth/types";

const LEARNER = "lrn_demo_sky";
const TENANT = "t_demo";

const learnerSession: SessionProfile = {
  userId: "u_learner_1",
  tenantId: TENANT,
  role: "learner",
  email: "learner@demo.aivo",
  displayName: "Sky",
  permissions: [],
  learnerId: LEARNER,
};

const auditMock = vi.fn();
const flags = { selfRegulationHub: false };

vi.mock("@/lib/bff/guards", () => ({
  requireSession: vi.fn(async () => ({ session: learnerSession, response: null })),
  requireRole: vi.fn(() => null),
  requireLearnerScope: vi.fn(async () => null),
}));
vi.mock("@/lib/bff/audit", () => ({
  audit: (...args: unknown[]) => auditMock(...args),
}));
vi.mock("@/lib/bff/rate-limit", () => ({
  checkRateLimit: vi.fn(() => null),
  RATE_LIMITS: { WRITE_DEFAULT: { limit: 30, windowMs: 60_000 } },
}));
vi.mock("@aivo/feature-flags", () => ({
  resolveEnterpriseFlags: () => flags,
}));

import { GET, POST } from "@/app/api/bff/learners/[learnerId]/calm/route";
import { resetStore } from "@/lib/db/store";
import { listCalmSessionsForLearner } from "@/lib/db/repos";

function postReq(body: unknown): Request {
  return new Request(`http://localhost/api/bff/learners/${LEARNER}/calm`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-request-id": "req_test" },
    body: JSON.stringify(body),
  });
}

const params = { params: Promise.resolve({ learnerId: LEARNER }) };

describe("calm BFF route", () => {
  beforeEach(() => {
    resetStore();
    auditMock.mockClear();
    flags.selfRegulationHub = false;
  });

  it("POST persists a record AND emits the audit event", async () => {
    const res = await POST(postReq({ activityId: "box_breathing", secondsSpent: 42 }), params);
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ok: boolean; data: { affirmationKey: string } };
    expect(json.ok).toBe(true);
    expect(json.data.affirmationKey).toBe("calmer");

    // Audit event preserved from Phase 1.
    expect(auditMock).toHaveBeenCalledTimes(1);
    expect(auditMock.mock.calls[0][1]).toBe("calm.session.complete");

    // New: a queryable record was persisted, tenant/learner-scoped.
    const records = await listCalmSessionsForLearner(LEARNER, TENANT);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      activityId: "box_breathing",
      activityKind: "breathing",
      completed: true,
      secondsSpent: 42,
    });
  });

  it("POST defaults completed to true and clamps seconds", async () => {
    await POST(postReq({ activityId: "stretch_break", secondsSpent: 99999 }), params);
    const [record] = await listCalmSessionsForLearner(LEARNER, TENANT);
    expect(record.completed).toBe(true);
    expect(record.secondsSpent).toBe(3600);
  });

  it("POST with an unknown activityId still 400s and persists nothing", async () => {
    const res = await POST(postReq({ activityId: "not_a_real_activity" }), params);
    expect(res.status).toBe(400);
    expect(auditMock).not.toHaveBeenCalled();
    expect(await listCalmSessionsForLearner(LEARNER, TENANT)).toHaveLength(0);
  });

  it("GET returns the catalog plus the learner's streak", async () => {
    await POST(postReq({ activityId: "box_breathing" }), params);

    const res = await GET(
      new Request(`http://localhost/api/bff/learners/${LEARNER}/calm`),
      params,
    );
    const json = (await res.json()) as {
      data: { catalog: unknown[]; streak: { currentStreakDays: number } | null };
    };
    expect(Array.isArray(json.data.catalog)).toBe(true);
    expect(json.data.streak?.currentStreakDays).toBe(1);
  });
});
