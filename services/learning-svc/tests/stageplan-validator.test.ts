/**
 * Tests for the StagePlan validator. Generated lessons missing
 * accessibility or geometry data must never be served to learners.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validateStagePlan } from "../src/services/stageplan-validator.js";

const validGeometrySurface = {
  id: "surf-geo-1",
  type: "geometry_workspace",
  prompt: "Find the area",
  diagram: {
    canvasMode: "svg",
    shapes: [{ id: "rect1", kind: "rectangle", x: 0, y: 0, width: 320, height: 180 }],
  },
  capture: { finalAnswer: true, inkStrokes: true },
  scoring: { mode: "exact", correctAnswer: 32 },
  accessibility: {
    altText: "A rectangle labeled 8 cm by 4 cm",
    reduceMotionSafe: true,
    keyboardAlternative: true,
  },
  scratchpad: { enabled: true },
};

const validPlan = {
  id: "plan-1",
  title: "Geometry: Area of a Rectangle",
  objective: "Compute the area of a rectangle given side lengths.",
  subject: "math",
  topic: "area_rectangle",
  beats: [
    { id: "b1", type: "narration", narration: "Today we explore area." },
    { id: "b2", type: "interaction", surfaceId: "surf-geo-1" },
    { id: "b3", type: "celebration" },
  ],
  surfaces: { "surf-geo-1": validGeometrySurface },
  masteryTargets: [],
  accommodationsApplied: [],
  safetyChecks: [],
};

test("validateStagePlan accepts a complete geometry plan", () => {
  const result = validateStagePlan(validPlan);
  assert.equal(result.valid, true, JSON.stringify(result.issues));
});

test("rejects plan with unresolved surfaceId", () => {
  const broken = JSON.parse(JSON.stringify(validPlan));
  broken.beats[1].surfaceId = "missing";
  const result = validateStagePlan(broken);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "unresolved_surface_id"));
});

test("rejects geometry surface without shapes", () => {
  const broken = JSON.parse(JSON.stringify(validPlan));
  broken.surfaces["surf-geo-1"].diagram.shapes = [];
  const result = validateStagePlan(broken);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "geometry_missing_shapes"));
});

test("rejects narration containing raw HTML or scripts", () => {
  const broken = JSON.parse(JSON.stringify(validPlan));
  broken.beats[0].narration = "Welcome <script>alert(1)</script>";
  const result = validateStagePlan(broken);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "script_tag"));
});

test("rejects long narration for low-verbal learners", () => {
  const broken = JSON.parse(JSON.stringify(validPlan));
  broken.beats[0].narration = "Hello! ".repeat(60);
  const result = validateStagePlan(broken, { functioningLevel: "LOW_VERBAL" });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "narration_too_long_for_low_verbal"));
});

test("rejects duplicate beat ids", () => {
  const broken = JSON.parse(JSON.stringify(validPlan));
  broken.beats[1].id = "b1";
  const result = validateStagePlan(broken);
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "duplicate_beat_id"));
});

// ── Sprint C — subject-brain evidence requirements ────────────────────────

test("requireSubjectBrainEvidence: rejects plan with no evidence field", () => {
  const result = validateStagePlan(validPlan, { requireSubjectBrainEvidence: true });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "missing_subject_brain_evidence"));
});

test("requireSubjectBrainEvidence: rejects empty evidence object", () => {
  const withEmptyEvidence = JSON.parse(JSON.stringify(validPlan));
  withEmptyEvidence.subjectBrainEvidenceUsed = { relevantSkills: [], standards: [] };
  const result = validateStagePlan(withEmptyEvidence, {
    requireSubjectBrainEvidence: true,
  });
  assert.equal(result.valid, false);
  assert.ok(result.issues.some((i) => i.code === "empty_subject_brain_evidence"));
});

test("requireSubjectBrainEvidence: accepts evidence with at least one skill", () => {
  const withSkill = JSON.parse(JSON.stringify(validPlan));
  withSkill.subjectBrainEvidenceUsed = {
    relevantSkills: ["MATH.GEOM.AREA"],
    standards: [],
    misconceptionRisks: [],
  };
  const result = validateStagePlan(withSkill, { requireSubjectBrainEvidence: true });
  assert.equal(
    result.issues.some((i) => i.code.startsWith("subject_brain")),
    false,
  );
});

test("requireSubjectBrainEvidence: accepts evidence with only standards (no skills)", () => {
  const withStandards = JSON.parse(JSON.stringify(validPlan));
  withStandards.subjectBrainEvidenceUsed = {
    relevantSkills: [],
    standards: [{ framework: "CCSS", code: "3.MD.7" }],
  };
  const result = validateStagePlan(withStandards, {
    requireSubjectBrainEvidence: true,
  });
  assert.equal(
    result.issues.some((i) => i.code === "empty_subject_brain_evidence"),
    false,
  );
});
