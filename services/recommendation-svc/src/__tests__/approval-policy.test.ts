/**
 * Wave C (G5) — approval delegation enforcement.
 *
 * Three layers under test:
 *   1. requireApprovalPermission: the role × type × tenant-policy gate.
 *   2. normalizeApprovalPolicy / loadApprovalPolicy: fail-safe policy
 *      loading (any miss → parent-only).
 *   3. The decision ROUTES: a teacher accept 403s in a parent-only tenant
 *      and lands in a delegated one — proven against the real Fastify app.
 */
import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requireApprovalPermission,
  RecommendationPolicyError,
} from "../services/recommendation-policy.js";
import { normalizeApprovalPolicy } from "../services/approval-policy.js";
import {
  registerRecommendationRoutes,
  clearRecommendationStoreForTest,
  seedRecommendationForTest,
} from "../routes/recommendations.js";
import type { ProfileRecommendation } from "../services/types.js";

const DELEGATED = { teacherApproval: true, caregiverApproval: true };

function rec(
  type: ProfileRecommendation["type"],
  overrides: Partial<ProfileRecommendation> = {},
): ProfileRecommendation {
  const now = new Date().toISOString();
  return {
    id: "rec-pol-1",
    learnerId: "lrn-pol-1",
    type,
    title: "t",
    parentSummary: "s",
    currentValue: "3",
    proposedValue: { subjectKey: "math", from: "3", to: "4" },
    confidence: 0.8,
    evidence: [],
    safety: {
      requiresParentApproval: true,
      affectsIEP: false,
      affectsInstructionalAccess: true,
      reversible: true,
    },
    status: "PENDING",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

afterEach(() => {
  clearRecommendationStoreForTest();
  vi.restoreAllMocks();
});

describe("requireApprovalPermission", () => {
  it("parent passes without any policy", () => {
    expect(() =>
      requireApprovalPermission("parent", rec("delivery_level_change")),
    ).not.toThrow();
  });

  it("teacher passes for an instructional type under a delegated policy", () => {
    expect(() =>
      requireApprovalPermission("teacher", rec("delivery_level_change"), DELEGATED),
    ).not.toThrow();
  });

  it("teacher 403s without delegation, and ALWAYS on affectsIEP", () => {
    expect(() => requireApprovalPermission("teacher", rec("delivery_level_change"))).toThrow(
      RecommendationPolicyError,
    );
    expect(() =>
      requireApprovalPermission(
        "teacher",
        rec("delivery_level_change", {
          safety: {
            requiresParentApproval: true,
            affectsIEP: true,
            affectsInstructionalAccess: true,
            reversible: true,
          },
        }),
        DELEGATED,
      ),
    ).toThrow(RecommendationPolicyError);
  });

  it("caregiver is limited to regulation/sensory types even when delegated", () => {
    expect(() =>
      requireApprovalPermission("caregiver", rec("sensory_setting_change"), DELEGATED),
    ).not.toThrow();
    expect(() =>
      requireApprovalPermission("caregiver", rec("delivery_level_change"), DELEGATED),
    ).toThrow(RecommendationPolicyError);
  });
});

describe("normalizeApprovalPolicy", () => {
  it("defaults to parent-only on any malformed input and never widens on truthy strings", () => {
    expect(normalizeApprovalPolicy(null)).toEqual({
      teacherApproval: false,
      caregiverApproval: false,
    });
    expect(normalizeApprovalPolicy("yes")).toEqual({
      teacherApproval: false,
      caregiverApproval: false,
    });
    expect(normalizeApprovalPolicy({ teacherApproval: "true" })).toEqual({
      teacherApproval: false,
      caregiverApproval: false,
    });
    expect(normalizeApprovalPolicy({ teacherApproval: true })).toEqual({
      teacherApproval: true,
      caregiverApproval: false,
    });
  });
});

describe("decision routes enforce the tenant policy end-to-end", () => {
  /** Drizzle-shaped fake: learners → tenant, district_settings → policy. */
  function fakeDb(policy: unknown) {
    let call = 0;
    return {
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => {
              call += 1;
              // 1st select per decision = learners row, 2nd = district_settings.
              if (call % 2 === 1) return [{ tenantId: "tenant-pol-1" }];
              return [{ approvalPolicy: policy }];
            },
          }),
        }),
      }),
      // The apply path is exercised elsewhere; this fake only serves the
      // policy loader, so updates resolve as no-ops with returning().
      update: () => ({
        set: () => ({
          where: () => Object.assign(Promise.resolve(undefined), {
            returning: async () => [{ id: "p1" }],
          }),
        }),
      }),
    };
  }

  async function postAccept(db: unknown, actorRole: string) {
    const app = Fastify({ logger: false });
    registerRecommendationRoutes(app, { db: db as never });
    await app.ready();
    seedRecommendationForTest(rec("delivery_level_change"));
    const res = await app.inject({
      method: "POST",
      url: "/api/recommendations/rec-pol-1/accept",
      payload: { actorRole },
    });
    await app.close();
    return res;
  }

  it("teacher accept 403s in a parent-only tenant", async () => {
    const res = await postAccept(fakeDb({ teacherApproval: false, caregiverApproval: false }), "teacher");
    expect(res.statusCode).toBe(403);
    expect(res.json().error).toBe("approval_role_not_allowed");
  });

  it("teacher accept lands in a delegated tenant", async () => {
    const res = await postAccept(fakeDb({ teacherApproval: true, caregiverApproval: false }), "teacher");
    expect(res.statusCode).toBe(200);
    expect(["APPLIED", "FAILED"]).toContain(res.json().recommendation.status);
    // The 403 path is what this suite pins; the apply outcome itself is
    // covered by apply-persistence tests against a richer db fake.
  });

  it("parent accept is unaffected by the delegation policy", async () => {
    const res = await postAccept(fakeDb({ teacherApproval: false, caregiverApproval: false }), "parent");
    expect(res.statusCode).toBe(200);
  });
});
