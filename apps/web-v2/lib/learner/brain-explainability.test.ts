/**
 * Sprint A1 — unit tests for the XAI/RAI selector + zod schema additions.
 *
 * Pins the selector's behaviour for both branches:
 *   • deterministic-fallback profiles (only flat string summaries on
 *     `xaiExplanation`) — selector must synthesise a sensible
 *     `raiComplianceDetail` so the upcoming UI never has to render an
 *     empty RAI tab.
 *   • real `brain-svc` clone outputs (with the richer `*Detailed`
 *     arrays + `raiComplianceDetail` object) — selector must pass the
 *     structured payload through verbatim.
 *
 * Also exercises the zod schema to confirm the new optional fields
 * validate against a realistic clone-pipeline payload.
 */
import { describe, expect, it } from "vitest";
import {
  BRAIN_PROFILE_SCHEMA_VERSION,
  brainProfileStateSchema,
} from "@/lib/validators/brain-profile";
import { selectBrainExplainability } from "@/lib/learner/brain-explainability";
import type { LearnerBrainProfileState } from "@/lib/db/types";

function baseState(
  overrides: Partial<LearnerBrainProfileState> = {},
): LearnerBrainProfileState {
  return {
    learnerProfileSnapshot: {
      learnerId: "lp_test",
      displayName: "Test Learner",
      ageRange: null,
      gradeBand: null,
      primaryLanguage: "en",
    },
    parentAssessmentSummary: "Parent assessment summary.",
    accommodationSummary: "",
    sensoryProfile: {
      sensitivities: [],
      seekingOrAvoiding: "neutral",
      notes: "",
    },
    attentionProfile: {
      focusWindowMinutes: 15,
      breakStyle: "occasional",
      movementHelps: false,
    },
    readingComfort: "growing",
    mathComfort: "growing",
    preferredModalities: ["visual"],
    motivationProfile: { rewardsThatHelp: [], avoidanceFactors: [] },
    frustrationTriggers: [],
    accessibilityPreferences: {
      reducedMotion: false,
      highContrast: false,
      largeText: false,
      audioFirst: false,
      captionsAlwaysOn: false,
    },
    supportDefaults: {
      extendedTime: false,
      readAloud: false,
      speechToText: false,
      visualSchedules: false,
      sensoryBreaks: false,
    },
    masteryOverview: [],
    confidenceSignals: { parentAssessment: true, iep: false, baselineAttempts: 0 },
    tutorPersonaRecommendation: { style: "warm_coach", rationale: "default" },
    functioningLevel: "STANDARD",
    masteryLevels: { math: 0.6, ela: 0.55 },
    disabilitySignals: {
      communicationNeeds: null,
      attention: null,
      sensory: null,
      motor: null,
      diagnoses: [],
    },
    iepProfile: null,
    activeAccommodations: [],
    activeTutors: [],
    visualIdentity: {
      primaryHue: "#6cc",
      secondaryHues: [],
      pulseRate: "calm",
    },
    xaiExplanation: {
      summary: "Default summary",
      masteryDecisions: ["Math: 0.6"],
      accommodationDecisions: [],
      tutorDecisions: [],
      raiCompliance: true,
    },
    source: "deterministic_fallback",
    schemaVersion: BRAIN_PROFILE_SCHEMA_VERSION,
    ...overrides,
  };
}

describe("selectBrainExplainability — deterministic fallback path", () => {
  it("synthesises a default RAI panel when none is attached", () => {
    const result = selectBrainExplainability(baseState());

    expect(result.source).toBe("deterministic_fallback");
    expect(result.summary).toBe("Default summary");
    expect(result.raiComplianceDetail.dataSources).toEqual([
      "Deterministic fallback template (no LLM call)",
    ]);
    expect(result.raiComplianceDetail.biasMitigations.length).toBeGreaterThan(0);
    expect(result.raiComplianceDetail.humanOversight).toMatch(/parent approval/);
    expect(result.masteryDecisionsDetailed).toEqual([]);
    expect(result.accommodationDecisionsDetailed).toEqual([]);
    expect(result.tutorDecisionsDetailed).toEqual([]);
    expect(result.masteryDecisions).toEqual(["Math: 0.6"]);
  });

  it("preserves mastery levels as a defensive copy", () => {
    const state = baseState();
    const result = selectBrainExplainability(state);
    result.masteryLevels.math = 0;
    expect(state.masteryLevels.math).toBe(0.6);
  });
});

