/**
 * Durable-effect writes for APPLIED recommendations (Sprint 4): the
 * delivery-level target resolution + the learners/brain_states/
 * learner_profiles writes, exercised against a recording fake of the
 * Drizzle handle (assessment-svc test convention — no Postgres needed for
 * the policy; the SQL shapes are pinned by the recorded calls).
 */
import { describe, expect, it, vi } from "vitest";
import {
  persistAppliedRecommendation,
  resolveDeliveryLevelTarget,
} from "../services/apply-persistence.js";
import type { ProfileRecommendation } from "../services/types.js";

const log = { info: vi.fn(), warn: vi.fn() };

function rec(
  type: ProfileRecommendation["type"],
  proposedValue: unknown,
  amendedValue?: unknown,
): ProfileRecommendation {
  const now = new Date().toISOString();
  return {
    id: "rec-1",
    learnerId: "lrn-1",
    type,
    title: "t",
    parentSummary: "s",
    currentValue: null,
    proposedValue,
    amendedValue,
    confidence: 0.8,
    evidence: [],
    safety: {
      requiresParentApproval: true,
      affectsIEP: false,
      affectsInstructionalAccess: true,
      reversible: true,
    },
    status: "APPROVED",
    createdAt: now,
    updatedAt: now,
  };
}

/** Recording fake: select returns the learner row; updates capture set(). */
function fakeDb(opts: { learner?: { id: string; curriculumAlignment: unknown } | null; profileRows?: number }) {
  const updates: Array<{ set: Record<string, unknown> }> = [];
  const db = {
    select: () => ({
      from: () => ({
        where: async () => (opts.learner === null ? [] : [opts.learner]),
      }),
    }),
    update: () => ({
      set: (values: Record<string, unknown>) => {
        const call = { set: values };
        updates.push(call);
        const chain = {
          where: () => ({
            returning: async () =>
              Array.from({ length: opts.profileRows ?? 1 }, (_, i) => ({ id: `p${i}` })),
            then: undefined,
          }),
        };
        // Allow `await ...where(...)` (no returning) too.
        (chain.where as unknown as { [k: string]: unknown }).valueOf = undefined;
        return {
          where: (..._args: unknown[]) => {
            const res = {
              returning: async () =>
                Array.from({ length: opts.profileRows ?? 1 }, (_, i) => ({ id: `p${i}` })),
            };
            return Object.assign(Promise.resolve(undefined), res);
          },
        };
      },
    }),
  };
  return { db, updates };
}

describe("resolveDeliveryLevelTarget", () => {
  const alignment = { grade_band: "5", delivery_level: "3" };

  it("resolves an upward proposal object", () => {
    expect(resolveDeliveryLevelTarget({ subjectId: "s", from: "3", to: "4" }, alignment)).toBe("4");
  });

  it('resolves the legacy "lower" proposal one band down, clamped at K', () => {
    expect(resolveDeliveryLevelTarget("lower", alignment)).toBe("2");
    expect(resolveDeliveryLevelTarget("lower", { grade_band: "1", delivery_level: "K" })).toBe("K");
  });

  it("clamps an over-grade target to the enrolled band", () => {
    expect(resolveDeliveryLevelTarget({ to: "8" }, alignment)).toBe("5");
  });

  it("resolves a literal band string and rejects garbage", () => {
    expect(resolveDeliveryLevelTarget("4", alignment)).toBe("4");
    expect(resolveDeliveryLevelTarget("sideways", alignment)).toBeNull();
    expect(resolveDeliveryLevelTarget(undefined, alignment)).toBeNull();
  });
});

