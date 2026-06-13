/**
 * Sprint C-05 — unit tests for the correction fold + therapist-lock helpers
 * (`lib/db/brain-corrections.ts`).
 *
 * Pure functions, no persistence. Each prefix rule is exercised in isolation
 * against a hand-built `LearnerBrainProfileState` fixture that is asserted to
 * pass `brainProfileStateSchema` first (so the fixture can't silently rot out
 * of shape). The therapist lock is the load-bearing security check: a forged
 * "turn it off" on a `removable: false` accommodation must throw
 * `BrainCorrectionLockedError` BEFORE any field is touched, while turning a
 * pinned support ON stays allowed (the lock pins it on, it doesn't freeze the
 * row).
 */
import { describe, it, expect } from "vitest";
import {
  foldParentModifications,
  findLockedViolations,
  lockedAccommodationSlugs,
  assertCorrectionsAllowed,
  originalValueForField,
  BrainCorrectionLockedError,
  SUPPORT_DEFAULT_BY_SLUG,
} from "@/lib/db/brain-corrections";
import { brainProfileStateSchema } from "@/lib/validators/brain-profile";
import type { LearnerBrainProfileState, ParentModification } from "@/lib/db/types";

const APPLIED_AT = "2026-06-13T12:00:00.000Z";

/** A minimal, schema-valid cloned-brain state. `removable: false` on
 *  `read_aloud` makes it a therapist-pinned support for the lock tests. */
function baseState(over: Partial<LearnerBrainProfileState> = {}): LearnerBrainProfileState {
  const state: LearnerBrainProfileState = {
    learnerProfileSnapshot: {
      learnerId: "lrn_fold",
      displayName: "Fold",
      ageRange: "5-7",
      gradeBand: "1-2",
      primaryLanguage: "English",
    },
    parentAssessmentSummary: "Loves animals; sustains focus ~10 min.",
    accommodationSummary: "Read-aloud and extended time.",
    sensoryProfile: { sensitivities: [], seekingOrAvoiding: "neutral", notes: "" },
    attentionProfile: { focusWindowMinutes: 10, breakStyle: "occasional", movementHelps: true },
    readingComfort: "growing",
    mathComfort: "growing",
    preferredModalities: ["visual", "auditory"],
    motivationProfile: { rewardsThatHelp: ["Stickers"], avoidanceFactors: [] },
    frustrationTriggers: [],
    accessibilityPreferences: {
      reducedMotion: false,
      highContrast: false,
      largeText: false,
      audioFirst: true,
      captionsAlwaysOn: true,
    },
    supportDefaults: {
      extendedTime: true,
      readAloud: true,
      speechToText: false,
      visualSchedules: false,
      sensoryBreaks: false,
    },
    masteryOverview: [{ subjectId: "subj_math", subjectName: "Math", estimate: "growing" }],
    confidenceSignals: { parentAssessment: true, iep: true, baselineAttempts: 8 },
    tutorPersonaRecommendation: { style: "warm_coach", rationale: "Calm, encouraging tone fits." },
    functioningLevel: "STANDARD",
    masteryLevels: { subj_math: 0.4, subj_reading: 0.5 },
    disabilitySignals: {
      communicationNeeds: null,
      attention: null,
      sensory: null,
      motor: null,
      diagnoses: [],
    },
    iepProfile: { uploaded: true, categories: ["reading"], goals: [] },
    activeAccommodations: ["read_aloud", "extended_time"],
    activeTutors: ["reading_coach", "math_friend"],
    visualIdentity: { primaryHue: "#3b82f6", secondaryHues: [], pulseRate: "calm" },
    xaiExplanation: {
      summary: "Built from the baseline + parent answers.",
      masteryDecisions: [],
      accommodationDecisions: [],
      tutorDecisions: [],
      raiCompliance: true,
      accommodationDecisionsDetailed: [
        {
          accommodation: "read_aloud",
          displayLabel: "Read-aloud",
          reasoning: "Raised by the speech therapist.",
          source: "collaborator_insight",
          removable: false,
        },
        {
          accommodation: "extended_time",
          displayLabel: "Extended time",
          reasoning: "Parent reported slow processing.",
          source: "parent_modification",
          removable: true,
        },
      ],
    },
    source: "ai_generated",
    schemaVersion: 2,
    ...over,
  };
  return state;
}

