/**
 * Sprint 3 — baseline-fallback service tests.
 *
 * Confirms the service wraps the item-bank fallback bank into the
 * exact response shape the route layer ships to the parent UI:
 *
 *   - 7 subjects × 6 items = 42 questions
 *   - source: "fallback" + fallbackReason populated
 *   - learnerId / functioningLevel echoed
 *   - subjects taxonomy matches the ai-svc SUBJECTS constant so the
 *     existing parent UI rendering is unchanged
 *   - normaliseGradeBand handles the noisy inputs that arrive from
 *     district enrollment data
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildBaselineFallback,
  normaliseGradeBand,
} from "../src/services/baseline-fallback.js";

test("buildBaselineFallback returns 42 questions with correct shape", () => {
  const out = buildBaselineFallback({
    learnerId: "lr-test-1",
    gradeLevel: "3",
    functioningLevel: "STANDARD",
    reason: "ai_unreachable",
  });
  assert.equal(out.source, "fallback");
  assert.equal(out.model, "fallback-bank");
  assert.equal(out.fallbackReason, "ai_unreachable");
  assert.equal(out.functioningLevel, "STANDARD");
  assert.equal(out.questions.length, 42);
  // Every question carries the required AI-baseline fields so the
  // existing frontend zod schema accepts the payload.
  for (const q of out.questions) {
    assert.ok(q.id);
    assert.ok(q.questionText);
    assert.ok(Array.isArray(q.options) && q.options.length >= 2);
    assert.ok(q.options.find((o) => o.value === q.correctAnswer));
  }
});

test("buildBaselineFallback covers all 7 subjects with 6 items each", () => {
  const out = buildBaselineFallback({
    learnerId: "lr-test-2",
    gradeLevel: "5",
    reason: "ai_non_2xx",
  });
  const counts = new Map<string, number>();
  for (const q of out.questions) {
    counts.set(q.subject, (counts.get(q.subject) ?? 0) + 1);
  }
  for (const subject of [
    "math", "ela", "science", "speech", "sel", "life_skills", "executive_function",
  ]) {
    assert.equal(counts.get(subject), 6, `${subject} missing items`);
  }
});

test("buildBaselineFallback subjects taxonomy includes the 7 required keys", () => {
  const out = buildBaselineFallback({
    learnerId: "lr-test-3",
    reason: "ai_invalid_json",
  });
  const keys = out.subjects.map((s) => s.key);
  assert.deepEqual(
    keys,
    ["math", "ela", "science", "speech", "sel", "life_skills", "executive_function"],
  );
});

test("buildBaselineFallback is deterministic per learnerId", () => {
  const a = buildBaselineFallback({ learnerId: "stable-learner", reason: "ai_unreachable" });
  const b = buildBaselineFallback({ learnerId: "stable-learner", reason: "ai_unreachable" });
  assert.deepEqual(
    a.questions.map((q) => q.id),
    b.questions.map((q) => q.id),
  );
});

test("buildBaselineFallback degrades gracefully without grade level", () => {
  const out = buildBaselineFallback({
    learnerId: "lr-no-grade",
    gradeLevel: null,
    reason: "ai_too_few_questions",
  });
  assert.equal(out.questions.length, 42);
});

test("normaliseGradeBand handles common shapes", () => {
  assert.equal(normaliseGradeBand("K"), "K");
  assert.equal(normaliseGradeBand("Kindergarten"), "K");
  assert.equal(normaliseGradeBand("PK"), "PK");
  assert.equal(normaliseGradeBand("Pre-K"), "PK");
  assert.equal(normaliseGradeBand("3"), "3");
  assert.equal(normaliseGradeBand("3rd"), "3");
  assert.equal(normaliseGradeBand("third"), "3");
  assert.equal(normaliseGradeBand("Grade 8"), "8");
  assert.equal(normaliseGradeBand(""), null);
  assert.equal(normaliseGradeBand(null), null);
  assert.equal(normaliseGradeBand("college"), null);
});
