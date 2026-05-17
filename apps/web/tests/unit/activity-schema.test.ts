/**
 * Tests for the discovery `activity-schema` runtime validator. The
 * backend has a parallel TypeScript validator and a Python validator
 * in ai-svc; this layer is the second line of defense for items that
 * slip through.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  validateDiscoveryActivities,
  validateDiscoveryActivity,
} from "../../src/components/discovery/activity-schema.js";

const validGeometry = {
  id: "math_geometry_area_rectangle_01",
  domain: "math",
  difficulty: "medium" as const,
  interaction: "geometry_workspace" as const,
  prompt: "Find the area of the rectangle.",
  surface: {
    id: "surf-geo-1",
    type: "geometry_workspace" as const,
    prompt: "Find the area of the rectangle.",
    diagram: {
      canvasMode: "svg" as const,
      shapes: [
        { id: "rect1", kind: "rectangle" as const, x: 100, y: 80, width: 320, height: 180 },
      ],
    },
    capture: { finalAnswer: true, inkStrokes: true },
    scoring: { mode: "exact" as const, correctAnswer: 32 },
    accessibility: {
      altText: "A rectangle labeled 8 cm by 4 cm",
      reduceMotionSafe: true,
      keyboardAlternative: true,
    },
  },
};

test("validateDiscoveryActivity accepts a well-formed geometry activity", () => {
  const result = validateDiscoveryActivity(validGeometry);
  assert.equal(result.ok, true);
});

test("validateDiscoveryActivity rejects geometry without alt text", () => {
  const broken = JSON.parse(JSON.stringify(validGeometry));
  broken.surface.accessibility.altText = "";
  const result = validateDiscoveryActivity(broken);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /altText/);
  }
});

test("validateDiscoveryActivity rejects geometry with empty diagram", () => {
  const broken = JSON.parse(JSON.stringify(validGeometry));
  broken.surface.diagram.shapes = [];
  const result = validateDiscoveryActivity(broken);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /shape/);
  }
});

test("validateDiscoveryActivity rejects draw activity without ink capture", () => {
  const draw = {
    id: "draw1",
    domain: "math",
    difficulty: "easy" as const,
    interaction: "draw" as const,
    prompt: "Draw a line",
    surface: {
      id: "surf-draw-1",
      type: "scratchpad" as const,
      prompt: "Draw a line",
      capture: { finalAnswer: true, inkStrokes: false },
      scoring: { mode: "process" as const },
      accessibility: { altText: "blank surface", reduceMotionSafe: true, keyboardAlternative: true },
    },
  };
  const result = validateDiscoveryActivity(draw);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /inkStrokes/);
  }
});

test("validateDiscoveryActivity rejects unsupported interaction", () => {
  const result = validateDiscoveryActivity({
    id: "x1",
    domain: "math",
    difficulty: "easy",
    // @ts-expect-error - invalid interaction
    interaction: "totally_made_up",
    prompt: "What",
  });
  assert.equal(result.ok, false);
});

test("validateDiscoveryActivities partitions valid and rejected items", () => {
  const broken = JSON.parse(JSON.stringify(validGeometry));
  broken.id = undefined;
  const out = validateDiscoveryActivities([validGeometry, broken]);
  assert.equal(out.validActivities.length, 1);
  assert.equal(out.rejectedActivities.length, 1);
  assert.match(out.rejectedActivities[0].reason, /id/);
});
