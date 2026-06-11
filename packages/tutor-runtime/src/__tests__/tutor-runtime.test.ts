import { describe, it, expect } from "vitest";
import {
  planSession,
  checkPolicy,
  applyOutcome,
  TutorPolicyError,
  type LearnerContext,
} from "../index.js";
import { defineTutor, type TutorDefinition, NO_MEMORY, standardActionPolicy } from "@aivo/tutor-sdk";
import type { ContentPack } from "@aivo/content-pack";
import { initialMasteryRecord } from "@aivo/pedagogy";

const tutor: TutorDefinition = defineTutor({
  id: "math-coach@1.0.0",
  schemaVersion: 1,
  persona: {
    id: "math-coach",
    name: "Coach",
    tagline: "Let's count together.",
    voiceStyle: "calm",
    locale: "en-US",
  },
  capabilities: ["chat"],
  subjects: ["math"],
  gradeBands: ["K", "1", "2"],
  functioningLevels: ["STANDARD", "SUPPORTED", "LOW_VERBAL"],
  skillGraphRefs: ["ccss.math.k.cc"],
  defaultContentPackRefs: ["k-math-fall-2026"],
  // Wave E (S8): required agent-policy fields.
  toolset: ["get_learner_snapshot"],
  actionPolicy: standardActionPolicy(),
  memoryPolicy: NO_MEMORY,
  policy: { requiresConsent: false, requirePiiScrubbing: true },
});

const pack: ContentPack = {
  id: "k-math-fall-2026",
  title: "K Math Fall 2026",
  version: "1.0.0",
  schemaVersion: 1,
  subject: "math",
  gradeBand: "K",
  skillGraphRefs: ["ccss.math.k.cc"],
  publisher: { name: "AIVO" },
  license: "Proprietary",
  publishedAt: "2026-08-01T00:00:00Z",
  assets: [],
  activities: [
    {
      id: "a-count-1",
      title: "Count to 1",
      skillId: "ccss.math.k.cc.a.1",
      type: "tap",
      prompt: "Tap once.",
      difficulty: "intro",
      choices: [{ id: "ok", label: "OK", correct: true }],
    },
    {
      id: "a-count-1b",
      title: "Count to 1 (core)",
      skillId: "ccss.math.k.cc.a.1",
      type: "multiple_choice",
      prompt: "Which is one?",
      difficulty: "core",
      choices: [
        { id: "1", label: "1", correct: true },
        { id: "2", label: "2", correct: false },
      ],
    },
    {
      id: "a-count-2",
      title: "Count to 2",
      skillId: "ccss.math.k.cc.a.2",
      type: "tap",
      prompt: "Tap two.",
      difficulty: "core",
      choices: [
        { id: "1", label: "1", correct: false },
        { id: "2", label: "2", correct: true },
      ],
    },
    {
      id: "a-count-3",
      title: "Count to 3",
      skillId: "ccss.math.k.cc.a.3",
      type: "tap",
      prompt: "Tap three.",
      difficulty: "core",
      choices: [
        { id: "2", label: "2", correct: false },
        { id: "3", label: "3", correct: true },
      ],
    },
  ],
};

const baseCtx: LearnerContext = {
  learnerId: "l-1",
  functioningLevel: "STANDARD",
  masteryRecords: [],
  recentOutcomes: [],
};

