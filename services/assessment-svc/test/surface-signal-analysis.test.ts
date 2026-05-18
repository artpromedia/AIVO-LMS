/**
 * Tests for `summariseSurfaceSignals` — the math that turns raw
 * per-activity signals into a process-aware profile.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  summariseSurfaceSignals,
  type SurfaceSignal,
} from "../src/services/surface-signal-analysis.js";

test("returns a zeroed summary for empty input", () => {
  const s = summariseSurfaceSignals([]);
  assert.equal(s.scratchpadUseRate, 0);
  assert.equal(s.hintDependenceRate, 0);
  assert.equal(s.fineMotorDragConcern, false);
  assert.equal(s.selfCorrectionSignal, "low");
  assert.deepEqual(s.inputModeFit, []);
});

test("computes scratchpad use rate over eligible activities", () => {
  const signals: SurfaceSignal[] = [
    {
      activityId: "a1",
      domain: "math",
      interaction: "geometry_workspace",
      scratchpadUsed: true,
      correct: true,
    },
    {
      activityId: "a2",
      domain: "math",
      interaction: "geometry_workspace",
      scratchpadUsed: false,
      correct: true,
    },
    {
      activityId: "a3",
      domain: "math",
      interaction: "geometry_workspace",
      scratchpadUsed: true,
      correct: false,
    },
    // Not scratchpad-eligible
    { activityId: "a4", domain: "ela", interaction: "choice_grid", correct: true },
  ];
  const s = summariseSurfaceSignals(signals);
  assert.equal(s.scratchpadUseRate, 2 / 3);
});

test("computes hint dependence rate", () => {
  const signals: SurfaceSignal[] = [
    { activityId: "a1", domain: "math", interaction: "scratchpad", hintCount: 0 },
    { activityId: "a2", domain: "math", interaction: "scratchpad", hintCount: 2 },
    { activityId: "a3", domain: "math", interaction: "scratchpad", hintCount: 1 },
    { activityId: "a4", domain: "math", interaction: "scratchpad", hintCount: 0 },
  ];
  const s = summariseSurfaceSignals(signals);
  assert.equal(s.hintDependenceRate, 0.5);
});

test("flags fine-motor concern when drag precision is low", () => {
  const signals: SurfaceSignal[] = [
    { activityId: "a1", domain: "math", interaction: "drag_sort", dragPrecision: 0.4 },
    { activityId: "a2", domain: "math", interaction: "drag_sort", dragPrecision: 0.5 },
  ];
  const s = summariseSurfaceSignals(signals);
  assert.equal(s.fineMotorDragConcern, true);
});

test("self-correction signal goes high when erasures+correctness co-occur", () => {
  const signals: SurfaceSignal[] = [
    { activityId: "a1", domain: "math", interaction: "scratchpad", erasureCount: 2, correct: true },
    { activityId: "a2", domain: "math", interaction: "scratchpad", erasureCount: 1, correct: true },
    { activityId: "a3", domain: "math", interaction: "scratchpad", erasureCount: 1, correct: true },
    { activityId: "a4", domain: "math", interaction: "scratchpad", correct: true },
    { activityId: "a5", domain: "math", interaction: "scratchpad", correct: false },
  ];
  const s = summariseSurfaceSignals(signals);
  assert.equal(s.selfCorrectionSignal, "high");
});

test("emits supportNeeds for high scratchpad use and short attention", () => {
  const signals: SurfaceSignal[] = [
    {
      activityId: "a1",
      domain: "math",
      interaction: "geometry_workspace",
      scratchpadUsed: true,
      correct: true,
    },
    {
      activityId: "a2",
      domain: "math",
      interaction: "geometry_workspace",
      scratchpadUsed: true,
      correct: true,
    },
    { activityId: "a3", domain: "math", interaction: "geometry_workspace", abandoned: true },
    { activityId: "a4", domain: "math", interaction: "geometry_workspace", abandoned: true },
  ];
  const s = summariseSurfaceSignals(signals);
  assert.ok(s.supportNeeds.includes("needs_scratchpad_space"));
  assert.ok(s.supportNeeds.includes("needs_shorter_tasks"));
});
