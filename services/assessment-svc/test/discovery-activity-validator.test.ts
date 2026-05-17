/**
 * Tests for the backend `discovery-activity-validator`. This sits at
 * the boundary between ai-svc and the learner — geometry items
 * missing alt text or shapes must never reach the client.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  partitionChapterActivitiesPayload,
  partitionDiscoveryActivities,
  validateDiscoveryActivity,
} from "../src/services/discovery-activity-validator.js";

const validGeometry = {
  id: "math_geometry_area_rectangle_01",
  domain: "math",
  difficulty: "medium",
  interaction: "geometry_workspace",
  prompt: "Find the area of the rectangle.",
  feedbackMode: "delayed_after_item",
  brainMeasures: ["geometry_reasoning", "scratchpad_use"],
  scoring: { mode: "exact", correctAnswer: 32 },
  surface: {
    id: "surf-geo-1",
    type: "geometry_workspace",
    prompt: "Find the area of the rectangle.",
    diagram: { canvasMode: "svg", shapes: [{ id: "rect1", kind: "rectangle", x: 0, y: 0, width: 320, height: 180 }] },
    capture: { finalAnswer: true, inkStrokes: true },
    scoring: { mode: "exact", correctAnswer: 32 },
    accessibility: {
      altText: "A rectangle labeled 8 cm by 4 cm",
      reduceMotionSafe: true,
      keyboardAlternative: true,
    },
  },
};

test("validateDiscoveryActivity accepts a complete geometry activity", () => {
  const result = validateDiscoveryActivity(validGeometry);
  assert.equal(result.ok, true);
});

test("rejects geometry without alt text", () => {
  const broken = JSON.parse(JSON.stringify(validGeometry));
  broken.surface.accessibility.altText = "";
  const result = validateDiscoveryActivity(broken);
  assert.equal(result.ok, false);
});

test("rejects geometry without shapes", () => {
  const broken = JSON.parse(JSON.stringify(validGeometry));
  broken.surface.diagram.shapes = [];
  const result = validateDiscoveryActivity(broken);
  assert.equal(result.ok, false);
});

test("rejects draw activity without ink capture", () => {
  const draw = {
    id: "d1",
    domain: "math",
    difficulty: "easy",
    interaction: "draw",
    prompt: "Draw a line",
    feedbackMode: "delayed_after_item",
    brainMeasures: ["fine_motor"],
    scoring: { mode: "process" },
    surface: {
      id: "surf-d-1",
      type: "scratchpad",
      prompt: "Draw a line",
      capture: { finalAnswer: true, inkStrokes: false },
      scoring: { mode: "process" },
      accessibility: { altText: "blank surface", reduceMotionSafe: true, keyboardAlternative: true },
    },
  };
  const result = validateDiscoveryActivity(draw);
  assert.equal(result.ok, false);
});

test("rejects unsupported feedback mode", () => {
  const broken = JSON.parse(JSON.stringify(validGeometry));
  broken.feedbackMode = "yell_at_them";
  const result = validateDiscoveryActivity(broken);
  assert.equal(result.ok, false);
});

test("partitionDiscoveryActivities splits valid and rejected", () => {
  const broken = JSON.parse(JSON.stringify(validGeometry));
  broken.id = undefined;
  const out = partitionDiscoveryActivities([validGeometry, broken]);
  assert.equal(out.validActivities.length, 1);
  assert.equal(out.rejectedActivities.length, 1);
});

test("partitionChapterActivitiesPayload handles tiered chapter shape", () => {
  const out = partitionChapterActivitiesPayload({
    easy: [validGeometry],
    medium: [{ id: "x", domain: "math" }],
    hard: [],
  });
  assert.equal(out.totalValid, 1);
  assert.equal(out.activities.easy.length, 1);
  assert.equal(out.activities.medium.length, 0);
  assert.equal(out.rejectedActivities.length, 1);
  assert.match(out.rejectedActivities[0].reason, /^medium:/);
});
