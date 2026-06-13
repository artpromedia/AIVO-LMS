/**
 * Sprint C-16 — acknowledgement DERIVATION + the privacy rule.
 *
 * Proves:
 *   - per-role derivation: each contributor's folded items come from THEIR
 *     OWN `collaborator:<role>` decisions (teacher / caregiver / therapist).
 *   - non-folded exclusion (the negative case): a role with no folded decision
 *     is absent from the result (so it is acknowledged nothing → notified
 *     nothing).
 *   - content-safety: the derived payload surfaces ONLY label + the
 *     contributor's own reasoning + the learner first name — never the child's
 *     functioning level / diagnoses / mastery, never another contributor's
 *     content.
 */
import { describe, expect, it } from "vitest";
import {
  collaboratorRoleFromSource,
  deriveRoleAcknowledgements,
  firstNameOf,
  tutorLabel,
} from "./contribution-acknowledgement";
import type { LearnerBrainProfileState } from "@/lib/db/types";

/** A minimal-but-shaped approved profile state carrying collaborator-sourced
 *  decisions from a therapist + a teacher, plus a parent/template decision that
 *  must NEVER be attributed to a contributor. Includes child-private fields
 *  (functioningLevel, diagnoses, mastery) that must NOT leak into any payload. */
function stateFixture(): LearnerBrainProfileState {
  return {
    learnerProfileSnapshot: {
      learnerId: "lrn_1",
      displayName: "Maya Okafor", // full name — only the first name may surface
      ageRange: "6-8",
      gradeBand: "1-2",
      primaryLanguage: "en",
    },
    parentAssessmentSummary: "Maya is in the 1-2 grade band.",
    accommodationSummary: "",
    sensoryProfile: { sensitivities: [], seekingOrAvoiding: "unspecified", notes: "" },
    attentionProfile: { focusWindowMinutes: 10, breakStyle: "occasional", movementHelps: false },
    readingComfort: "growing",
    mathComfort: "growing",
    preferredModalities: ["visual"],
    motivationProfile: { rewardsThatHelp: [], avoidanceFactors: [] },
    frustrationTriggers: [],
    accessibilityPreferences: {} as LearnerBrainProfileState["accessibilityPreferences"],
    supportDefaults: {
      extendedTime: false,
      readAloud: false,
      speechToText: false,
      visualSchedules: false,
      sensoryBreaks: false,
    },
    masteryOverview: [],
    confidenceSignals: { parentAssessment: true, iep: false, baselineAttempts: 1 },
    tutorPersonaRecommendation: { style: "warm_coach", rationale: "x" },
    // ↓ child-private — must never appear in a contributor payload.
    functioningLevel: "LOW_VERBAL",
    masteryLevels: { sub_math: 0.3 },
    disabilitySignals: {
      communicationNeeds: "non_verbal",
      attention: "short",
      sensory: null,
      motor: null,
      diagnoses: ["autism"],
    },
    iepProfile: null,
    activeAccommodations: ["aac_communication_support", "read_aloud"],
    activeTutors: ["echo", "sage"],
    visualIdentity: { primaryHue: "#000", secondaryHues: [], pulseRate: "calm" },
    xaiExplanation: {
      summary: "s",
      masteryDecisions: [],
      accommodationDecisions: [],
      tutorDecisions: [],
      raiCompliance: true,
      accommodationDecisionsDetailed: [
        {
          accommodation: "aac_communication_support",
          displayLabel: "AAC / communication support",
          reasoning: "therapist insight (communication): Maya uses a speech device at school.",
          source: "collaborator:therapist",
          removable: false,
        },
        {
          accommodation: "read_aloud",
          displayLabel: "Read-aloud",
          reasoning: "teacher insight (reading): prefers passages read aloud first.",
          source: "collaborator:teacher",
          removable: true,
        },
        {
          // A template/parent decision — NOT a contributor's. Must be excluded.
          accommodation: "extended_time",
          displayLabel: "Extended time",
          reasoning: "Enabled from the functioning-level template.",
          source: "functioning_level_template",
          removable: true,
        },
      ],
      tutorDecisionsDetailed: [
        {
          tutorKey: "echo",
          reasoning: "Kept active to coordinate with a therapist's communication insight.",
          source: "collaborator:therapist",
        },
      ],
    },
    source: "deterministic_fallback",
    schemaVersion: 1,
  } as unknown as LearnerBrainProfileState;
}

describe("collaboratorRoleFromSource", () => {
  it("parses collaborator:<role> and rejects template/parent sources", () => {
    expect(collaboratorRoleFromSource("collaborator:therapist")).toBe("therapist");
    expect(collaboratorRoleFromSource("collaborator:teacher")).toBe("teacher");
    expect(collaboratorRoleFromSource("collaborator:caregiver")).toBe("caregiver");
    expect(collaboratorRoleFromSource("functioning_level_template")).toBeNull();
    expect(collaboratorRoleFromSource("parent_modification")).toBeNull();
    expect(collaboratorRoleFromSource("collaborator:parent")).toBeNull();
    expect(collaboratorRoleFromSource(undefined)).toBeNull();
  });
});

