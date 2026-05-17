import { z } from "zod";
import { comfortEnum, gradeBandEnum, ageRangeEnum } from "@/lib/validators/learner";

/**
 * Sprint 7: schema for the AI-generated brain profile. Used to validate both
 * the deterministic-fallback output and any real LLM output before persistence.
 */
export const BRAIN_PROFILE_SCHEMA_VERSION = 2;

const functioningLevelEnum = z.enum([
  "STANDARD",
  "SUPPORTED",
  "LOW_VERBAL",
  "NON_VERBAL",
  "PRE_SYMBOLIC",
]);

const accessibilityDefaultsSchema = z.object({
  reducedMotion: z.boolean(),
  highContrast: z.boolean(),
  largeText: z.boolean(),
  audioFirst: z.boolean(),
  captionsAlwaysOn: z.boolean(),
});

export const brainProfileStateSchema = z.object({
  learnerProfileSnapshot: z.object({
    learnerId: z.string(),
    displayName: z.string(),
    ageRange: ageRangeEnum.nullable(),
    gradeBand: gradeBandEnum.nullable(),
    primaryLanguage: z.string().nullable(),
  }),
  parentAssessmentSummary: z.string().min(1).max(2000),
  accommodationSummary: z.string().max(2000),
  sensoryProfile: z.object({
    sensitivities: z.array(z.string()),
    seekingOrAvoiding: z.enum([
      "seeking",
      "avoiding",
      "mixed",
      "neutral",
      "unspecified",
    ]),
    notes: z.string().max(500),
  }),
  attentionProfile: z.object({
    focusWindowMinutes: z.number().int().min(1).max(120),
    breakStyle: z.enum([
      "frequent_short",
      "occasional",
      "long_uninterrupted",
      "unspecified",
    ]),
    movementHelps: z.boolean(),
  }),
  readingComfort: z.union([comfortEnum, z.literal("unspecified")]),
  mathComfort: z.union([comfortEnum, z.literal("unspecified")]),
  preferredModalities: z.array(
    z.enum(["visual", "auditory", "kinesthetic", "reading_writing"]),
  ),
  motivationProfile: z.object({
    rewardsThatHelp: z.array(z.string()),
    avoidanceFactors: z.array(z.string()),
  }),
  frustrationTriggers: z.array(z.string()),
  accessibilityPreferences: accessibilityDefaultsSchema,
  supportDefaults: z.object({
    extendedTime: z.boolean(),
    readAloud: z.boolean(),
    speechToText: z.boolean(),
    visualSchedules: z.boolean(),
    sensoryBreaks: z.boolean(),
  }),
  masteryOverview: z.array(
    z.object({
      subjectId: z.string(),
      subjectName: z.string(),
      estimate: comfortEnum,
    }),
  ),
  confidenceSignals: z.object({
    parentAssessment: z.boolean(),
    iep: z.boolean(),
    baselineAttempts: z.number().int().min(0),
  }),
  tutorPersonaRecommendation: z.object({
    style: z.enum([
      "warm_coach",
      "playful_friend",
      "calm_guide",
      "structured_mentor",
    ]),
    rationale: z.string().min(1).max(500),
  }),
  // ----- legacy brain_state parity (schema v2) -----
  functioningLevel: functioningLevelEnum,
  masteryLevels: z.record(z.string(), z.number().min(0).max(1)),
  disabilitySignals: z.object({
    communicationNeeds: z.string().nullable(),
    attention: z.string().nullable(),
    sensory: z.string().nullable(),
    motor: z.string().nullable(),
    diagnoses: z.array(z.string()),
  }),
  iepProfile: z
    .object({
      uploaded: z.boolean(),
      categories: z.array(z.string()),
      goals: z.array(
        z.object({ domain: z.string(), text: z.string().max(500) }),
      ),
    })
    .nullable(),
  activeAccommodations: z.array(z.string()),
  activeTutors: z.array(z.string()),
  visualIdentity: z.object({
    primaryHue: z.string(),
    secondaryHues: z.array(z.string()),
    pulseRate: z.enum(["calm", "steady", "energetic"]),
  }),
  xaiExplanation: z.object({
    summary: z.string().max(1000),
    masteryDecisions: z.array(z.string().max(300)),
    accommodationDecisions: z.array(z.string().max(300)),
    tutorDecisions: z.array(z.string().max(300)),
    raiCompliance: z.boolean(),
  }),
  source: z.enum(["ai_generated", "deterministic_fallback"]),
  schemaVersion: z.literal(BRAIN_PROFILE_SCHEMA_VERSION),
});

export type BrainProfileStateInput = z.infer<typeof brainProfileStateSchema>;
