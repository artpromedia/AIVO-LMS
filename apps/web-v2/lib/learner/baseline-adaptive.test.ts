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
  itemKeyFor,
  assessFrustration,
  FRUSTRATION_CEILING_LOGITS,
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

  it("passes a calibrated discrimination through to the engine item (2-PL)", () => {
    expect(questionToBaselineItem(q("grade_level")).discrimination).toBeUndefined();
    const calibrated = questionToBaselineItem(q("grade_level", { discrimination: 1.8 }));
    expect(calibrated.discrimination).toBe(1.8);
  });

  it("a live-calibrated {b,a} entry overrides both difficulty and discrimination", () => {
    const qq = q("grade_level", { skillId: "skc", id: "qc" });
    const item = questionToBaselineItem(qq, {
      [itemKeyFor(qq)]: { difficulty: 0.2, discrimination: 1.9 },
    });
    expect(item.difficulty).toBe(0.2);
    expect(item.discrimination).toBe(1.9);
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

describe("G7: accessibility parity on the adaptive path", () => {
  it("returns the question with its accessibility fields intact", () => {
    const rich = q("grade_level", {
      id: "rich",
      readAloudText: "Listen: which one is the cat?",
      hint: "Start with the /k/ sound.",
      choices: ["cat", "dog"],
      choiceEmojis: ["🐱", "🐶"],
      sceneEmoji: "🐱",
      accommodationTags: ["read_aloud", "large_text"],
    });
    const sel = selectNextAdaptiveQuestion({ questions: [rich], attempts: [], priorTheta: 0.4 });
    expect(sel.next?.readAloudText).toBe("Listen: which one is the cat?");
    expect(sel.next?.hint).toBe("Start with the /k/ sound.");
    expect(sel.next?.choiceEmojis).toEqual(["🐱", "🐶"]);
    expect(sel.next?.sceneEmoji).toBe("🐱");
    expect(sel.next?.accommodationTags).toContain("read_aloud");
  });

  it("prefers a reading-light item for a reading-difficulty learner on a tie", () => {
    const qPic = q("grade_level", { id: "pic", skillId: "sp", sceneEmoji: "🐱" });
    const qText = q("grade_level", { id: "text", skillId: "st" });
    // θ at the band so both items tie on difficulty; reading difficulty
    // up-weights the picture (reading-light) item.
    const sel = selectNextAdaptiveQuestion({
      questions: [qText, qPic],
      attempts: [],
      priorTheta: 0.4,
      readingDifficulty: true,
    });
    expect(sel.next?.id).toBe("pic");
  });
});

describe("assessFrustration", () => {
  it("reports no frustration on a clean run", () => {
    const f = assessFrustration([ans("q1", true), ans("q2", true)]);
    expect(f.level).toBe("none");
    expect(f.ceiling).toBe(FRUSTRATION_CEILING_LOGITS);
    expect(f.struggleStreak).toBe(0);
  });

  it("escalates to mild then high as the wrong/skip run grows", () => {
    expect(assessFrustration([ans("a", true), ans("b", false), ans("c", false)]).level).toBe("mild");
    const high = assessFrustration([ans("a", false), ans("b", false), ans("c", false)]);
    expect(high.level).toBe("high");
    expect(high.struggleStreak).toBe(3);
    expect(high.ceiling).toBeLessThan(FRUSTRATION_CEILING_LOGITS);
  });

  it("resets the streak after a correct answer", () => {
    const f = assessFrustration([ans("a", false), ans("b", false), ans("c", true)]);
    expect(f.level).toBe("none");
    expect(f.struggleStreak).toBe(0);
  });

  it("counts skips as struggle", () => {
    const f = assessFrustration([
      ans("a", false, true),
      ans("b", false, true),
      ans("c", false, true),
    ]);
    expect(f.level).toBe("high");
  });

  it("nudges the level up after an unusually slow answer", () => {
    const slow: BaselineAttempt = {
      id: "x",
      baselineId: "b",
      questionId: "q",
      learnerId: "l",
      tenantId: "t",
      response: "r",
      isCorrect: true,
      skipped: false,
      latencyMs: 60_000,
      respondedAt: new Date().toISOString(),
    };
    expect(assessFrustration([slow]).level).toBe("mild");
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

  it("honors a calibration override when selecting (refined θ replaces seed band)", () => {
    // A "foundational" item recalibrated to a hard θ should be treated as
    // hard: from a high prior, the calibrated item becomes the nearest.
    const hardFoundational = q("foundational", { id: "f-hard", skillId: "skX" });
    const trueStretch = q("stretch", { id: "s-real", skillId: "skY" });
    const calibration = { [itemKeyFor(hardFoundational)]: { difficulty: 1.3 } };

    const withCal = selectNextAdaptiveQuestion({
      questions: [hardFoundational, trueStretch],
      attempts: [],
      priorTheta: 1.3,
      calibration,
    });
    // Seed θ would put foundational at -1.0 (far from 1.3); the override
    // (1.3) makes it the exact nearest item, beating stretch (seed 1.2).
    expect(withCal.next?.id).toBe("f-hard");

    const withoutCal = selectNextAdaptiveQuestion({
      questions: [hardFoundational, trueStretch],
      attempts: [],
      priorTheta: 1.3,
    });
    expect(withoutCal.next?.id).toBe("s-real");
  });

  it("G5: a struggling learner is served an easier item under the tightened ceiling", () => {
    // qHi sits just above θ (nearest); qLo is further but easier. Use a
    // calibration override to pin exact difficulties.
    const qHi = q("grade_level", { id: "hi", skillId: "shi" });
    const qLo = q("foundational", { id: "lo", skillId: "slo" });
    const calibration = {
      [itemKeyFor(qHi)]: { difficulty: 0.3 },
      [itemKeyFor(qLo)]: { difficulty: -0.8 },
    };

    // No struggle → nearest (qHi) is within the base ceiling.
    const calm = selectNextAdaptiveQuestion({
      questions: [qHi, qLo],
      attempts: [],
      priorTheta: 0,
      calibration,
    });
    expect(calm.next?.id).toBe("hi");

    // Three skipped dummies → high frustration; θ stays at the prior (skips
    // don't move it), the ceiling tightens, and qHi (0.3 > θ+0.25) is
    // excluded in favour of the easier qLo.
    const dummies = [
      q("grade_level", { id: "d1", skillId: "sd1" }),
      q("grade_level", { id: "d2", skillId: "sd2" }),
      q("grade_level", { id: "d3", skillId: "sd3" }),
    ];
    const struggling = selectNextAdaptiveQuestion({
      questions: [...dummies, qHi, qLo],
      attempts: dummies.map((d) => ans(d.id, false, true)),
      priorTheta: 0,
      calibration,
    });
    expect(struggling.frustration.level).toBe("high");
    expect(struggling.next?.id).toBe("lo");
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
