/**
 * Grade-target resolution for lesson generation (adaptive-learning E2E
 * Sprint 2). Pins the no-hardcoded-grade contract: alignment → grade_level
 * fallback → typed failure. The old behavior (`|| "THIRD"`) silently
 * generated every learner's lessons at third grade.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveGradeTargets } from "../src/services/grade-target.js";

test("uses alignment grade_band + delivery_level when both present", () => {
  const r = resolveGradeTargets({
    alignment: { grade_band: "5", delivery_level: "3", delivery_level_source: "baseline_theta" },
    learnerGradeLevel: "5",
  });
  assert.deepEqual(r, { ok: true, gradeTarget: "5", deliveryLevel: "3", source: "alignment" });
});

test("delivers at the enrolled grade when alignment has no placement yet", () => {
  const r = resolveGradeTargets({ alignment: { grade_band: "4" }, learnerGradeLevel: null });
  assert.deepEqual(r, {
    ok: true,
    gradeTarget: "4",
    deliveryLevel: "4",
    source: "alignment_partial",
  });
});

test("falls back to learners.grade_level for pre-alignment learners", () => {
  const r = resolveGradeTargets({ alignment: {}, learnerGradeLevel: "Grade 7" });
  assert.deepEqual(r, {
    ok: true,
    gradeTarget: "7",
    deliveryLevel: "7",
    source: "grade_level_fallback",
  });
});

test("normalizes messy alignment values", () => {
  const r = resolveGradeTargets({
    alignment: { grade_band: "grade 5", delivery_level: "3rd" },
    learnerGradeLevel: null,
  });
  assert.deepEqual(r, { ok: true, gradeTarget: "5", deliveryLevel: "3", source: "alignment" });
});

test("returns a typed failure when nothing resolves — never a constant", () => {
  for (const alignment of [undefined, null, {}, { framework: "CCSS" }]) {
    const r = resolveGradeTargets({ alignment, learnerGradeLevel: null });
    assert.deepEqual(r, { ok: false, reason: "grade_unresolvable" });
  }
  const r = resolveGradeTargets({ alignment: {}, learnerGradeLevel: "not-a-grade" });
  assert.deepEqual(r, { ok: false, reason: "grade_unresolvable" });
});

test("kindergarten round-trips", () => {
  const r = resolveGradeTargets({
    alignment: { grade_band: "K", delivery_level: "K" },
    learnerGradeLevel: null,
  });
  assert.deepEqual(r, { ok: true, gradeTarget: "K", deliveryLevel: "K", source: "alignment" });
});

// ── Wave C (G1): per-subject delivery levels ───────────────────────────────

test("subject band from delivery_levels wins over the global delivery_level", () => {
  const r = resolveGradeTargets({
    alignment: {
      grade_band: "5",
      delivery_level: "4",
      delivery_levels: { math: "2", reading: "5" },
    },
    learnerGradeLevel: null,
    subject: "Mathematics", // brand tutor domain — canonicalises to "math"
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.gradeTarget, "5");
  assert.equal(r.deliveryLevel, "2");
  assert.equal(r.source, "alignment_subject");
});

test("a subject without its own band falls back to the global delivery_level", () => {
  const r = resolveGradeTargets({
    alignment: {
      grade_band: "5",
      delivery_level: "4",
      delivery_levels: { math: "2" },
    },
    learnerGradeLevel: null,
    subject: "Science",
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.deliveryLevel, "4");
  assert.equal(r.source, "alignment");
});

test("no subject argument keeps the legacy global resolution untouched", () => {
  const r = resolveGradeTargets({
    alignment: { grade_band: "5", delivery_level: "3", delivery_levels: { math: "2" } },
    learnerGradeLevel: null,
  });
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.deliveryLevel, "3");
  assert.equal(r.source, "alignment");
});
