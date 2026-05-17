/**
 * Tests for the stage `surface-normalizer` helpers.
 *
 * These exercise the contract that a `Beat` is "surface-driven" when
 * either a `surface` is inlined, a `surfaceId` is set, or the legacy
 * `interaction.type` matches one of the surface-aware values
 * (`draw`, `scratchpad`, `geometry_workspace`, `math_expression`).
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  attachSurfacesToBeats,
  isSurfaceBeat,
  resolveBeatSurface,
} from "../../src/components/stage/surface-normalizer.js";
import type { Beat } from "../../src/components/stage/types.js";

const baseSurface = {
  id: "surf1",
  type: "geometry_workspace" as const,
  prompt: "Find the area",
  capture: { finalAnswer: true, inkStrokes: true },
  scoring: { mode: "exact" as const, correctAnswer: 32 },
  accessibility: {
    altText: "Rectangle with sides labeled",
    reduceMotionSafe: true,
    keyboardAlternative: true,
  },
};

const baseBeat: Beat = {
  id: "b1",
  type: "interaction",
  tutorState: "encouraging",
  visuals: [],
};

test("isSurfaceBeat detects inlined surfaces", () => {
  assert.equal(isSurfaceBeat({ ...baseBeat, surface: baseSurface }), true);
});

test("isSurfaceBeat detects surfaceId references", () => {
  assert.equal(isSurfaceBeat({ ...baseBeat, surfaceId: "surf1" }), true);
});

test("isSurfaceBeat treats legacy draw/geometry interactions as surface-driven", () => {
  assert.equal(
    isSurfaceBeat({ ...baseBeat, interaction: { type: "draw", prompt: "Sketch it" } }),
    true,
  );
  assert.equal(
    isSurfaceBeat({
      ...baseBeat,
      interaction: { type: "geometry_workspace", prompt: "Find area" },
    }),
    true,
  );
});

test("isSurfaceBeat returns false for legacy multiple-choice", () => {
  assert.equal(
    isSurfaceBeat({
      ...baseBeat,
      interaction: {
        type: "multiple_choice",
        prompt: "Pick one",
        choices: [{ id: "a", label: "A", isCorrect: true }],
      },
    }),
    false,
  );
});

test("resolveBeatSurface prefers inline surface over dictionary lookup", () => {
  const surfaces = { surf1: { ...baseSurface, prompt: "From dictionary" } };
  const beat = { ...baseBeat, surfaceId: "surf1", surface: baseSurface };
  const resolved = resolveBeatSurface(beat, surfaces);
  assert.equal(resolved?.prompt, "Find the area");
});

test("attachSurfacesToBeats hydrates beats whose surfaceId resolves", () => {
  const beats: Beat[] = [
    { ...baseBeat, id: "b1", surfaceId: "surf1" },
    { ...baseBeat, id: "b2" },
    { ...baseBeat, id: "b3", surfaceId: "missing" },
  ];
  const result = attachSurfacesToBeats(beats, { surf1: baseSurface });
  assert.equal(result[0].surface?.id, "surf1");
  assert.equal(result[1].surface, undefined);
  assert.equal(result[2].surface, undefined);
});
