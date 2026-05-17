/**
 * Tests for the tutor surface command normalizer used by
 * `TutorSurfaceCommandRenderer`. We test the pure normalizer rather than
 * mounting the React component so the suite runs under Node's test runner
 * without a DOM.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTutorSurfaceCommands,
  type NormalizeResult,
} from "../tutor-surface-command-normalizer";
import { buildGeometryCommand, buildScratchpadCommand } from "@aivo/tutor-surface-protocol";

test("normalizer accepts a valid geometry command and marks it renderable", () => {
  const command = buildGeometryCommand({
    id: "cmd-1",
    surfaceId: "surf-1",
    reason: "Geometry task",
    prompt: "Find the area",
    altText: "Rectangle 8 by 4",
    shapes: [{ id: "r1", kind: "rectangle" }],
  });
  const result: NormalizeResult = normalizeTutorSurfaceCommands([command]);
  assert.equal(result.normalized.length, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(result.normalized[0].renderable, true);
});

test("normalizer rejects malformed commands without crashing", () => {
  const result = normalizeTutorSurfaceCommands([null, { not: "a command" }, 42]);
  assert.equal(result.normalized.length, 0);
  assert.equal(result.rejected.length, 3);
});

test("normalizer drops raw HTML injection but keeps other valid commands", () => {
  const bad = buildScratchpadCommand({
    id: "bad",
    surfaceId: "s-bad",
    reason: "<script>alert(1)</script>",
    prompt: "p",
    altText: "Scratchpad",
  });
  const good = buildScratchpadCommand({
    id: "good",
    surfaceId: "s-good",
    reason: "Show work",
    prompt: "Add 12 + 13",
    altText: "Scratchpad",
  });
  const result = normalizeTutorSurfaceCommands([bad, good]);
  assert.equal(result.normalized.length, 1);
  assert.equal(result.normalized[0].command.id, "good");
  assert.equal(result.rejected.length, 1);
  assert.ok(result.rejected[0].issues.some((issue) => issue.code === "unsafe_markup"));
});

test("normalizer blocks speech-required command for non-verbal profile", () => {
  const command = buildScratchpadCommand({
    id: "cmd-1",
    surfaceId: "surf-1",
    reason: "answer please",
    prompt: "say it",
    altText: "Scratchpad",
  });
  command.commandType = "collect_answer";
  const result = normalizeTutorSurfaceCommands([command], {
    functioningLevel: "NON_VERBAL",
    speechAvailable: false,
  });
  assert.equal(result.normalized.length, 0);
  assert.equal(result.rejected.length, 1);
});

test("normalizer returns empty result when commands is not an array", () => {
  const result = normalizeTutorSurfaceCommands("nope");
  assert.deepEqual(result, { normalized: [], rejected: [] });
});
