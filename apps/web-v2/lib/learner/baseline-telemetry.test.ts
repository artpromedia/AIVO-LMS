import { describe, it, expect } from "vitest";
import type {
  BaselineAttempt,
  BaselineDifficulty,
  BaselineItemResponseLog,
  BaselineQuestion,
} from "@/lib/db/types";
import {
  itemKeyFor,
  buildRunTelemetry,
  estimateDifficultyTheta,
  aggregateItemPsychometrics,
  recalibrationMap,
} from "./baseline-telemetry";

let qSeq = 0;
function q(difficulty: BaselineDifficulty, opts: Partial<BaselineQuestion> = {}): BaselineQuestion {
  qSeq += 1;
  return {
    id: opts.id ?? `q${qSeq}`,
    baselineId: "bas1",
    subjectId: opts.subjectId ?? "sub1",
    skillId: opts.skillId ?? `sk${qSeq}`,
    order: qSeq,
    prompt: "prompt",
    difficulty,
    accommodationTags: [],
    ...opts,
  };
}

let aSeq = 0;
function ans(questionId: string, isCorrect: boolean, skipped = false): BaselineAttempt {
  aSeq += 1;
  return {
    id: `a${aSeq}`,
    baselineId: "bas1",
    questionId,
    learnerId: "l1",
    tenantId: "t1",
    response: "x",
    isCorrect,
    skipped,
    respondedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, aSeq)).toISOString(),
  };
}

let lSeq = 0;
function log(part: Partial<BaselineItemResponseLog>): BaselineItemResponseLog {
  lSeq += 1;
  return {
    id: `brl${lSeq}`,
    tenantId: "t1",
    learnerId: `l${lSeq}`,
    baselineId: `bas${lSeq}`,
    questionId: `q${lSeq}`,
    itemKey: "sk1|grade_level",
    skillId: "sk1",
    subjectId: "sub1",
    difficulty: "grade_level",
    difficultyTheta: 0.4,
    correct: true,
    skipped: false,
    thetaBefore: 0,
    thetaAfter: 0.2,
    modality: "reading",
    recordedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, lSeq)).toISOString(),
    ...part,
  };
}

describe("itemKeyFor", () => {
  it("composes a stable skill|difficulty key", () => {
    expect(itemKeyFor({ skillId: "sk1", difficulty: "grade_level" })).toBe("sk1|grade_level");
  });
});

describe("buildRunTelemetry", () => {
  it("captures the theta trajectory before/after each answer", () => {
    const q1 = q("grade_level", { id: "qa" });
    const q2 = q("stretch", { id: "qb" });
    const logs = buildRunTelemetry({
      baseline: { id: "bas1", learnerId: "l1", tenantId: "t1" },
      questions: [q1, q2],
      attempts: [ans("qa", true), ans("qb", false)],
      learner: null, // prior theta = 0
    });

    expect(logs).toHaveLength(2);
    expect(logs[0]!.thetaBefore).toBe(0);
    expect(logs[0]!.correct).toBe(true);
    // A correct answer raises ability.
    expect(logs[0]!.thetaAfter).toBeGreaterThan(0);
    // The second item is served at the post-first-answer ability.
    expect(logs[1]!.thetaBefore).toBe(logs[0]!.thetaAfter);
    expect(logs[0]!.itemKey).toBe(itemKeyFor(q1));
    expect(logs[0]!.difficultyTheta).toBeCloseTo(0.4, 5);
  });

  it("records skips without moving theta", () => {
    const q1 = q("grade_level", { id: "qa" });
    const logs = buildRunTelemetry({
      baseline: { id: "bas1", learnerId: "l1", tenantId: "t1" },
      questions: [q1],
      attempts: [ans("qa", false, true)],
      learner: null,
    });
    expect(logs).toHaveLength(1);
    expect(logs[0]!.skipped).toBe(true);
    expect(logs[0]!.thetaBefore).toBe(logs[0]!.thetaAfter);
  });
});

