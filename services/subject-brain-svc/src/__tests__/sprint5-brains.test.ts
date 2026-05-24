import { describe, expect, it } from "vitest";
import { SocialEmotionalBrain } from "../brains/social-emotional/index.js";
import { ExecutiveFunctionBrain } from "../brains/executive-function/index.js";
import { LifeSkillsBrain } from "../brains/life-skills/index.js";
import { SocialStudiesBrain } from "../brains/social-studies/index.js";
import { getSubjectBrain } from "../services/index.js";
import type { ItemResponse, LearnerState, SkillGraphView } from "../services/types.js";

const EMPTY_GRAPH: SkillGraphView = { skills: [] };

describe("Sprint 5 brains — registry", () => {
  it("registers all four new brains", () => {
    expect(getSubjectBrain("social_emotional")).toBeInstanceOf(SocialEmotionalBrain);
    expect(getSubjectBrain("executive_function")).toBeInstanceOf(ExecutiveFunctionBrain);
    expect(getSubjectBrain("life_skills")).toBeInstanceOf(LifeSkillsBrain);
    expect(getSubjectBrain("social_studies")).toBeInstanceOf(SocialStudiesBrain);
  });
});

describe("SocialEmotionalBrain", () => {
  const brain = new SocialEmotionalBrain();
  const baseState: LearnerState = {
    learnerId: "l1",
    theta: 0,
    masteryLevels: { "SEL.SELF_AWARE": 0.2, "SEL.SELF_MANAGE": 0.6 },
  };

  it("never produces pass/fail; emits a band", () => {
    const r = brain.score({
      itemId: "SEL.SA.005",
      skillCode: "SEL.SELF_AWARE",
      correctness: null,
      payload: { reflectionDepth: 3 },
    });
    expect(r.band).toBe("reflective");
    expect(r.mastery).toBeGreaterThan(0.8);
  });

  it("selects an item from the weakest CASEL competency", () => {
    const item = brain.selectNextItem(baseState, EMPTY_GRAPH);
    expect(item?.skillCode).toBe("SEL.SELF_AWARE");
  });

  it("drops to choice_grid when learners skip open responses", () => {
    const history: ItemResponse[] = Array.from({ length: 4 }, (_, i) => ({
      itemId: `SEL.x.${i}`,
      skillCode: "SEL.SELF_AWARE",
      correctness: null,
      payload: {},
    }));
    const d = brain.adapt(history);
    expect(d.recommendedSurface).toBe("choice_grid");
  });
});

describe("ExecutiveFunctionBrain", () => {
  const brain = new ExecutiveFunctionBrain();

  it("penalizes very fast guesses", () => {
    const r = brain.score({
      itemId: "EF.WM.001",
      skillCode: "EF.WORKING_MEMORY",
      correctness: 1,
      responseTimeMs: 100,
    });
    expect(r.mastery).toBeLessThan(0.9);
  });

  it("steps difficulty up only when fast + accurate + no flailing", () => {
    const history: ItemResponse[] = Array.from({ length: 5 }, () => ({
      itemId: "x",
      skillCode: "EF.WORKING_MEMORY",
      correctness: 0.95,
      responseTimeMs: 4000,
      corrections: 0,
    }));
    expect(brain.adapt(history).difficultyModulation).toBeGreaterThan(1);
  });

  it("drops load when corrections climb", () => {
    const history: ItemResponse[] = Array.from({ length: 5 }, () => ({
      itemId: "x",
      skillCode: "EF.FLEX",
      correctness: 0.6,
      responseTimeMs: 25000,
      corrections: 3,
    }));
    expect(brain.adapt(history).difficultyModulation).toBeLessThan(1);
  });
});

describe("LifeSkillsBrain", () => {
  const brain = new LifeSkillsBrain();

  it("scores procedural items on step completion", () => {
    const r = brain.score({
      itemId: "LIFE.SC.001",
      skillCode: "LIFE.SELF_CARE",
      payload: { stepsCompleted: 3, totalSteps: 4 },
    });
    expect(r.mastery).toBeCloseTo(0.75, 2);
  });
});

describe("SocialStudiesBrain", () => {
  const brain = new SocialStudiesBrain();

  it("picks an item closest to learner theta", () => {
    const item = brain.selectNextItem(
      { learnerId: "l1", theta: 0.8, masteryLevels: {} },
      EMPTY_GRAPH,
    );
    expect(item).toBeDefined();
    // theta=0.8 should pull a mid-grade item, not a -1.5 K-2 anchor.
    expect(item!.difficulty).toBeGreaterThan(0);
  });

  it("recommends a video surface for history topics", () => {
    const ctx = brain.context({
      learnerId: "l1",
      subject: "social_studies",
      topic: "civil rights movement",
      brainContext: {},
    });
    expect(ctx.recommendedSurfaces).toContain("video");
  });
});