describe("firstNameOf", () => {
  it("returns a single token, never the surname", () => {
    expect(firstNameOf("Maya Okafor")).toBe("Maya");
    expect(firstNameOf("  Sky  ")).toBe("Sky");
    expect(firstNameOf("")).toBe("your learner");
    expect(firstNameOf(null)).toBe("your learner");
  });
});

describe("deriveRoleAcknowledgements — per role", () => {
  it("derives a therapist payload with only the therapist's folded items", () => {
    const payloads = deriveRoleAcknowledgements(stateFixture());
    const therapist = payloads.find((p) => p.role === "therapist");
    expect(therapist).toBeTruthy();
    // Therapist folded AAC (accommodation) + Echo (tutor).
    const keys = therapist!.foldedItems.map((i) => `${i.kind}:${i.key}`).sort();
    expect(keys).toEqual(["accommodation:aac_communication_support", "tutor:echo"]);
    // The label + reasoning are the therapist's own.
    const aac = therapist!.foldedItems.find((i) => i.key === "aac_communication_support")!;
    expect(aac.label).toBe("AAC / communication support");
    expect(aac.reasoning).toContain("therapist insight");
    expect(therapist!.learnerFirstName).toBe("Maya");
  });

  it("derives a teacher payload with only the teacher's folded item", () => {
    const payloads = deriveRoleAcknowledgements(stateFixture());
    const teacher = payloads.find((p) => p.role === "teacher");
    expect(teacher).toBeTruthy();
    expect(teacher!.foldedItems).toHaveLength(1);
    expect(teacher!.foldedItems[0].key).toBe("read_aloud");
    expect(teacher!.foldedItems[0].reasoning).toContain("teacher insight");
  });

  it("EXCLUDES a role whose input did not fold (the negative case)", () => {
    const payloads = deriveRoleAcknowledgements(stateFixture());
    // No caregiver-sourced decision in the fixture → no caregiver payload.
    expect(payloads.find((p) => p.role === "caregiver")).toBeUndefined();
  });

  it("returns nothing when no collaborator decision folded at all", () => {
    const state = stateFixture();
    state.xaiExplanation.accommodationDecisionsDetailed = [
      {
        accommodation: "extended_time",
        displayLabel: "Extended time",
        reasoning: "from template",
        source: "functioning_level_template",
        removable: true,
      },
    ];
    state.xaiExplanation.tutorDecisionsDetailed = [];
    expect(deriveRoleAcknowledgements(state)).toEqual([]);
  });
});

describe("deriveRoleAcknowledgements — PRIVACY (content-safety)", () => {
  it("never surfaces the child's functioning level, diagnoses, or mastery", () => {
    const payloads = deriveRoleAcknowledgements(stateFixture());
    const blob = JSON.stringify(payloads).toLowerCase();
    expect(blob).not.toContain("low_verbal");
    expect(blob).not.toContain("autism");
    expect(blob).not.toContain("non_verbal");
    expect(blob).not.toContain("disabilitysignals");
    expect(blob).not.toContain("masterylevels");
    // The mastery number must not leak either.
    expect(blob).not.toContain("0.3");
  });

  it("never surfaces another contributor's content in a role's payload", () => {
    const payloads = deriveRoleAcknowledgements(stateFixture());
    const teacher = payloads.find((p) => p.role === "teacher")!;
    const teacherBlob = JSON.stringify(teacher).toLowerCase();
    // The therapist's words ("speech device") must not appear in the teacher's.
    expect(teacherBlob).not.toContain("speech device");
    expect(teacherBlob).not.toContain("therapist insight");
    const therapist = payloads.find((p) => p.role === "therapist")!;
    const therapistBlob = JSON.stringify(therapist).toLowerCase();
    // The teacher's words must not appear in the therapist's.
    expect(therapistBlob).not.toContain("read aloud first");
    expect(therapistBlob).not.toContain("teacher insight");
  });

  it("surfaces only the learner FIRST name, never the surname", () => {
    const payloads = deriveRoleAcknowledgements(stateFixture());
    const blob = JSON.stringify(payloads);
    expect(blob).toContain("Maya");
    expect(blob).not.toContain("Okafor");
  });

  it("honours a first-name override (canonical learner record)", () => {
    const payloads = deriveRoleAcknowledgements(stateFixture(), "Mai");
    expect(payloads.every((p) => p.learnerFirstName === "Mai")).toBe(true);
  });
});

describe("tutorLabel", () => {
  it("maps known tutor keys and capitalises unknown ones", () => {
    expect(tutorLabel("echo")).toBe("Echo (communication)");
    expect(tutorLabel("sage")).toBe("Sage (reading & language)");
    expect(tutorLabel("mystery")).toBe("Mystery");
  });
});
