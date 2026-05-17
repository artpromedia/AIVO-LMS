import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildLearnerContext,
  negotiateFunctioningLevel,
  normalizeFunctioningLevel,
} from "../src/lib/learnerContext.js";
import type { TutorDefinition } from "@aivo/tutor-sdk";

const standardTutor: TutorDefinition = {
  id: "x@1.0.0",
  schemaVersion: 1,
  persona: { id: "x", name: "X", tagline: "", voiceStyle: "calm", locale: "en-US" },
  capabilities: ["chat"],
  subjects: ["math"],
  gradeBands: ["K"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL"],
  skillGraphRefs: ["g1"],
  defaultContentPackRefs: [],
  policy: { requiresConsent: false },
};

describe("tutor-svc learnerContext loader", () => {
  it("normalizes missing/unknown functioning levels to STANDARD", () => {
    assert.equal(normalizeFunctioningLevel(null), "STANDARD");
    assert.equal(normalizeFunctioningLevel(undefined), "STANDARD");
    assert.equal(normalizeFunctioningLevel("not-a-level"), "STANDARD");
  });

  it("normalizes case-insensitively for known levels", () => {
    assert.equal(normalizeFunctioningLevel("standard"), "STANDARD");
    assert.equal(normalizeFunctioningLevel("low_verbal"), "LOW_VERBAL");
    assert.equal(normalizeFunctioningLevel("PRE_SYMBOLIC"), "PRE_SYMBOLIC");
  });

  it("requires learnerId", () => {
    assert.throws(() => buildLearnerContext({ learnerId: "" } as any));
  });

  it("returns a context with safe array defaults", () => {
    const ctx = buildLearnerContext({ learnerId: "l1" });
    assert.equal(ctx.learnerId, "l1");
    assert.equal(ctx.functioningLevel, "STANDARD");
    assert.deepEqual(ctx.masteryRecords, []);
    assert.deepEqual(ctx.recentOutcomes, []);
    assert.equal(ctx.recentlyCovered, undefined);
    assert.equal(ctx.interestProfile, undefined);
  });

  it("forwards mastery + outcomes + interest profile", () => {
    const profile = { learnerId: "l1", signals: [] };
    const ctx = buildLearnerContext({
      learnerId: "l1",
      functioningLevel: "SUPPORTED",
      masteryRecords: [
        {
          skillId: "s1",
          mastery: 0.5,
          easeFactor: 2.5,
          streak: 1,
          reps: 1,
          intervalDays: 1,
          lastReviewedAt: null,
          dueAt: null,
        },
      ],
      recentOutcomes: [{ skillId: "s1", correct: true, recordedAt: "2026-01-01T00:00:00Z" }],
      recentlyCovered: ["s1"],
      interestProfile: profile,
    });
    assert.equal(ctx.functioningLevel, "SUPPORTED");
    assert.equal(ctx.masteryRecords.length, 1);
    assert.equal(ctx.recentOutcomes.length, 1);
    assert.deepEqual(ctx.recentlyCovered, ["s1"]);
    assert.equal(ctx.interestProfile, profile);
  });
});

describe("tutor-svc negotiateFunctioningLevel", () => {
  it("returns the requested level when supported", () => {
    assert.equal(negotiateFunctioningLevel("SUPPORTED", standardTutor), "SUPPORTED");
  });

  it("steps down toward more-supportive levels when unsupported", () => {
    // standardTutor does NOT support NON_VERBAL or PRE_SYMBOLIC; the
    // negotiator should walk back up to LOW_VERBAL.
    assert.equal(negotiateFunctioningLevel("NON_VERBAL", standardTutor), "LOW_VERBAL");
    assert.equal(negotiateFunctioningLevel("PRE_SYMBOLIC", standardTutor), "LOW_VERBAL");
  });

  it("falls back to a less-supportive level if no more-supportive one fits", () => {
    const noStandard: TutorDefinition = { ...standardTutor, functioningLevels: ["SUPPORTED"] };
    assert.equal(negotiateFunctioningLevel("STANDARD", noStandard), "SUPPORTED");
  });
});
