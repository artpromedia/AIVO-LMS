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
  estimate2PL,
  aggregateItemPsychometrics,
  recalibrationMap,
} from "./baseline-telemetry";

/** Generate (ability, correct) pairs from a known 2-PL item. */
function synth2PL(
  a: number,
  b: number,
  thetas: number[],
  perTheta: number,
): { thetaBefore: number; correct: boolean }[] {
  const out: { thetaBefore: number; correct: boolean }[] = [];
  for (const t of thetas) {
    const p = 1 / (1 + Math.exp(-a * (t - b)));
    const c = Math.round(p * perTheta);
    for (let i = 0; i < perTheta; i++) out.push({ thetaBefore: t, correct: i < c });
  }
  return out;
}

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
function ans(
  questionId: string,
  isCorrect: boolean,
  opts: { skipped?: boolean; latencyMs?: number } = {},
): BaselineAttempt {
  aSeq += 1;
  return {
    id: `a${aSeq}`,
    baselineId: "bas1",
    questionId,
    learnerId: "l1",
    tenantId: "t1",
    response: "x",
    isCorrect,
    skipped: opts.skipped ?? false,
    ...(opts.latencyMs !== undefined ? { latencyMs: opts.latencyMs } : {}),
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

  it("carries the client-measured latency onto the log", () => {
    const q1 = q("grade_level", { id: "qa" });
    const logs = buildRunTelemetry({
      baseline: { id: "bas1", learnerId: "l1", tenantId: "t1" },
      questions: [q1],
      attempts: [ans("qa", true, { latencyMs: 4200 })],
      learner: null,
    });
    expect(logs[0]!.latencyMs).toBe(4200);
  });

  it("records skips without moving theta", () => {
    const q1 = q("grade_level", { id: "qa" });
    const logs = buildRunTelemetry({
      baseline: { id: "bas1", learnerId: "l1", tenantId: "t1" },
      questions: [q1],
      attempts: [ans("qa", false, { skipped: true })],
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

describe("estimate2PL", () => {
  it("recovers a and b from spread-ability data", () => {
    const samples = synth2PL(1.5, 0.3, [-2, -1, 0, 1, 2], 40);
    const fit = estimate2PL(samples);
    expect(fit.identifiedA).toBe(true);
    expect(fit.a).toBeGreaterThan(1.1);
    expect(fit.a).toBeLessThan(2.0);
    expect(fit.b).toBeGreaterThan(-0.2);
    expect(fit.b).toBeLessThan(0.8);
  });

  it("distinguishes a sharp item from a flat one", () => {
    const sharp = estimate2PL(synth2PL(2.2, 0, [-2, -1, 0, 1, 2], 40));
    const flat = estimate2PL(synth2PL(0.5, 0, [-2, -1, 0, 1, 2], 40));
    expect(sharp.a).toBeGreaterThan(flat.a);
  });

  it("falls back to a=1 when ability has no spread (unidentifiable)", () => {
    const samples = [
      ...Array.from({ length: 10 }, () => ({ thetaBefore: 0, correct: true })),
      ...Array.from({ length: 10 }, () => ({ thetaBefore: 0, correct: false })),
    ];
    const fit = estimate2PL(samples);
    expect(fit.identifiedA).toBe(false);
    expect(fit.a).toBe(1);
    expect(fit.b).toBeCloseTo(0, 1);
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

  it("recovers a 2-PL discrimination > 1 for a sharp item", () => {
    const logs = [];
    for (const t of [-1.5, -0.5, 0.5, 1.5]) {
      const p = 1 / (1 + Math.exp(-1.8 * (t - 0)));
      const k = 12;
      const c = Math.round(p * k);
      for (let i = 0; i < k; i++) {
        logs.push(log({ itemKey: "skd|grade_level", skillId: "skd", thetaBefore: t, correct: i < c }));
      }
    }
    const [row] = aggregateItemPsychometrics(logs, { minExposure: 5 });
    expect(row!.estimatedDiscrimination).toBeGreaterThan(1.0);
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

  it("reports the median latency over scored responses that captured one", () => {
    const logs = [
      log({ skipped: false, correct: true, latencyMs: 1000 }),
      log({ skipped: false, correct: false, latencyMs: 3000 }),
      log({ skipped: false, correct: true, latencyMs: 2000 }),
      log({ skipped: true, correct: false, latencyMs: 99999 }), // skip excluded
      log({ skipped: false, correct: true }), // no latency → ignored
    ];
    const [row] = aggregateItemPsychometrics(logs, { minExposure: 1 });
    expect(row!.medianLatencyMs).toBe(2000);
  });

  it("returns null median latency when nothing captured one", () => {
    const logs = [log({ skipped: false, correct: true }), log({ skipped: false, correct: false })];
    const [row] = aggregateItemPsychometrics(logs, { minExposure: 1 });
    expect(row!.medianLatencyMs).toBeNull();
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
