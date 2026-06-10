/**
 * Fire / don't-fire matrices for the Sprint 4 progression rules: upward
 * delivery_level_change and rebaseline_request, plus PENDING dedup.
 */
import { describe, expect, it } from "vitest";
import type { LearnerSignal } from "../services/recommendation-evidence-builder.js";
import type { GenerateCandidatesInput } from "../services/recommendation-generator.js";
import type { ProfileRecommendation } from "../services/types.js";
import {
  REBASELINE_MAX_AGE_DAYS,
  buildRebaselineCandidate,
  buildUpwardDeliveryCandidates,
  dedupeAgainstPending,
} from "../services/progression-candidates.js";

const DAY_MS = 86_400_000;

function masterySignal(opts: {
  skillId: string;
  subjectId?: string;
  after?: number;
  before?: number;
  levelBefore?: string;
  levelAfter?: string;
  confidence?: number;
}): LearnerSignal {
  return {
    source: "lesson",
    metric: "mastery_signal",
    value: opts.after ?? 0.7,
    summary: `mastery ${opts.skillId}`,
    metadata: {
      skillId: opts.skillId,
      subjectId: opts.subjectId ?? "sub-math",
      before: opts.before ?? 0.5,
      after: opts.after ?? 0.7,
      levelBefore: opts.levelBefore ?? "approaching",
      levelAfter: opts.levelAfter ?? "on_grade_level",
      confidence: opts.confidence ?? 0.7,
    },
  };
}

function input(
  signals: LearnerSignal[],
  profile: GenerateCandidatesInput["currentProfile"] = {},
): GenerateCandidatesInput {
  return { learnerId: "lrn-1", signals, currentProfile: profile };
}

describe("buildUpwardDeliveryCandidates", () => {
  const belowGrade = { deliveryLevel: "3", gradeBand: "5" };

  it("fires with >=3 distinct on-grade skills in one subject below grade band", () => {
    const recs = buildUpwardDeliveryCandidates(
      input(
        [masterySignal({ skillId: "a" }), masterySignal({ skillId: "b" }), masterySignal({ skillId: "c" })],
        belowGrade,
      ),
    );
    expect(recs).toHaveLength(1);
    expect(recs[0]!.type).toBe("delivery_level_change");
    expect(recs[0]!.proposedValue).toEqual({ subjectId: "sub-math", from: "3", to: "4" });
    expect(recs[0]!.safety.requiresParentApproval).toBe(true);
    expect(recs[0]!.safety.reversible).toBe(true);
    expect(recs[0]!.status).toBe("PENDING");
  });

  it("does not fire with only 2 distinct skills (3rd is a repeat)", () => {
    const recs = buildUpwardDeliveryCandidates(
      input(
        [masterySignal({ skillId: "a" }), masterySignal({ skillId: "b" }), masterySignal({ skillId: "a" })],
        belowGrade,
      ),
    );
    expect(recs).toHaveLength(0);
  });

  it("does not fire below the score threshold", () => {
    const recs = buildUpwardDeliveryCandidates(
      input(
        [
          masterySignal({ skillId: "a", after: 0.64, levelAfter: "approaching" }),
          masterySignal({ skillId: "b" }),
          masterySignal({ skillId: "c" }),
        ],
        belowGrade,
      ),
    );
    expect(recs).toHaveLength(0);
  });

  it("does not fire below the confidence threshold", () => {
    const recs = buildUpwardDeliveryCandidates(
      input(
        [
          masterySignal({ skillId: "a", confidence: 0.59 }),
          masterySignal({ skillId: "b" }),
          masterySignal({ skillId: "c" }),
        ],
        belowGrade,
      ),
    );
    expect(recs).toHaveLength(0);
  });

  it("does not fire when delivery level is already at the grade band", () => {
    const recs = buildUpwardDeliveryCandidates(
      input(
        [masterySignal({ skillId: "a" }), masterySignal({ skillId: "b" }), masterySignal({ skillId: "c" })],
        { deliveryLevel: "5", gradeBand: "5" },
      ),
    );
    expect(recs).toHaveLength(0);
  });

  it("never proposes a band above the enrolled grade", () => {
    const recs = buildUpwardDeliveryCandidates(
      input(
        [masterySignal({ skillId: "a" }), masterySignal({ skillId: "b" }), masterySignal({ skillId: "c" })],
        { deliveryLevel: "4", gradeBand: "5" },
      ),
    );
    expect(recs[0]!.proposedValue).toEqual({ subjectId: "sub-math", from: "4", to: "5" });
  });

  it("emits one candidate per qualifying subject", () => {
    const recs = buildUpwardDeliveryCandidates(
      input(
        [
          masterySignal({ skillId: "a", subjectId: "sub-math" }),
          masterySignal({ skillId: "b", subjectId: "sub-math" }),
          masterySignal({ skillId: "c", subjectId: "sub-math" }),
          masterySignal({ skillId: "x", subjectId: "sub-ela" }),
          masterySignal({ skillId: "y", subjectId: "sub-ela" }),
          masterySignal({ skillId: "z", subjectId: "sub-ela" }),
        ],
        belowGrade,
      ),
    );
    expect(recs).toHaveLength(2);
  });
});