function mod(over: Partial<ParentModification> & Pick<ParentModification, "field" | "parentValue">): ParentModification {
  return {
    originalValue: null,
    parentNote: null,
    modifiedAt: "",
    ...over,
  };
}

describe("fixture is schema-valid", () => {
  it("baseState() passes brainProfileStateSchema", () => {
    expect(brainProfileStateSchema.safeParse(baseState()).success).toBe(true);
  });
});

describe("foldParentModifications — mastery_levels.<domain>", () => {
  it("sets a known domain and clamps to [0,1]", () => {
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "mastery_levels.subj_math", parentValue: 1.5 })],
      APPLIED_AT,
    );
    expect(next.masteryLevels.subj_math).toBe(1); // clamped high
  });

  it("clamps a negative value to 0", () => {
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "mastery_levels.subj_reading", parentValue: -0.3 })],
      APPLIED_AT,
    );
    expect(next.masteryLevels.subj_reading).toBe(0);
  });

  it("ignores an unknown domain (Python parity) but still records it", () => {
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "mastery_levels.subj_unknown", parentValue: 0.9 })],
      APPLIED_AT,
    );
    expect(next.masteryLevels).not.toHaveProperty("subj_unknown");
    expect(next.xaiExplanation.parentModifications).toHaveLength(1);
    expect(next.xaiExplanation.parentModifications![0].field).toBe("mastery_levels.subj_unknown");
  });
});

describe("foldParentModifications — accommodation.<slug>", () => {
  it("turning a core slug OFF clears activeAccommodations AND the supportDefaults flag", () => {
    expect(SUPPORT_DEFAULT_BY_SLUG.extended_time).toBe("extendedTime");
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "accommodation.extended_time", parentValue: false })],
      APPLIED_AT,
    );
    expect(next.activeAccommodations).not.toContain("extended_time");
    expect(next.supportDefaults.extendedTime).toBe(false);
  });

  it("turning a core slug ON adds membership AND sets the supportDefaults flag", () => {
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "accommodation.speech_to_text", parentValue: true })],
      APPLIED_AT,
    );
    expect(next.activeAccommodations).toContain("speech_to_text");
    expect(next.supportDefaults.speechToText).toBe(true);
  });

  it("a non-core accommodation toggles only activeAccommodations (no supportDefaults flag)", () => {
    const before = baseState();
    const next = foldParentModifications(
      before,
      [mod({ field: "accommodation.aac_communication_support", parentValue: true })],
      APPLIED_AT,
    );
    expect(next.activeAccommodations).toContain("aac_communication_support");
    // supportDefaults shape is unchanged (no flag exists for this slug).
    expect(next.supportDefaults).toEqual(before.supportDefaults);
  });

  it("syncs all five core supportDefaults flags from their slugs", () => {
    const next = foldParentModifications(
      baseState(),
      [
        mod({ field: "accommodation.read_aloud", parentValue: true }),
        mod({ field: "accommodation.extended_time", parentValue: false }),
        mod({ field: "accommodation.speech_to_text", parentValue: true }),
        mod({ field: "accommodation.visual_schedules", parentValue: true }),
        mod({ field: "accommodation.sensory_breaks", parentValue: true }),
      ],
      APPLIED_AT,
    );
    expect(next.supportDefaults).toEqual({
      readAloud: true,
      extendedTime: false,
      speechToText: true,
      visualSchedules: true,
      sensoryBreaks: true,
    });
  });
});

