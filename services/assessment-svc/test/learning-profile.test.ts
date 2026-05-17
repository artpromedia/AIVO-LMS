/**
 * Unit tests for the pure `deriveLearningProfile` helper. No DB / no
 * Fastify wiring — runs regardless of DATABASE_URL (mirrors the
 * iep-packet test pattern).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveLearningProfile } from "../src/services/learning-profile.js";

test("returns a zero-θ profile for empty input", () => {
  const p = deriveLearningProfile([]);
  assert.equal(p.thetaPlacement, 0);
  assert.equal(p.itemsAdministered, 0);
  assert.deepEqual(p.modalityFit, []);
  assert.equal(p.frustrationTolerance, "high");
});

test("rolls up domain accuracy into modality fit, ranked desc", () => {
  const p = deriveLearningProfile([
    { domain: "math", correct: 9, total: 10, avgLatencyMs: 1200 },          // visual: 0.9
    { domain: "ela", correct: 3, total: 10, avgLatencyMs: 4000 },           // reading: 0.3
    { domain: "speech", correct: 7, total: 10, avgLatencyMs: 2000 },        // auditory: 0.7
    { domain: "science", correct: 5, total: 10, avgLatencyMs: 1800 },       // kinesthetic: 0.5
  ]);
  assert.equal(p.modalityFit[0].modality, "visual");
  assert.equal(p.modalityFit[0].accuracy, 0.9);
  assert.equal(p.modalityFit[p.modalityFit.length - 1].modality, "reading");
  assert.equal(p.itemsAdministered, 40);
});

test("uses per-item latencies (median) when supplied", () => {
  const p = deriveLearningProfile(
    [{ domain: "math", correct: 5, total: 5, avgLatencyMs: 9999 }],
    [800, 900, 1000, 1100, 1200],
  );
  assert.equal(p.processingSpeedMs, 1000);
});

test("falls back to chapter avgLatencyMs when per-item latencies absent", () => {
  const p = deriveLearningProfile([
    { domain: "math", correct: 5, total: 5, avgLatencyMs: 1500 },
    { domain: "ela", correct: 3, total: 5, avgLatencyMs: 4500 },
  ]);
  // Median of [1500, 4500] is rounded mean = 3000.
  assert.equal(p.processingSpeedMs, 3000);
});

test("classifies low frustration tolerance when ≥40% chapters bombed", () => {
  const p = deriveLearningProfile([
    { domain: "math", correct: 1, total: 10 },     // <40% accuracy → frustration
    { domain: "ela", correct: 1, total: 10 },      // <40% accuracy → frustration
    { domain: "science", correct: 9, total: 10 },  // ok
    { domain: "speech", correct: 9, total: 10 },   // ok
    { domain: "sel", correct: 9, total: 10 },      // ok
  ]);
  assert.equal(p.frustrationRate, 2 / 5);
  assert.equal(p.frustrationTolerance, "low");
  assert.equal(p.attentionRunLength, 0);
});

test("classifies high frustration tolerance when no signals fire", () => {
  const p = deriveLearningProfile([
    { domain: "math", correct: 9, total: 10 },
    { domain: "ela", correct: 8, total: 10 },
  ]);
  assert.equal(p.frustrationRate, 0);
  assert.equal(p.frustrationTolerance, "high");
  // No frustration → run length equals total chapters.
  assert.equal(p.attentionRunLength, 2);
});

test("respects an explicit chapter frustrationRate over the accuracy proxy", () => {
  const p = deriveLearningProfile([
    { domain: "math", correct: 9, total: 10, frustrationRate: 0.8 },
    { domain: "ela", correct: 9, total: 10, frustrationRate: 0.7 },
  ]);
  assert.equal(p.frustrationRate, 1);
  assert.equal(p.frustrationTolerance, "low");
});

test("clamps θ to ±2.5", () => {
  const allWrong = deriveLearningProfile([{ domain: "math", correct: 0, total: 10 }]);
  const allRight = deriveLearningProfile([{ domain: "math", correct: 10, total: 10 }]);
  assert.equal(allWrong.thetaPlacement, -2.5);
  assert.equal(allRight.thetaPlacement, 2.5);
});

test("breaks modality-fit ties by n then by canonical order", () => {
  const p = deriveLearningProfile([
    { domain: "math", correct: 5, total: 10 },     // visual: 0.5, n=10
    { domain: "speech", correct: 10, total: 20 },  // auditory: 0.5, n=20
  ]);
  // Same accuracy → larger n wins (auditory n=20 vs visual n=10).
  assert.equal(p.modalityFit[0].modality, "auditory");
});