describe("selectBrainExplainability — real clone pipeline output", () => {
  it("passes through the detailed XAI + RAI arrays verbatim", () => {
    const state = baseState({
      source: "ai_generated",
      xaiExplanation: {
        summary: "Brain clone created from Discovery Adventure",
        masteryDecisions: ["m1"],
        accommodationDecisions: [],
        tutorDecisions: [],
        raiCompliance: true,
        masteryDecisionsDetailed: [
          {
            domain: "math",
            score: 0.6,
            displayLabel: "Math",
            reasoning: "Scored 6/10 on medium difficulty.",
            source: "discovery_adventure",
            rawScore: "6/10",
            difficulty: "medium",
          },
        ],
        accommodationDecisionsDetailed: [
          {
            accommodation: "extended_time",
            displayLabel: "Extended Time",
            reasoning: "Standard for SUPPORTED level.",
            source: "functioning_level_template",
            removable: true,
          },
        ],
        tutorDecisionsDetailed: [
          {
            tutorKey: "ela-tutor",
            reasoning: "Included in template.",
            source: "functioning_level_template",
          },
        ],
        signalDecisionsDetailed: [],
        raiComplianceDetail: {
          dataSources: [
            "Learner Discovery Adventure (baseline assessment)",
            "Parent/caregiver assessment questionnaire",
          ],
          biasMitigations: ["Mitigation a", "Mitigation b"],
          transparency: "Every decision is explainable.",
          humanOversight: "Parent approval required.",
        },
      },
    });

    const result = selectBrainExplainability(state);

    expect(result.source).toBe("ai_generated");
    expect(result.raiComplianceDetail.dataSources).toContain(
      "Learner Discovery Adventure (baseline assessment)",
    );
    expect(result.masteryDecisionsDetailed).toHaveLength(1);
    expect(result.masteryDecisionsDetailed[0]?.rawScore).toBe("6/10");
    expect(result.accommodationDecisionsDetailed[0]?.accommodation).toBe(
      "extended_time",
    );
    expect(result.tutorDecisionsDetailed[0]?.tutorKey).toBe("ela-tutor");
  });
});

describe("brainProfileStateSchema — Sprint A1 additions", () => {
  it("accepts a profile with only the flat xai summaries (back-compat)", () => {
    const parsed = brainProfileStateSchema.safeParse(baseState());
    expect(parsed.success).toBe(true);
  });

  it("accepts a profile with the richer detailed arrays", () => {
    const parsed = brainProfileStateSchema.safeParse(
      baseState({
        xaiExplanation: {
          summary: "s",
          masteryDecisions: [],
          accommodationDecisions: [],
          tutorDecisions: [],
          raiCompliance: true,
          masteryDecisionsDetailed: [
            {
              domain: "math",
              score: 0.5,
              displayLabel: "Math",
              reasoning: "r",
            },
          ],
          raiComplianceDetail: {
            dataSources: ["s1"],
            biasMitigations: ["m1"],
            transparency: "t",
            humanOversight: "h",
          },
        },
      }),
    );
    expect(parsed.success).toBe(true);
  });

  it("rejects a mastery decision with score out of [0,1]", () => {
    const parsed = brainProfileStateSchema.safeParse(
      baseState({
        xaiExplanation: {
          summary: "s",
          masteryDecisions: [],
          accommodationDecisions: [],
          tutorDecisions: [],
          raiCompliance: true,
          masteryDecisionsDetailed: [
            {
              domain: "math",
              score: 1.5, // invalid
              displayLabel: "Math",
              reasoning: "r",
            },
          ],
        },
      }),
    );
    expect(parsed.success).toBe(false);
  });
});