describe("foldParentModifications — tutor.<key>", () => {
  it("releasing a tutor removes it from activeTutors", () => {
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "tutor.math_friend", parentValue: false })],
      APPLIED_AT,
    );
    expect(next.activeTutors).not.toContain("math_friend");
    expect(next.activeTutors).toContain("reading_coach");
  });

  it("keeping/adding a tutor adds it to activeTutors", () => {
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "tutor.science_buddy", parentValue: true })],
      APPLIED_AT,
    );
    expect(next.activeTutors).toContain("science_buddy");
  });
});

describe("foldParentModifications — readingComfort / mathComfort", () => {
  it("sets a valid comfort string", () => {
    const next = foldParentModifications(
      baseState(),
      [
        mod({ field: "readingComfort", parentValue: "confident" }),
        mod({ field: "mathComfort", parentValue: "new" }),
      ],
      APPLIED_AT,
    );
    expect(next.readingComfort).toBe("confident");
    expect(next.mathComfort).toBe("new");
  });

  it("ignores an out-of-range comfort string but still records it", () => {
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "readingComfort", parentValue: "wizard" })],
      APPLIED_AT,
    );
    expect(next.readingComfort).toBe("growing"); // unchanged
    expect(next.xaiExplanation.parentModifications).toHaveLength(1);
  });
});

describe("parentModifications audit trail", () => {
  it("appends every modification to xaiExplanation.parentModifications with applied timestamp", () => {
    const next = foldParentModifications(
      baseState(),
      [
        mod({ field: "readingComfort", originalValue: "growing", parentValue: "confident", parentNote: "Reads chapter books now." }),
        mod({ field: "tutor.math_friend", originalValue: true, parentValue: false }),
      ],
      APPLIED_AT,
    );
    const recorded = next.xaiExplanation.parentModifications!;
    expect(recorded).toHaveLength(2);
    expect(recorded[0]).toMatchObject({
      field: "readingComfort",
      originalValue: "growing",
      parentValue: "confident",
      parentNote: "Reads chapter books now.",
      modifiedAt: APPLIED_AT, // empty modifiedAt → filled with appliedAtIso
    });
    expect(recorded[1].field).toBe("tutor.math_friend");
  });

  it("preserves a caller-supplied modifiedAt instead of the applied timestamp", () => {
    const next = foldParentModifications(
      baseState(),
      [mod({ field: "mathComfort", parentValue: "advanced", modifiedAt: "2026-01-02T03:04:05.000Z" })],
      APPLIED_AT,
    );
    expect(next.xaiExplanation.parentModifications![0].modifiedAt).toBe("2026-01-02T03:04:05.000Z");
  });

  it("appends to (never replaces) any pre-existing parentModifications", () => {
    const seeded = baseState({
      xaiExplanation: {
        ...baseState().xaiExplanation,
        parentModifications: [
          { field: "tutor.reading_coach", originalValue: true, parentValue: true, parentNote: "Earlier note", modifiedAt: APPLIED_AT },
        ],
      },
    });
    const next = foldParentModifications(
      seeded,
      [mod({ field: "mathComfort", parentValue: "confident" })],
      APPLIED_AT,
    );
    expect(next.xaiExplanation.parentModifications).toHaveLength(2);
    expect(next.xaiExplanation.parentModifications![0].field).toBe("tutor.reading_coach");
  });

  it("clears parentCorrectionsDraft after folding", () => {
    const staged = baseState({
      parentCorrectionsDraft: {
        modifications: [{ field: "mathComfort", originalValue: "growing", parentValue: "confident", parentNote: null, modifiedAt: APPLIED_AT }],
        savedAt: APPLIED_AT,
      },
    });
    const next = foldParentModifications(
      staged,
      staged.parentCorrectionsDraft!.modifications,
      APPLIED_AT,
    );
    expect(next.parentCorrectionsDraft).toBeUndefined();
  });

  it("returns a new object and does not mutate the input state", () => {
    const before = baseState();
    const snapshotTutors = [...before.activeTutors];
    const next = foldParentModifications(
      before,
      [mod({ field: "tutor.math_friend", parentValue: false })],
      APPLIED_AT,
    );
    expect(next).not.toBe(before);
    expect(before.activeTutors).toEqual(snapshotTutors); // input untouched
  });
});