describe("buildRebaselineCandidate", () => {
  const now = new Date("2026-06-10T00:00:00.000Z");

  it("fires on baseline age >= 90 days", () => {
    const completedAt = new Date(now.getTime() - (REBASELINE_MAX_AGE_DAYS + 1) * DAY_MS);
    const rec = buildRebaselineCandidate(
      input([], { baselineCompletedAt: completedAt.toISOString() }),
      now,
    );
    expect(rec?.type).toBe("rebaseline_request");
    expect((rec?.proposedValue as { reason: string }).reason).toBe("baseline_age");
  });

  it("does not fire on a fresh baseline with no signals", () => {
    const completedAt = new Date(now.getTime() - 10 * DAY_MS);
    const rec = buildRebaselineCandidate(
      input([], { baselineCompletedAt: completedAt.toISOString() }),
      now,
    );
    expect(rec).toBeNull();
  });

  it("fires when >=5 distinct skills changed level", () => {
    const signals = ["a", "b", "c", "d", "e"].map((skillId) =>
      masterySignal({ skillId, levelBefore: "emerging", levelAfter: "approaching" }),
    );
    const rec = buildRebaselineCandidate(input(signals), now);
    expect(rec?.type).toBe("rebaseline_request");
    expect((rec?.proposedValue as { reason: string }).reason).toBe("level_shift");
  });

  it("does not fire on 4 level shifts", () => {
    const signals = ["a", "b", "c", "d"].map((skillId) =>
      masterySignal({ skillId, levelBefore: "emerging", levelAfter: "approaching" }),
    );
    expect(buildRebaselineCandidate(input(signals), now)).toBeNull();
  });

  it("fires on a stall: >=10 signals in a subject with avg movement < 0.05", () => {
    const signals = Array.from({ length: 10 }, (_, i) =>
      masterySignal({
        skillId: `s${i}`,
        before: 0.5,
        after: 0.51,
        levelBefore: "approaching",
        levelAfter: "approaching",
      }),
    );
    const rec = buildRebaselineCandidate(input(signals), now);
    expect(rec?.type).toBe("rebaseline_request");
    expect((rec?.proposedValue as { reason: string }).reason).toBe("stall");
  });

  it("does not fire when movement is healthy", () => {
    const signals = Array.from({ length: 10 }, (_, i) =>
      masterySignal({
        skillId: `s${i}`,
        before: 0.5,
        after: 0.6,
        levelBefore: "approaching",
        levelAfter: "approaching",
      }),
    );
    expect(buildRebaselineCandidate(input(signals), now)).toBeNull();
  });
});

describe("dedupeAgainstPending", () => {
  it("drops a duplicate PENDING upward change for the same subject, keeps other subjects", () => {
    const candidates = buildUpwardDeliveryCandidates(
      input(
        [
          masterySignal({ skillId: "a", subjectId: "sub-math" }),
          masterySignal({ skillId: "b", subjectId: "sub-math" }),
          masterySignal({ skillId: "c", subjectId: "sub-math" }),
          masterySignal({ skillId: "x", subjectId: "sub-ela" }),
          masterySignal({ skillId: "y", subjectId: "sub-ela" }),
          masterySignal({ skillId: "z", subjectId: "sub-ela" }),
        ],
        { deliveryLevel: "3", gradeBand: "5" },
      ),
    );
    const pendingMath = {
      ...candidates.find(
        (c) => (c.proposedValue as { subjectId: string }).subjectId === "sub-math",
      )!,
      id: "existing-1",
    } as ProfileRecommendation;
    const out = dedupeAgainstPending(candidates, [pendingMath]);
    expect(out).toHaveLength(1);
    expect((out[0]!.proposedValue as { subjectId: string }).subjectId).toBe("sub-ela");
  });

  it("does not drop against DECLINED history", () => {
    const candidates = buildUpwardDeliveryCandidates(
      input(
        [masterySignal({ skillId: "a" }), masterySignal({ skillId: "b" }), masterySignal({ skillId: "c" })],
        { deliveryLevel: "3", gradeBand: "5" },
      ),
    );
    const declined = { ...candidates[0]!, id: "old-1", status: "DECLINED" } as ProfileRecommendation;
    expect(dedupeAgainstPending(candidates, [declined])).toHaveLength(1);
  });
});
