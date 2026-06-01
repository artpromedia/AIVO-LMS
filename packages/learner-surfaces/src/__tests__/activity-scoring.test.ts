import { describe, it, expect } from "vitest";
import {
  toggleSpanSelection,
  scoreReadingAnnotation,
  defaultReadingTool,
  pointsMatch,
  snapToGrid,
  scoreGraph,
  scoreDragManipulative,
  targetIsFull,
  normalizeAnswer,
  scoreMultiStep,
} from "../scoring/activity-scoring.js";
import type { DragManipulativeSpec, GraphSpec, MultiStepSpec } from "../types.js";

describe("reading annotation scoring", () => {
  it("toggles span selection immutably", () => {
    const a = toggleSpanSelection([], "s1");
    expect(a).toEqual(["s1"]);
    const b = toggleSpanSelection(a, "s2");
    expect(b).toEqual(["s1", "s2"]);
    expect(toggleSpanSelection(b, "s1")).toEqual(["s2"]);
  });

  it("scores an exact evidence match as correct", () => {
    const s = scoreReadingAnnotation(["s2", "s4"], ["s4", "s2"]);
    expect(s.correct).toBe(true);
    expect(s.precision).toBe(1);
    expect(s.recall).toBe(1);
  });

  it("penalizes missing and extra evidence", () => {
    const s = scoreReadingAnnotation(["s2", "s9"], ["s2", "s4"]);
    expect(s.correct).toBe(false);
    expect(s.recall).toBeCloseTo(0.5);
    expect(s.precision).toBeCloseTo(0.5);
  });

  it("is process-only when no expected evidence is declared", () => {
    expect(scoreReadingAnnotation(["s1"], undefined).correct).toBe(true);
    expect(scoreReadingAnnotation([], undefined).correct).toBe(false);
  });

  it("defaults the active tool to the first declared (or highlight)", () => {
    expect(defaultReadingTool(["underline", "highlight"])).toBe("underline");
    expect(defaultReadingTool(undefined)).toBe("highlight");
  });
});

describe("graph scoring", () => {
  const spec: GraphSpec = {
    xMin: 0,
    xMax: 10,
    yMin: 0,
    yMax: 10,
    step: 1,
    expectedPoints: [
      { x: 2, y: 3 },
      { x: 5, y: 5 },
    ],
  };

  it("matches points order-independently within tolerance", () => {
    expect(pointsMatch({ x: 2, y: 3 }, { x: 2, y: 3 })).toBe(true);
    expect(pointsMatch({ x: 2, y: 3 }, { x: 3, y: 3 }, 1)).toBe(true);
    const s = scoreGraph(
      [
        { x: 5, y: 5 },
        { x: 2, y: 3 },
      ],
      spec,
    );
    expect(s.correct).toBe(true);
    expect(s.matched).toBe(2);
  });

  it("flags missing and extra points", () => {
    const s = scoreGraph(
      [
        { x: 2, y: 3 },
        { x: 9, y: 9 },
      ],
      spec,
    );
    expect(s.correct).toBe(false);
    expect(s.missing).toBe(1);
    expect(s.extra).toBe(1);
  });

  it("snaps a raw coordinate to the grid + clamps to bounds", () => {
    expect(snapToGrid(2.4, 0, 10, 1)).toBe(2);
    expect(snapToGrid(-3, 0, 10, 1)).toBe(0);
    expect(snapToGrid(99, 0, 10, 1)).toBe(10);
    expect(snapToGrid(3, 0, 10, 2)).toBe(4);
  });
});

describe("drag manipulative scoring", () => {
  const spec: DragManipulativeSpec = {
    items: [
      { id: "i1", label: "3" },
      { id: "i2", label: "7" },
    ],
    targets: [
      { id: "odd", label: "Odd", capacity: 1 },
      { id: "even", label: "Even" },
    ],
    correctPlacement: { i1: "odd", i2: "odd" },
  };

  it("counts items in their correct target", () => {
    const s = scoreDragManipulative({ placement: { i1: "odd", i2: "odd" } }, spec);
    expect(s.correct).toBe(true);
    expect(s.correctCount).toBe(2);
  });

  it("marks an incorrect placement", () => {
    const s = scoreDragManipulative({ placement: { i1: "odd", i2: "even" } }, spec);
    expect(s.correct).toBe(false);
    expect(s.correctCount).toBe(1);
  });

  it("respects target capacity", () => {
    expect(targetIsFull({ i1: "odd" }, spec, "odd")).toBe(true);
    expect(targetIsFull({ i1: "even" }, spec, "even")).toBe(false);
  });
});

describe("multi-step scoring", () => {
  const spec: MultiStepSpec = {
    steps: [
      { id: "a", prompt: "10 + 4 = ?", expectedAnswer: "14" },
      { id: "b", prompt: "carry the ten", expectedAnswer: "20" },
      { id: "c", prompt: "explain" /* process-only */ },
    ],
  };

  it("normalizes answers tolerantly", () => {
    expect(normalizeAnswer("  $1,400 ")).toBe("1400");
    expect(normalizeAnswer("X = 5")).toBe("x=5");
  });

  it("validates each step and requires all to be complete + correct", () => {
    const s = scoreMultiStep({ a: "14", b: "20", c: "because" }, spec);
    expect(s.correct).toBe(true);
    expect(s.perStep).toEqual({ a: true, b: true, c: true });
    expect(s.completed).toBe(3);
  });

  it("fails when a checkable step is wrong", () => {
    const s = scoreMultiStep({ a: "14", b: "21", c: "x" }, spec);
    expect(s.correct).toBe(false);
    expect(s.perStep.b).toBe(false);
  });

  it("is incomplete when a step is blank", () => {
    const s = scoreMultiStep({ a: "14", b: "20" }, spec);
    expect(s.correct).toBe(false);
    expect(s.completed).toBe(2);
  });
});
