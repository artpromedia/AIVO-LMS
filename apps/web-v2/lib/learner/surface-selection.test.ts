/**
 * Remediation Sprint 02 — domain-surface selection + the validated `surface`
 * envelope, end to end through the deterministic generator:
 *
 *   1. deriveNumberLineSpec only derives honest, answerable ranges.
 *   2. selectSurfaceForItem keys off the subject's tutor (nova only, S02).
 *   3. generateDeterministicLessonPlan emits number_line surfaces for math
 *      and nothing for other subjects — and the emitted plan still passes
 *      the strict GeneratedLessonPlanSchema.
 */
import { describe, expect, it } from "vitest";
import { GeneratedLessonPlanSchema, LessonSurfaceSchema } from "@/lib/validators/lesson";
import type {
  LearnerBrainProfileState,
  LessonAccommodationSnapshot,
  LessonMasterySnapshot,
  Skill,
  Subject,
} from "@/lib/db/types";
import { generateDeterministicLessonPlan, type LessonPlanInputs } from "./lesson-plan";
import { deriveNumberLineSpec, selectSurfaceForItem } from "./surface-selection";

describe("deriveNumberLineSpec", () => {
  it("derives a 0-anchored range covering answer and choices", () => {
    expect(
      deriveNumberLineSpec({ prompt: "What is 2 + 3?", expectedAnswer: "5", choices: ["4", "5", "6"] }),
    ).toEqual({ min: 0, max: 8, step: 1 });
  });

  it("extends below zero for negative values", () => {
    expect(deriveNumberLineSpec({ prompt: "p", expectedAnswer: "-2", choices: ["-2", "1"] })).toEqual(
      { min: -3, max: 3, step: 1 },
    );
  });

  it("refuses non-numeric answers", () => {
    expect(deriveNumberLineSpec({ prompt: "p", expectedAnswer: "hive" })).toBeNull();
    expect(deriveNumberLineSpec({ prompt: "p", expectedAnswer: "any thoughtful response" })).toBeNull();
    expect(deriveNumberLineSpec({ prompt: "p" })).toBeNull();
  });

  it("refuses when any choice cannot be a tick", () => {
    expect(
      deriveNumberLineSpec({ prompt: "p", expectedAnswer: "5", choices: ["5", "five"] }),
    ).toBeNull();
  });

  it("refuses values outside the early-numeracy window", () => {
    expect(deriveNumberLineSpec({ prompt: "p", expectedAnswer: "21" })).toBeNull();
    expect(deriveNumberLineSpec({ prompt: "p", expectedAnswer: "48" })).toBeNull();
    expect(deriveNumberLineSpec({ prompt: "p", expectedAnswer: "-25" })).toBeNull();
  });

  it("refuses decimals (step-1 integer line)", () => {
    expect(deriveNumberLineSpec({ prompt: "p", expectedAnswer: "0.5" })).toBeNull();
  });
});

describe("selectSurfaceForItem", () => {
  it("gives math (nova) a number line when derivable", () => {
    const surface = selectSurfaceForItem({
      subjectSlug: "math",
      item: { prompt: "What is 2 + 3?", expectedAnswer: "5", choices: ["4", "5", "6"] },
    });
    expect(surface?.surfaceType).toBe("number_line");
    expect(surface?.numberLine).toEqual({ min: 0, max: 8, step: 1 });
    // Whatever the selector emits must satisfy the wire schema.
    expect(LessonSurfaceSchema.safeParse(surface).success).toBe(true);
  });

  it("keeps math on the generic surface when underivable", () => {
    expect(
      selectSurfaceForItem({
        subjectSlug: "math",
        item: { prompt: "What is 14 + 7?", expectedAnswer: "21" },
      }),
    ).toBeUndefined();
  });

  it("returns no surface for non-nova subjects in Sprint 02", () => {
    for (const slug of ["reading", "science", "social"]) {
      expect(
        selectSurfaceForItem({
          subjectSlug: slug,
          item: { prompt: "What is 2 + 3?", expectedAnswer: "5", choices: ["4", "5", "6"] },
        }),
      ).toBeUndefined();
    }
  });
});

// ── Generator emission (the production path) ────────────────────────────────

const brain = {
  preferredModalities: ["visual"],
  tutorPersonaRecommendation: { style: "warm_coach" },
} as unknown as LearnerBrainProfileState;
const accommodations = {
  tags: [],
  supportDefaults: {
    extendedTime: false,
    readAloud: false,
    speechToText: false,
    visualSchedules: false,
    sensoryBreaks: false,
  },
  accessibility: {} as LessonAccommodationSnapshot["accessibility"],
} as LessonAccommodationSnapshot;