describe("estimateDifficultyTheta (1-PL conditional MLE)", () => {
  it("returns an easy estimate when everyone gets it right", () => {
    const samples = Array.from({ length: 8 }, () => ({ thetaBefore: 0, correct: true }));
    expect(estimateDifficultyTheta(samples)).toBeLessThanOrEqual(-5);
  });

  it("returns a hard estimate when everyone fails", () => {
    const samples = Array.from({ length: 8 }, () => ({ thetaBefore: 0, correct: false }));
    expect(estimateDifficultyTheta(samples)).toBeGreaterThanOrEqual(5);
  });

  it("recovers b≈0 for a 50% item at ability 0", () => {
    const samples = [
      ...Array.from({ length: 5 }, () => ({ thetaBefore: 0, correct: true })),
      ...Array.from({ length: 5 }, () => ({ thetaBefore: 0, correct: false })),
    ];
    expect(estimateDifficultyTheta(samples)).toBeCloseTo(0, 1);
  });

  it("recovers a high b when able learners still mostly fail", () => {
    // ability 1.0, 2/10 correct → sigmoid(1 - b) = 0.2 → b ≈ 2.39
    const samples = [
      ...Array.from({ length: 2 }, () => ({ thetaBefore: 1, correct: true })),
      ...Array.from({ length: 8 }, () => ({ thetaBefore: 1, correct: false })),
    ];
    expect(estimateDifficultyTheta(samples)).toBeGreaterThan(2);
    expect(estimateDifficultyTheta(samples)).toBeLessThan(2.8);
  });
});

describe("aggregateItemPsychometrics", () => {
  it("flags a 'foundational' item that able learners keep failing as miscalibrated", () => {
    // seed theta -1.0 (foundational), but learners at θ≈0 fail 9/10 → the
    // item is actually far harder than its band (severe drift → auto-retire).
    const logs = [
      ...Array.from({ length: 1 }, () =>
        log({ difficulty: "foundational", difficultyTheta: -1.0, thetaBefore: 0, correct: true }),
      ),
      ...Array.from({ length: 9 }, () =>
        log({ difficulty: "foundational", difficultyTheta: -1.0, thetaBefore: 0, correct: false }),
      ),
    ];
    const [row] = aggregateItemPsychometrics(logs);
    expect(row!.sufficientData).toBe(true);
    expect(row!.scored).toBe(10);
    expect(row!.pValue).toBeCloseTo(0.1, 5);
    expect(row!.estimatedTheta).toBeGreaterThan(row!.seedTheta);
    expect(row!.thetaDelta).toBeGreaterThan(1.5);
    expect(row!.defectReasons).toContain("harder_than_calibrated");
    expect(row!.recommendRetire).toBe(true);
  });

  it("does not recalibrate below the exposure floor", () => {
    const logs = Array.from({ length: 3 }, () =>
      log({ difficulty: "grade_level", difficultyTheta: 0.4, thetaBefore: 0, correct: false }),
    );
    const [row] = aggregateItemPsychometrics(logs);
    expect(row!.sufficientData).toBe(false);
    expect(row!.estimatedTheta).toBe(row!.seedTheta);
    expect(row!.defectReasons).not.toContain("harder_than_calibrated");
  });

  it("flags high skip rate", () => {
    const logs = [
      ...Array.from({ length: 4 }, () => log({ skipped: true, correct: false })),
      ...Array.from({ length: 2 }, () => log({ skipped: false, correct: true })),
    ];
    const [row] = aggregateItemPsychometrics(logs);
    expect(row!.skipRate).toBeGreaterThanOrEqual(0.5);
    expect(row!.defectReasons).toContain("high_skip_rate");
  });
});

describe("recalibrationMap", () => {
  it("includes only items with sufficient data", () => {
    const good = Array.from({ length: 6 }, (_, i) =>
      log({ itemKey: "sk1|grade_level", thetaBefore: 0, correct: i % 2 === 0 }),
    );
    const thin = Array.from({ length: 2 }, () =>
      log({ itemKey: "sk2|stretch", difficulty: "stretch", difficultyTheta: 1.2 }),
    );
    const map = recalibrationMap([...good, ...thin]);
    expect(Object.keys(map)).toContain("sk1|grade_level");
    expect(Object.keys(map)).not.toContain("sk2|stretch");
  });
});
