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
import {
  buildGraphSurface,
  buildReadingAnnotationSurface,
  buildScienceDiagramSurface,
  deriveNumberLineSpec,
  selectSurfaceForItem,
} from "./surface-selection";

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

  it("never gives reading a math number line (domains stay distinct)", () => {
    const plan = generateDeterministicLessonPlan(inputsFor("reading", "emerging"));
    for (const item of [...plan.guidedPractice, ...plan.checksForUnderstanding]) {
      expect(item.surface?.surfaceType).not.toBe("number_line");
    }
    expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
  });
});

// ── Sprint 03 — literacy & science builders ─────────────────────────────────

describe("buildReadingAnnotationSurface", () => {
  it("splits the passage into spans and scores by the evidence span id", () => {
    const built = buildReadingAnnotationSurface({
      passage: "Pip ran fast. Pip stopped at the stream to drink. Pip went home.",
      question: "Why did Pip stop?",
      evidenceSentence: "Pip stopped at the stream to drink.",
    });
    expect(built).not.toBeNull();
    expect(built!.surface.surfaceType).toBe("reading_annotation");
    const spec = built!.surface.readingAnnotation!;
    expect(spec.passage).toHaveLength(3);
    expect(spec.expectedEvidenceIds).toEqual(["s2"]);
    // expectedAnswer is exactly what ReadingAnnotationSurface submits.
    expect(built!.expectedAnswer).toBe("s2");
    expect(LessonSurfaceSchema.safeParse(built!.surface).success).toBe(true);
  });

  it("returns null when the evidence is not a passage sentence", () => {
    expect(
      buildReadingAnnotationSurface({
        passage: "One sentence here. Another sentence there.",
        question: "q",
        evidenceSentence: "A sentence that is not in the passage.",
      }),
    ).toBeNull();
  });
});

describe("buildGraphSurface / buildScienceDiagramSurface", () => {
  it("graph expectedAnswer matches the surface's exact serialization", () => {
    const built = buildGraphSurface({ point: { x: 2, y: 3 } });
    expect(built!.expectedAnswer).toBe(JSON.stringify([{ x: 2, y: 3 }]));
    expect(built!.surface.graph!.expectedPoints).toEqual([{ x: 2, y: 3 }]);
    expect(LessonSurfaceSchema.safeParse(built!.surface).success).toBe(true);
    expect(buildGraphSurface({ point: { x: 9, y: 9 }, xMax: 6, yMax: 6 })).toBeNull();
  });

  it("science diagram scores the single target's label placement", () => {
    const built = buildScienceDiagramSurface({
      shapes: [{ id: "c", kind: "circle", cx: 100, cy: 100, r: 40 }],
      target: { id: "t1", x: 100, y: 100, correctLabelId: "roots" },
      labels: [
        { id: "roots", text: "Roots" },
        { id: "leaf", text: "Leaf" },
      ],
    });
    expect(built!.expectedAnswer).toBe(JSON.stringify({ t1: "roots" }));
    expect(LessonSurfaceSchema.safeParse(built!.surface).success).toBe(true);
    // A correct label outside the bank is unrepresentable.
    expect(
      buildScienceDiagramSurface({
        shapes: [{ id: "c", kind: "circle", cx: 1, cy: 1, r: 1 }],
        target: { id: "t1", x: 0, y: 0, correctLabelId: "missing" },
        labels: [
          { id: "a", text: "A" },
          { id: "b", text: "B" },
        ],
      }),
    ).toBeNull();
  });
});

describe("generator emission — reading & science (Sprint 03)", () => {
  it("reading lessons carry a reading_annotation item whose answer is its evidence id", () => {
    for (const level of ["emerging", "approaching", "stretching"] as const) {
      const plan = generateDeterministicLessonPlan(inputsFor("reading", level));
      const annotated = plan.guidedPractice.filter(
        (g) => g.surface?.surfaceType === "reading_annotation",
      );
      expect(annotated.length, `tier for ${level} must include an annotation item`).toBeGreaterThan(
        0,
      );
      for (const item of annotated) {
        const spec = item.surface!.readingAnnotation!;
        expect(spec.expectedEvidenceIds).toContain(item.expectedAnswer);
      }
      expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
    }
  });

  it("science lessons carry a diagram or graph item, schema-valid", () => {
    for (const level of ["emerging", "approaching", "stretching"] as const) {
      const plan = generateDeterministicLessonPlan(inputsFor("science", level));
      const domain = plan.guidedPractice.filter(
        (g) =>
          g.surface?.surfaceType === "science_diagram" || g.surface?.surfaceType === "graph",
      );
      expect(domain.length, `science ${level} must include a domain surface`).toBeGreaterThan(0);
      expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
    }
  });
});

// ── Sprint 04 — every subject (all 14 tutors) gets a domain surface ─────────

describe("generator emission — full tutor coverage (Sprint 04)", () => {
  /** subject slug → the domain surfaceType(s) its lessons must mount. */
  const EXPECTED: Record<string, string[]> = {
    math: ["number_line"],
    reading: ["reading_annotation"],
    writing: ["reading_annotation"],
    science: ["science_diagram", "graph"],
    "social-studies": ["reading_annotation"],
    geography: ["science_diagram"],
    speech: ["voice_response"],
    social: ["drag_manipulative"],
    life: ["multi_step_workspace"],
    "executive-function": ["multi_step_workspace"],
    art: ["art_canvas"],
    music: ["music_sequencer"],
    "physical-education": ["drag_manipulative"],
    "world-languages": ["voice_response"],
    coding: ["coding_sandbox"],
    engineering: ["multi_step_workspace"],
  };

  it("every learner subject mounts a domain-appropriate surface (no subject left generic)", () => {
    for (const [slug, expectedTypes] of Object.entries(EXPECTED)) {
      const plan = generateDeterministicLessonPlan(inputsFor(slug, "emerging"));
      const types = plan.guidedPractice
        .map((g) => g.surface?.surfaceType)
        .filter((t): t is NonNullable<typeof t> => Boolean(t));
      expect(
        types.some((t) => expectedTypes.includes(t)),
        `${slug} must mount one of [${expectedTypes.join(", ")}], got [${types.join(", ")}]`,
      ).toBe(true);
      // Domain isolation: no subject borrows math's number line except math.
      if (slug !== "math") expect(types).not.toContain("number_line");
      expect(() => GeneratedLessonPlanSchema.parse(plan)).not.toThrow();
    }
  });

  it("scored interactive items carry the exact serialization their surface submits", () => {
    // music: pattern JSON; drag: placement JSON — both must match the
    // component serialization byte for byte or the router marks every
    // learner wrong.
    const music = generateDeterministicLessonPlan(inputsFor("music", "emerging"));
    const seq = music.guidedPractice.find((g) => g.surface?.surfaceType === "music_sequencer")!;
    expect(seq.expectedAnswer).toBe(JSON.stringify(seq.surface!.musicSequencer!.expectedPattern));

    const sel = generateDeterministicLessonPlan(inputsFor("social", "emerging"));
    const drag = sel.guidedPractice.find((g) => g.surface?.surfaceType === "drag_manipulative")!;
    expect(drag.expectedAnswer).toBe(JSON.stringify(drag.surface!.dragManipulative!.correctPlacement));
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