describe("therapist lock — lockedAccommodationSlugs / findLockedViolations", () => {
  it("collects every accommodation pinned with removable === false", () => {
    const locked = lockedAccommodationSlugs(baseState());
    expect(locked.has("read_aloud")).toBe(true);
    expect(locked.has("extended_time")).toBe(false); // removable: true
  });

  it("flags a forged unlock of a pinned support", () => {
    const violations = findLockedViolations(baseState(), [
      mod({ field: "accommodation.read_aloud", parentValue: false }),
    ]);
    expect(violations).toEqual(["accommodation.read_aloud"]);
  });

  it("does not flag turning a pinned support ON", () => {
    const violations = findLockedViolations(baseState(), [
      mod({ field: "accommodation.read_aloud", parentValue: true }),
    ]);
    expect(violations).toEqual([]);
  });

  it("returns nothing when no supports are pinned", () => {
    const unpinned = baseState({
      xaiExplanation: { ...baseState().xaiExplanation, accommodationDecisionsDetailed: [] },
    });
    expect(findLockedViolations(unpinned, [mod({ field: "accommodation.read_aloud", parentValue: false })])).toEqual([]);
  });
});

describe("therapist lock — enforcement in fold + assert", () => {
  it("foldParentModifications throws BrainCorrectionLockedError on a forged unlock", () => {
    expect(() =>
      foldParentModifications(
        baseState(),
        [mod({ field: "accommodation.read_aloud", parentValue: false })],
        APPLIED_AT,
      ),
    ).toThrow(BrainCorrectionLockedError);
  });

  it("the thrown error carries the locked field name", () => {
    try {
      assertCorrectionsAllowed(baseState(), [
        mod({ field: "accommodation.read_aloud", parentValue: false }),
      ]);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(BrainCorrectionLockedError);
      expect((err as BrainCorrectionLockedError).lockedFields).toEqual(["accommodation.read_aloud"]);
    }
  });

  it("throws BEFORE touching any field (no partial fold)", () => {
    const before = baseState();
    expect(() =>
      foldParentModifications(
        before,
        [
          mod({ field: "mathComfort", parentValue: "advanced" }),
          mod({ field: "accommodation.read_aloud", parentValue: false }), // forged unlock
        ],
        APPLIED_AT,
      ),
    ).toThrow(BrainCorrectionLockedError);
    // The input is unchanged AND nothing leaked (function returns nothing on throw).
    expect(before.mathComfort).toBe("growing");
  });

  it("turning a pinned support ON is allowed and folds normally", () => {
    const next = foldParentModifications(
      baseState({ supportDefaults: { ...baseState().supportDefaults, readAloud: false }, activeAccommodations: ["extended_time"] }),
      [mod({ field: "accommodation.read_aloud", parentValue: true })],
      APPLIED_AT,
    );
    expect(next.activeAccommodations).toContain("read_aloud");
    expect(next.supportDefaults.readAloud).toBe(true);
  });
});

describe("originalValueForField — reads from server-side state", () => {
  it("reads comfort fields, core support flags, tutor + accommodation membership, mastery", () => {
    const s = baseState();
    expect(originalValueForField(s, "readingComfort")).toBe("growing");
    expect(originalValueForField(s, "mathComfort")).toBe("growing");
    // core slug → reads the supportDefaults flag
    expect(originalValueForField(s, "accommodation.read_aloud")).toBe(true);
    expect(originalValueForField(s, "accommodation.speech_to_text")).toBe(false);
    // non-core slug → reads activeAccommodations membership
    expect(originalValueForField(s, "accommodation.aac_communication_support")).toBe(false);
    expect(originalValueForField(s, "tutor.math_friend")).toBe(true);
    expect(originalValueForField(s, "tutor.unknown")).toBe(false);
    expect(originalValueForField(s, "mastery_levels.subj_math")).toBe(0.4);
    expect(originalValueForField(s, "mastery_levels.subj_unknown")).toBeNull();
    expect(originalValueForField(s, "nonsense")).toBeNull();
  });
});
