/**
 * Sprint 12.6 — smoke test for @aivo/scoring.
 *
 * Exercises the public XP / quality / surface-scoring helpers. These
 * functions are the single source of truth for both learning-svc and
 * tutor-svc, so a regression here ripples into every learner's XP
 * meter — worth pinning at least the basic clamping + branch contract.
 */
import { describe, it, expect } from "vitest";
import {
  computeLessonXp,
  computeCompletionQuality,
  scoreSurfaceResponse,
} from "../src/index";

describe("@aivo/scoring smoke", () => {
  it("computeLessonXp produces a value in [0, 100]", () => {
    const xp = computeLessonXp({
      durationSeconds: 600,
      functioningLevel: "STANDARD",
      correctAnswers: 5,
      attemptedAnswers: 6,
      beatsCompleted: 8,
      beatsTotal: 10,
      masteryDelta: 0.2,
    });
    expect(xp).toBeGreaterThanOrEqual(0);
    expect(xp).toBeLessThanOrEqual(100);
  });

  it("computeLessonXp uses the pre-symbolic branch for NON_VERBAL learners", () => {
    const xp = computeLessonXp({
      durationSeconds: 300,
      functioningLevel: "NON_VERBAL",
      engagementBeats: 4,
      masteryDelta: 0.1,
    });
    expect(xp).toBeGreaterThan(0);
    expect(xp).toBeLessThanOrEqual(100);
  });

  it("computeCompletionQuality returns a value in [0, 1] (two decimals)", () => {
    const q = computeCompletionQuality({
      durationSeconds: 900,
      functioningLevel: "STANDARD",
      beatsCompleted: 8,
      beatsTotal: 10,
      correctAnswers: 7,
      attemptedAnswers: 10,
      breaksUsed: 1,
    });
    expect(q).toBeGreaterThanOrEqual(0);
    expect(q).toBeLessThanOrEqual(1);
  });

  it("scoreSurfaceResponse marks an exact-match answer as correct", () => {
    const res = scoreSurfaceResponse(
      { mode: "exact", correctAnswer: "42" },
      { surfaceId: "s1", answer: "42" },
    );
    expect(res.correct).toBe(true);
    expect(res.score).toBe(1);
  });

  it("scoreSurfaceResponse marks a wrong answer as incorrect with feedback", () => {
    const res = scoreSurfaceResponse(
      { mode: "exact", correctAnswer: "42" },
      { surfaceId: "s1", answer: "7" },
    );
    expect(res.correct).toBe(false);
    expect(res.score).toBe(0);
    expect(typeof res.feedback).toBe("string");
    expect(res.feedback.length).toBeGreaterThan(0);
  });
});
