import { describe, it, expect } from "vitest";
import type {
  BaselineAttempt,
  BaselineDifficulty,
  BaselineQuestion,
  LearnerProfile,
} from "@/lib/db/types";
import {
  difficultyToTheta,
  thetaToDifficulty,
  questionToBaselineItem,
  priorThetaForLearner,
  learnerHasReadingDifficulty,
  selectNextAdaptiveQuestion,
} from "./baseline-adaptive";

let qSeq = 0;
function q(
  difficulty: BaselineDifficulty,
  opts: Partial<BaselineQuestion> = {},
): BaselineQuestion {
  qSeq += 1;
  return {
    id: opts.id ?? `q${qSeq}`,
    baselineId: "bas1",
    subjectId: opts.subjectId ?? "sub1",
    // Distinct skill per item by default so the engine's "covered skill"
    // penalty doesn't confound difficulty-driven selection in tests.
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

function learner(partial: Partial<LearnerProfile>): LearnerProfile {
  return partial as unknown as LearnerProfile;
}

describe("calibration: difficulty <-> theta", () => {
  it("maps the enum onto a strictly increasing theta scale", () => {
    expect(difficultyToTheta("foundational")).toBeLessThan(difficultyToTheta("approaching"));
    expect(difficultyToTheta("approaching")).toBeLessThan(difficultyToTheta("grade_level"));
    expect(difficultyToTheta("grade_level")).toBeLessThan(difficultyToTheta("stretch"));
  });

  it("inverts theta back to the nearest band", () => {
    expect(thetaToDifficulty(-1.0)).toBe("foundational");
    expect(thetaToDifficulty(-0.3)).toBe("approaching");
    expect(thetaToDifficulty(0.4)).toBe("grade_level");
    expect(thetaToDifficulty(1.2)).toBe("stretch");
    expect(thetaToDifficulty(5)).toBe("stretch");
    expect(thetaToDifficulty(-5)).toBe("foundational");
  });
});

describe("questionToBaselineItem", () => {
  it("treats picture-prompted items as light-reading visual", () => {
    const item = questionToBaselineItem(q("foundational", { sceneEmoji: "🐱" }));
    expect(item.lightReading).toBe(true);
    expect(item.modalities).toEqual(["visual"]);
  });

  it("treats text-only items as reading", () => {
    const item = questionToBaselineItem(q("grade_level"));
    expect(item.lightReading).toBe(false);
    expect(item.modalities).toEqual(["reading"]);
  });
});

describe("cold-start prior", () => {
  it("returns 0 for an unknown learner", () => {
    expect(priorThetaForLearner(null)).toBe(0);
  });

  it("places a confident learner above a brand-new one", () => {
    const advanced = priorThetaForLearner(
      learner({ readingComfort: "advanced", mathComfort: "advanced" }),
    );
    const fresh = priorThetaForLearner(learner({ readingComfort: "new", mathComfort: "new" }));
    expect(advanced).toBeGreaterThan(0);
    expect(fresh).toBeLessThan(0);
    expect(advanced).toBeGreaterThan(fresh);
  });

  it("flags reading difficulty from comfort or audio-first preference", () => {
    expect(learnerHasReadingDifficulty(learner({ readingComfort: "new" }))).toBe(true);
    expect(
      learnerHasReadingDifficulty(
        learner({
          readingComfort: "confident",
          accessibilityDefaults: {
            audioFirst: true,
            reducedMotion: false,
            highContrast: false,
            largeText: false,
            captionsAlwaysOn: false,
          },
        }),
      ),
    ).toBe(true);
    expect(learnerHasReadingDifficulty(learner({ readingComfort: "confident" }))).toBe(false);
  });
});

describe("selectNextAdaptiveQuestion", () => {
  it("opens near the cold-start prior", () => {
    const pool = [q("foundational"), q("approaching"), q("grade_level"), q("stretch")];
    const sel = selectNextAdaptiveQuestion({ questions: pool, attempts: [], priorTheta: 1.0 });
    expect(sel.next?.difficulty).toBe("stretch");
  });

  it("CORE: a correct answer makes the next item harder than a wrong answer does", () => {
    // Two items per band so there is a candidate on either side of theta.
    const bands: BaselineDifficulty[] = [
      "foundational",
      "foundational",
      "approaching",
      "approaching",
      "grade_level",
      "grade_level",
      "stretch",
      "stretch",
    ];
    const pool = bands.map((d, i) => q(d, { id: `item${i}` }));
    // The first administered item is the same in both branches: an
    // "approaching" item. Only the correctness differs.
    const firstItem = pool.find((p) => p.difficulty === "approaching")!;

    const afterCorrect = selectNextAdaptiveQuestion({
      questions: pool,
      attempts: [ans(firstItem.id, true)],
    });
    const afterWrong = selectNextAdaptiveQuestion({
      questions: pool,
      attempts: [ans(firstItem.id, false)],
    });

    expect(afterCorrect.theta).toBeGreaterThan(afterWrong.theta);
    expect(afterCorrect.next).not.toBeNull();
    expect(afterWrong.next).not.toBeNull();
    expect(difficultyToTheta(afterCorrect.next!.difficulty)).toBeGreaterThan(
      difficultyToTheta(afterWrong.next!.difficulty),
    );
  });

  it("never re-serves a skipped question", () => {
    const pool = [q("approaching", { id: "qa" }), q("grade_level", { id: "qb" })];
    const sel = selectNextAdaptiveQuestion({
      questions: pool,
      attempts: [ans("qa", false, true)],
    });
    expect(sel.next?.id).toBe("qb");
  });

  it("ends the run (next=null) once every question is answered", () => {
    const pool = [q("foundational", { id: "x1" }), q("approaching", { id: "x2" })];
    const sel = selectNextAdaptiveQuestion({
      questions: pool,
      attempts: [ans("x1", true), ans("x2", false)],
    });
    expect(sel.next).toBeNull();
  });

  it("stops at the max-item cap even with pool remaining", () => {
    const pool = Array.from({ length: 25 }, (_, i) => q("grade_level", { id: `m${i}` }));
    const attempts = pool.slice(0, 20).map((p, i) => ans(p.id, i % 2 === 0));
    const sel = selectNextAdaptiveQuestion({ questions: pool, attempts });
    expect(sel.next).toBeNull();
    expect(sel.stop.stop).toBe(true);
    expect(sel.stop.reason).toBe("max_items");
  });
});
