import { describe, it, expect } from "vitest";
import type { BaselineAttempt, BaselineDifficulty, BaselineQuestion } from "@/lib/db/types";
import {
  accuracyToBand,
  comparePlacement,
  summarizeParity,
  evaluateParityGate,
  type RunForParity,
} from "./baseline-parity";

let qSeq = 0;
function q(difficulty: BaselineDifficulty): BaselineQuestion {
  qSeq += 1;
  return {
    id: `q${qSeq}`,
    baselineId: "b1",
    subjectId: "s1",
    skillId: `sk${qSeq}`,
    order: qSeq,
    prompt: "p",
    difficulty,
    accommodationTags: [],
  };
}

let aSeq = 0;
function ans(questionId: string, isCorrect: boolean, skipped = false): BaselineAttempt {
  aSeq += 1;
  return {
    id: `a${aSeq}`,
    baselineId: "b1",
    questionId,
    learnerId: "l1",
    tenantId: "t1",
    response: "x",
    isCorrect,
    skipped,
    respondedAt: new Date(Date.UTC(2026, 0, 1, 0, 0, aSeq)).toISOString(),
  };
}

describe("accuracyToBand", () => {
  it("maps accuracy onto coarse bands", () => {
    expect(accuracyToBand(0.2)).toBe("foundational");
    expect(accuracyToBand(0.5)).toBe("approaching");
    expect(accuracyToBand(0.7)).toBe("grade_level");
    expect(accuracyToBand(0.95)).toBe("stretch");
  });
});

describe("comparePlacement", () => {
  it("agrees when adaptive and fixed-form land within one band", () => {
    const qs = [q("grade_level"), q("grade_level"), q("grade_level")];
    // All correct → fixed-form 'stretch', adaptive θ rises → grade_level/stretch.
    const run: RunForParity = {
      questions: qs,
      attempts: qs.map((x) => ans(x.id, true)),
      learner: null,
      completed: true,
    };
    const c = comparePlacement(run);
    expect(c.itemsAnswered).toBe(3);
    expect(c.fixedFormBand).toBe("stretch");
    expect(c.agree).toBe(true);
  });

  it("excludes skips from the fixed-form accuracy", () => {
    const qs = [q("approaching"), q("approaching")];
    const run: RunForParity = {
      questions: qs,
      attempts: [ans(qs[0]!.id, true), ans(qs[1]!.id, false, true)],
      learner: null,
      completed: true,
    };
    const c = comparePlacement(run);
    expect(c.itemsAnswered).toBe(1);
    expect(c.fixedFormAccuracy).toBe(1);
  });
});

describe("evaluateParityGate", () => {
  function run(correctRatio: number, completed: boolean): RunForParity {
    const qs = [q("grade_level"), q("grade_level"), q("grade_level"), q("grade_level")];
    const attempts = qs.map((x, i) => ans(x.id, i / qs.length < correctRatio));
    return { questions: qs, attempts, learner: null, completed };
  }

  it("fails an empty cohort (no evidence)", () => {
    const r = evaluateParityGate([]);
    expect(r.pass).toBe(false);
    expect(r.reasons).toContain("no_runs");
  });

  it("passes when completion + agreement clear the thresholds", () => {
    const runs = Array.from({ length: 10 }, () => run(0.75, true));
    const r = evaluateParityGate(runs);
    expect(r.summary.completionRate).toBe(1);
    expect(r.pass).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("blocks on low completion with a clear reason", () => {
    const runs = [
      ...Array.from({ length: 5 }, () => run(0.75, true)),
      ...Array.from({ length: 5 }, () => run(0.75, false)),
    ];
    const r = evaluateParityGate(runs);
    expect(r.summary.completionRate).toBe(0.5);
    expect(r.pass).toBe(false);
    expect(r.reasons.some((x) => x.startsWith("completion_rate"))).toBe(true);
  });

  it("summarizes cohort stats", () => {
    const runs = Array.from({ length: 4 }, () => run(0.5, true));
    const s = summarizeParity(runs);
    expect(s.runs).toBe(4);
    expect(s.medianItemsAnswered).toBe(4);
    expect(s.completionRate).toBe(1);
  });
});
