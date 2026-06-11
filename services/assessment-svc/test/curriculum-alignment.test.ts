/**
 * Pure tests for the baseline → curriculum_alignment placement policy
 * (adaptive-learning E2E Sprint 2). No DB / no Fastify, mirroring the
 * adaptive-baseline-runner pattern.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBaselineAlignmentPatch } from "../src/services/curriculum-alignment.js";

test("derives grade_band from the learner's gradeLevel when alignment has none", () => {
  const r = buildBaselineAlignmentPatch({
    currentAlignment: { framework: "CCSS", districtId: "d-1" },
    gradeLevel: "5",
    theta: -0.5,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.patch.gradeBand, "5");
  // θ -0.5 ⇒ two bands below grade 5.
  assert.equal(r.patch.deliveryLevel, "3");
  assert.equal(r.patch.alignment.grade_band, "5");
  assert.equal(r.patch.alignment.delivery_level, "3");
  assert.equal(r.patch.alignment.delivery_level_source, "baseline_theta");
  // Existing alignment keys are preserved, not clobbered.
  assert.equal(r.patch.alignment.framework, "CCSS");
  assert.equal(r.patch.alignment.districtId, "d-1");
});

test("prefers an already-set alignment grade_band over the raw gradeLevel column", () => {
  const r = buildBaselineAlignmentPatch({
    currentAlignment: { grade_band: "4" },
    gradeLevel: "garbage-value",
    theta: 0.5,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.patch.gradeBand, "4");
  assert.equal(r.patch.deliveryLevel, "4"); // on grade at θ ≥ 0.4
});

test("normalizes messy grade strings", () => {
  const r = buildBaselineAlignmentPatch({
    currentAlignment: {},
    gradeLevel: "Grade 3",
    theta: 0.0,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.patch.gradeBand, "3");
  assert.equal(r.patch.deliveryLevel, "2"); // one band below
});

test("clamps delivery level at K", () => {
  const r = buildBaselineAlignmentPatch({
    currentAlignment: {},
    gradeLevel: "1",
    theta: -2.5,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.patch.deliveryLevel, "K");
});

test("returns a typed failure when the grade band is unresolvable — no defaulting", () => {
  const r = buildBaselineAlignmentPatch({
    currentAlignment: {},
    gradeLevel: null,
    theta: 0.0,
  });
  assert.equal(r.ok, false);
  if (r.ok) return;
  assert.equal(r.reason, "grade_band_unresolvable");
  assert.equal(r.rawGradeLevel, null);
});

test("tolerates a non-object currentAlignment (legacy rows)", () => {
  const r = buildBaselineAlignmentPatch({
    currentAlignment: null,
    gradeLevel: "8",
    theta: 1.0,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.patch.alignment.grade_band, "8");
  assert.equal(r.patch.alignment.delivery_level, "8");
});

test("records the theta and a timestamp for auditability", () => {
  const now = new Date("2026-06-10T12:00:00.000Z");
  const r = buildBaselineAlignmentPatch({
    currentAlignment: {},
    gradeLevel: "6",
    theta: -0.4,
    now,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.patch.alignment.delivery_level_theta, -0.4);
  assert.equal(r.patch.alignment.delivery_level_updated_at, now.toISOString());
});
