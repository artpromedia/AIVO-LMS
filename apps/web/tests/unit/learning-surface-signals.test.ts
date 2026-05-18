/**
 * Tests for the surface-signal builder used by the discovery
 * completion + lesson completion payloads.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSurfaceSignal } from "../../src/lib/learning-surface-signals.js";

test("counts ink strokes, erasures, tool changes, and latency", () => {
  const signal = buildSurfaceSignal({
    activityId: "a1",
    domain: "math",
    interaction: "geometry_workspace",
    response: {
      surfaceId: "s1",
      answer: 32,
      inkStrokes: [
        { id: "1", tool: "pencil", points: [], width: 2, createdAt: "2024-01-01T00:00:00Z" },
        { id: "2", tool: "eraser", points: [], width: 8, createdAt: "2024-01-01T00:00:01Z" },
      ],
    },
    events: [
      {
        id: "e1",
        surfaceId: "s1",
        type: "surface_started",
        occurredAt: "2024-01-01T00:00:00.000Z",
      },
      {
        id: "e2",
        surfaceId: "s1",
        type: "tool_changed",
        occurredAt: "2024-01-01T00:00:01.000Z",
        payload: { tool: "eraser" },
      },
      { id: "e3", surfaceId: "s1", type: "ink_undo", occurredAt: "2024-01-01T00:00:02.000Z" },
      {
        id: "e4",
        surfaceId: "s1",
        type: "surface_submitted",
        occurredAt: "2024-01-01T00:00:05.000Z",
      },
    ],
    correct: true,
  });

  assert.equal(signal.inkStrokeCount, 2);
  assert.equal(signal.erasureCount, 2); // 1 eraser stroke + 1 undo
  assert.equal(signal.toolChangeCount, 1);
  assert.equal(signal.scratchpadUsed, true);
  assert.equal(signal.latencyMs, 5000);
});

test("handles minimal input without crashing", () => {
  const signal = buildSurfaceSignal({
    activityId: "a2",
    domain: "math",
    interaction: "choice_grid",
    response: { surfaceId: "s2", selectedChoiceId: "a" },
    events: [],
    correct: false,
  });
  assert.equal(signal.inkStrokeCount, 0);
  assert.equal(signal.scratchpadUsed, false);
  assert.equal(signal.finalAnswer, "a");
});