describe("persistAppliedRecommendation", () => {
  it("writes the resolved delivery level to learners + brain state", async () => {
    const { db, updates } = fakeDb({
      learner: { id: "lrn-1", curriculumAlignment: { grade_band: "5", delivery_level: "3" } },
    });
    const out = await persistAppliedRecommendation(
      db as never,
      log,
      rec("delivery_level_change", { subjectId: "s", from: "3", to: "4" }),
    );
    expect(out).toEqual({ ok: true, details: { deliveryLevel: "4", subjectKey: null } });
    // Two updates: learners row, then latest brain_states row.
    expect(updates).toHaveLength(2);
    const learnerAlignment = updates[0]!.set.curriculumAlignment as Record<string, unknown>;
    expect(learnerAlignment.delivery_level).toBe("4");
    expect(learnerAlignment.delivery_level_source).toBe("parent_approved_recommendation");
    expect(learnerAlignment.grade_band).toBe("5");
  });

  it("prefers the amended value over the proposed one", async () => {
    const { db, updates } = fakeDb({
      learner: { id: "lrn-1", curriculumAlignment: { grade_band: "5", delivery_level: "3" } },
    });
    await persistAppliedRecommendation(
      db as never,
      log,
      rec("delivery_level_change", { to: "4" }, { to: "5" }),
    );
    expect((updates[0]!.set.curriculumAlignment as Record<string, unknown>).delivery_level).toBe(
      "5",
    );
  });

  it("fails (not silently applies) when the learner is missing", async () => {
    const { db } = fakeDb({ learner: null });
    const out = await persistAppliedRecommendation(
      db as never,
      log,
      rec("delivery_level_change", { to: "4" }),
    );
    expect(out).toEqual({ ok: false, reason: "learner_not_found" });
  });

  it("fails when the target band is unresolvable", async () => {
    const { db } = fakeDb({ learner: { id: "lrn-1", curriculumAlignment: {} } });
    const out = await persistAppliedRecommendation(
      db as never,
      log,
      rec("delivery_level_change", "sideways"),
    );
    expect(out).toEqual({ ok: false, reason: "delivery_level_target_unresolvable" });
  });

  it("stamps the rebaseline marker and fails when no profile exists", async () => {
    const withProfile = fakeDb({ learner: { id: "lrn-1", curriculumAlignment: {} }, profileRows: 1 });
    expect(
      await persistAppliedRecommendation(
        withProfile.db as never,
        log,
        rec("rebaseline_request", { reason: "baseline_age" }),
      ),
    ).toEqual({ ok: true });

    const noProfile = fakeDb({ learner: { id: "lrn-1", curriculumAlignment: {} }, profileRows: 0 });
    expect(
      await persistAppliedRecommendation(
        noProfile.db as never,
        log,
        rec("rebaseline_request", { reason: "baseline_age" }),
      ),
    ).toEqual({ ok: false, reason: "no_learner_profile_to_rebaseline" });
  });

  it("is a no-op success for profile-only types", async () => {
    const { db, updates } = fakeDb({ learner: { id: "lrn-1", curriculumAlignment: {} } });
    const out = await persistAppliedRecommendation(
      db as never,
      log,
      rec("accommodation_add", "extended_time"),
    );
    expect(out).toEqual({ ok: true });
    expect(updates).toHaveLength(0);
  });
});

// ── Wave C (G1): subject-scoped applies ─────────────────────────────────────

describe("per-subject delivery_level_change (Wave C)", () => {
  it("writes ONLY the subject's band and leaves the global delivery_level untouched", async () => {
    const { db, updates } = fakeDb({
      learner: {
        id: "lrn-1",
        curriculumAlignment: {
          grade_band: "5",
          delivery_level: "3",
          delivery_levels: { math: "2", reading: "5" },
        },
      },
    });
    const outcome = await persistAppliedRecommendation(
      db as never,
      log,
      rec("delivery_level_change", { subjectId: "sub-math", subjectKey: "math", from: "2", to: "3" }),
    );
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.details?.subjectKey).toBe("math");
    expect(outcome.details?.deliveryLevel).toBe("3");

    const learnerSet = updates[0]!.set as {
      curriculumAlignment: Record<string, unknown>;
    };
    const alignment = learnerSet.curriculumAlignment;
    // Subject map raised, other subjects + the global level preserved.
    expect(alignment.delivery_levels).toEqual({ math: "3", reading: "5" });
    expect(alignment.delivery_level).toBe("3");
    expect(
      (alignment.delivery_levels_source_by_subject as Record<string, unknown>).math,
    ).toBe("parent_approved_recommendation");
  });

  it("resolves the clamp from the SUBJECT's current band, not the global one", () => {
    const target = resolveDeliveryLevelTarget("lower", {
      grade_band: "5",
      delivery_level: "5",
      delivery_levels: { math: "3" },
    });
    // No subjectKey on a plain string proposal → global current ("5") - 1.
    expect(target).toBe("4");
    const subjectTarget = resolveDeliveryLevelTarget(
      { subjectKey: "math", to: "9" },
      { grade_band: "5", delivery_levels: { math: "3" } },
    );
    // Target above the enrolled band clamps to the grade band.
    expect(subjectTarget).toBe("5");
  });

  it("keeps the legacy global write for proposals without a subjectKey", async () => {
    const { db, updates } = fakeDb({
      learner: {
        id: "lrn-1",
        curriculumAlignment: { grade_band: "5", delivery_level: "3" },
      },
    });
    const outcome = await persistAppliedRecommendation(
      db as never,
      log,
      rec("delivery_level_change", { subjectId: "sub-math", from: "3", to: "4" }),
    );
    expect(outcome.ok).toBe(true);
    const alignment = (updates[0]!.set as { curriculumAlignment: Record<string, unknown> })
      .curriculumAlignment;
    expect(alignment.delivery_level).toBe("4");
    expect(alignment.delivery_levels).toBeUndefined();
  });
});
