/**
 * Tests for the web `stageplan-normalizer`. The normalizer must
 * never silently swap in demo content — invalid payloads return
 * `valid: false` with a reason so the lesson page can render a
 * recoverable error.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeStagePlan } from "../../src/components/stage/stageplan-normalizer.js";

const validSurface = {
  id: "surf-geo-1",
  type: "geometry_workspace" as const,
  prompt: "Find the area",
  diagram: { canvasMode: "svg" as const, shapes: [{ id: "rect1", kind: "rectangle" as const, x: 0, y: 0, width: 200, height: 100 }] },
  capture: { finalAnswer: true, inkStrokes: true },
  scoring: { mode: "exact" as const, correctAnswer: 32 },
  accessibility: { altText: "rect", reduceMotionSafe: true, keyboardAlternative: true },
};

test("normalizeStagePlan accepts a generated plan and attaches surfaces", () => {
  const result = normalizeStagePlan({
    title: "Geometry",
    objective: "Compute area",
    beats: [
      { id: "b1", type: "narration", tutorState: "speaking", narration: "Hi", visuals: [] },
      { id: "b2", type: "interaction", tutorState: "encouraging", surfaceId: "surf-geo-1", visuals: [] },
    ],
    surfaces: { "surf-geo-1": validSurface },
  });
  assert.equal(result.valid, true);
  assert.equal(result.source, "generated");
  assert.equal(result.beats.length, 2);
  assert.equal(result.beats[1].surface?.id, "surf-geo-1");
});

test("returns valid=false for missing payload", () => {
  const result = normalizeStagePlan(null);
  assert.equal(result.valid, false);
  assert.equal(result.reason, "missing_payload");
});

test("returns valid=false when beats are missing", () => {
  const result = normalizeStagePlan({ title: "x", objective: "y" });
  assert.equal(result.valid, false);
  assert.equal(result.reason, "no_beats_or_lesson_text");
});

test("legacy lesson text is wrapped into a narration beat with source legacy_normalized", () => {
  const result = normalizeStagePlan({ title: "x", objective: "y", lessonText: "Hello world" });
  assert.equal(result.valid, true);
  assert.equal(result.source, "legacy_normalized");
  assert.equal(result.beats.length, 1);
  assert.equal(result.beats[0].type, "narration");
});