function inputsFor(slug: string, level: LessonMasterySnapshot["level"]): LessonPlanInputs {
  const subject = { id: `s_${slug}`, slug, name: slug } as Subject;
  const skill = { id: `sk_${slug}`, subjectId: subject.id, name: "Counting on" } as Skill;
  return {
    learnerName: "Sam",
    brainState: brain,
    subject,
    skill,
    mastery: {
      skillId: skill.id,
      subjectId: subject.id,
      score: 0.2,
      level,
      confidence: 0.5,
      subjectContext: [],
    } as LessonMasterySnapshot,
    accommodations,
    source: "today_mission",
  };
}

describe("generateDeterministicLessonPlan surface emission", () => {
  it("emits a number_line surface on derivable math items, covering each answer", () => {
    const plan = generateDeterministicLessonPlan(inputsFor("math", "emerging"));
    const numberLineItems = plan.guidedPractice.filter(
      (g) => g.surface?.surfaceType === "number_line",
    );
    expect(numberLineItems.length).toBeGreaterThan(0);
    for (const item of numberLineItems) {
      const spec = item.surface?.numberLine;
      expect(spec).toBeDefined();
      const answer = Number(item.expectedAnswer);
      expect(Number.isInteger(answer)).toBe(true);
      expect(answer).toBeGreaterThanOrEqual(spec!.min);
      expect(answer).toBeLessThanOrEqual(spec!.max);
      for (const choice of item.choices ?? []) {
        const value = Number(choice);
        expect(value).toBeGreaterThanOrEqual(spec!.min);
        expect(value).toBeLessThanOrEqual(spec!.max);
      }
    }
    // The whole emitted plan must still satisfy the strict schema.
    expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
  });

  it("leaves underivable math items on the generic surface", () => {
    // Core tier includes "What is 14 + 7?" (answer 21 — outside the
    // number-line window); it must carry no surface.
    const plan = generateDeterministicLessonPlan(inputsFor("math", "approaching"));
    const underivable = plan.guidedPractice.find((g) => g.expectedAnswer === "21");
    if (underivable) expect(underivable.surface).toBeUndefined();
    expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
  });

  it("emits no surfaces for reading (sage is a later sprint)", () => {
    const plan = generateDeterministicLessonPlan(inputsFor("reading", "emerging"));
    for (const item of [...plan.guidedPractice, ...plan.checksForUnderstanding]) {
      expect(item.surface).toBeUndefined();
    }
    expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
  });
});

describe("LessonSurfaceSchema / plan schema", () => {
  it("requires a numberLine spec on number_line surfaces", () => {
    expect(LessonSurfaceSchema.safeParse({ surfaceType: "number_line" }).success).toBe(false);
  });

  it("forbids numberLine specs on other surfaces", () => {
    expect(
      LessonSurfaceSchema.safeParse({
        surfaceType: "choice_grid",
        numberLine: { min: 0, max: 5, step: 1 },
      }).success,
    ).toBe(false);
  });

  it("rejects unanswerable ranges (max<=min, tick overflow, unknown types)", () => {
    expect(
      LessonSurfaceSchema.safeParse({
        surfaceType: "number_line",
        numberLine: { min: 5, max: 5, step: 1 },
      }).success,
    ).toBe(false);
    expect(
      LessonSurfaceSchema.safeParse({
        surfaceType: "number_line",
        numberLine: { min: -100, max: 100, step: 1 },
      }).success,
    ).toBe(false);
    expect(LessonSurfaceSchema.safeParse({ surfaceType: "hologram" }).success).toBe(false);
  });

  it("keeps the plan schema strict at the top level: unknown plan keys are rejected", () => {
    // The strictness that matters for the surface contract lives on the
    // top-level plan object (.strict()) — that is what would have rejected a
    // stray `surface`/`surfaceType` before this sprint declared it. Inner
    // item objects use plain z.object (zod strips unknown item keys), so we
    // assert the real guarantee: a rogue TOP-LEVEL key fails the parse.
    const plan = generateDeterministicLessonPlan(inputsFor("math", "emerging"));
    expect(GeneratedLessonPlanSchema.safeParse(plan).success).toBe(true);
    expect(
      GeneratedLessonPlanSchema.safeParse({ ...plan, rogueTopLevel: true }).success,
    ).toBe(false);
  });
});