describe("planSession", () => {
  it("plans new-skill activities for a learner with no mastery records", () => {
    const plan = planSession(tutor, baseCtx, pack, { maxActivities: 4, rng: () => 0 });
    expect(plan.activities.length).toBeGreaterThan(0);
    expect(plan.activities.length).toBeLessThanOrEqual(4);
    // Every activity in the plan must come from a skill we declared.
    for (const a of plan.activities) {
      expect(a.skillId).toMatch(/^ccss\.math\.k\.cc\./);
    }
    // Every rationale row must mention "new-skill" since mastery is empty.
    expect(plan.rationale.every((r) => r.reason.startsWith("new-skill"))).toBe(true);
  });

  it("includes retrieval-practice for previously-mastered skills", () => {
    const ctx: LearnerContext = {
      ...baseCtx,
      masteryRecords: [
        {
          ...initialMasteryRecord("ccss.math.k.cc.a.1"),
          mastery: 0.8,
          reps: 3,
          intervalDays: 14,
          lastReviewedAt: new Date(Date.now() - 30 * 86_400_000).toISOString(),
        },
      ],
    };
    const plan = planSession(tutor, ctx, pack, { maxActivities: 4, rng: () => 0 });
    const reasons = plan.rationale.map((r) => r.reason);
    expect(reasons.some((r) => r.startsWith("retrieval-practice"))).toBe(true);
  });

  it("transforms activities to the learner's functioning level", () => {
    const plan = planSession(tutor, { ...baseCtx, functioningLevel: "LOW_VERBAL" }, pack, {
      maxActivities: 2,
      rng: () => 0,
    });
    for (const a of plan.activities) {
      expect(a.tags).toContain("level:low_verbal");
      expect(a.adaptations?.maxOnScreenChoices).toBeLessThanOrEqual(2);
    }
  });

  it("rejects an unsupported functioning level", () => {
    expect(() =>
      planSession(tutor, { ...baseCtx, functioningLevel: "PRE_SYMBOLIC" }, pack),
    ).toThrow(TutorPolicyError);
  });

  it("refuses a session whose grade band is `scaffold` in coverageMatrix", () => {
    const tutorWithMatrix: TutorDefinition = defineTutor({
      ...tutor,
      coverageMatrix: { K: "authored", "1": "scaffold", "2": "missing" },
    });
    try {
      planSession(tutorWithMatrix, { ...baseCtx, gradeBand: "1" }, pack);
      throw new Error("expected planSession to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TutorPolicyError);
      expect((e as TutorPolicyError).code).toBe("grade_band_not_production");
    }
    try {
      planSession(tutorWithMatrix, { ...baseCtx, gradeBand: "2" }, pack);
      throw new Error("expected planSession to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TutorPolicyError);
      expect((e as TutorPolicyError).code).toBe("grade_band_not_production");
    }
  });

  it("refuses a session whose grade band is outside the catalog scope", () => {
    try {
      planSession(tutor, { ...baseCtx, gradeBand: "9" }, pack);
      throw new Error("expected planSession to throw");
    } catch (e) {
      expect(e).toBeInstanceOf(TutorPolicyError);
      expect((e as TutorPolicyError).code).toBe("grade_band_not_in_scope");
    }
  });

  it("allows a session for an authored band", () => {
    const tutorWithMatrix: TutorDefinition = defineTutor({
      ...tutor,
      coverageMatrix: { K: "authored", "1": "scaffold", "2": "missing" },
    });
    const plan = planSession(tutorWithMatrix, { ...baseCtx, gradeBand: "K" }, pack, {
      maxActivities: 2,
      rng: () => 0,
    });
    expect(plan.activities.length).toBeGreaterThan(0);
  });

  it("permits a scaffold band when opts.allowScaffold is set (preview mode)", () => {
    const tutorWithMatrix: TutorDefinition = defineTutor({
      ...tutor,
      coverageMatrix: { K: "authored", "1": "scaffold", "2": "missing" },
    });
    const plan = planSession(tutorWithMatrix, { ...baseCtx, gradeBand: "1" }, pack, {
      maxActivities: 2,
      rng: () => 0,
      allowScaffold: true,
    });
    expect(plan.activities.length).toBeGreaterThan(0);
  });

  it("prefers intro difficulty when scaffolding suggests `model`", () => {
    const ctx: LearnerContext = {
      ...baseCtx,
      recentOutcomes: [
        { skillId: "x", correct: false, recordedAt: new Date().toISOString(), firstAttempt: true },
        { skillId: "x", correct: false, recordedAt: new Date().toISOString(), firstAttempt: true },
      ],
    };
    const plan = planSession(tutor, ctx, pack, { maxActivities: 1, rng: () => 0 });
    expect(plan.activities[0].difficulty).toBe("intro");
  });
});

describe("checkPolicy", () => {
  it("requires consentRecordId when tutor.policy.requiresConsent", () => {
    const consenting: TutorDefinition = {
      ...tutor,
      capabilities: ["chat", "voice_in", "voice_out"],
      policy: { ...tutor.policy, requiresConsent: true },
    };
    expect(() => checkPolicy(consenting, {})).toThrow(/consent/i);
    expect(() => checkPolicy(consenting, { consentRecordId: "c-1" })).not.toThrow();
  });
  it("rejects learner age below tutor.policy.minAgeYears", () => {
    const def: TutorDefinition = {
      ...tutor,
      policy: { ...tutor.policy, minAgeYears: 5 },
    };
    expect(() => checkPolicy(def, { learnerAgeYears: 3 })).toThrow(/age/);
    expect(() => checkPolicy(def, { learnerAgeYears: 6 })).not.toThrow();
  });
});

describe("applyOutcome", () => {
  it("advances reps + interval on a correct response", () => {
    const r = applyOutcome(initialMasteryRecord("s"), {
      skillId: "s",
      correct: true,
      recordedAt: new Date().toISOString(),
      firstAttempt: true,
    });
    expect(r.reps).toBe(1);
    expect(r.intervalDays).toBe(1);
    expect(r.streak).toBe(1);
  });
});

describe("special-interest theming", () => {
  it("rewrites {{noun}} placeholders using the learner's top interest", () => {
    const themedPack: ContentPack = {
      ...pack,
      activities: [
        {
          id: "a-themed",
          title: "Counting {{noun}}",
          skillId: "ccss.math.k.cc.a.1",
          type: "tap",
          prompt: "How many {{noun}} do you see?",
          difficulty: "core",
          choices: [{ id: "ok", label: "OK", correct: true }],
        },
      ],
    };
    const plan = planSession(
      tutor,
      {
        ...baseCtx,
        interestProfile: {
          learnerId: "l-1",
          signals: [
            {
              slug: "dinosaurs",
              source: "caregiver_intake",
              polarity: 1,
              confidence: 1,
              observedAt: new Date().toISOString(),
            },
          ],
        },
      },
      themedPack,
      { maxActivities: 1, rng: () => 0 },
    );
    expect(plan.activities[0].prompt).not.toContain("{{noun}}");
    expect(plan.activities[0].title).not.toContain("{{noun}}");
    expect(plan.activities[0].tags).toContain("themed:dinosaurs");
  });

  it("leaves activities unchanged when no placeholders are authored", () => {
    const plan = planSession(
      tutor,
      {
        ...baseCtx,
        interestProfile: {
          learnerId: "l-1",
          signals: [
            {
              slug: "trains",
              source: "caregiver_intake",
              polarity: 1,
              confidence: 1,
              observedAt: new Date().toISOString(),
            },
          ],
        },
      },
      pack,
      { maxActivities: 2, rng: () => 0 },
    );
    for (const a of plan.activities) {
      expect(a.tags ?? []).not.toContain("themed:trains");
    }
  });
});
