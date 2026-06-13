/**
 * Sprint C-14 — reveal assembly: contribution counts (screen 1), operating
 * instructions with real source backing (screen 3), starting points without
 * grade numbers (screen 4), and the strengths-ONLY share artifact (screen 7).
 *
 * The share-artifact content-safety test is the load-bearing privacy guard: it
 * asserts the artifact's field surface contains ONLY firstName/strengths/
 * interests and never leaks a level, accommodation, diagnosis, or source.
 */
import { describe, expect, it } from "vitest";
import {
  assembleContributions,
  assembleOperatingInstructions,
  assembleStartingPoints,
  buildShareArtifact,
  shareArtifactHasContent,
} from "./reveal-assembly";
import type { LearnerBrainProfileState } from "@/lib/db/types";

// A minimal-but-valid brain state, with knobs the tests override per case.
function makeState(overrides: Partial<LearnerBrainProfileState> = {}): LearnerBrainProfileState {
  const base: LearnerBrainProfileState = {
    learnerProfileSnapshot: {
      learnerId: "l1",
      displayName: "Maya R.",
      ageRange: null,
      gradeBand: null,
      primaryLanguage: null,
    },
    parentAssessmentSummary: "",
    accommodationSummary: "",
    sensoryProfile: { sensitivities: [], seekingOrAvoiding: "avoiding", notes: "" },
    attentionProfile: { focusWindowMinutes: 8, breakStyle: "frequent_short", movementHelps: false },
    readingComfort: "growing",
    mathComfort: "growing",
    preferredModalities: ["visual", "auditory"],
    motivationProfile: { rewardsThatHelp: [], avoidanceFactors: [] },
    frustrationTriggers: [],
    accessibilityPreferences: {} as LearnerBrainProfileState["accessibilityPreferences"],
    supportDefaults: {
      extendedTime: false,
      readAloud: false,
      speechToText: false,
      visualSchedules: true,
      sensoryBreaks: true,
    },
    masteryOverview: [
      { subjectId: "reading", subjectName: "Reading", estimate: "new" },
      { subjectId: "math", subjectName: "Math", estimate: "growing" },
    ],
    confidenceSignals: { parentAssessment: true, iep: false, baselineAttempts: 1 },
    tutorPersonaRecommendation: { style: "calm_guide", rationale: "" },
    functioningLevel: "SUPPORTED",
    masteryLevels: {},
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
    visualIdentity: { primaryHue: "#A78BFA", secondaryHues: ["#06B6D4"], pulseRate: "steady" },
    xaiExplanation: {
      summary: "",
      masteryDecisions: [],
      accommodationDecisions: [],
      tutorDecisions: [],
      raiCompliance: true,
    },
    source: "deterministic_fallback",
    schemaVersion: 1,
  };
  return { ...base, ...overrides };
}

describe("assembleContributions (screen 1)", () => {
  it("builds one card per source with real counts", () => {
    const { cards, isEmpty } = assembleContributions({
      parentCompletedSections: 11,
      parentSubmitted: true,
      baselineAnswered: 23,
      collaboratorInsights: [
        { authorRole: "therapist" },
        { authorRole: "therapist" },
        { authorRole: "teacher" },
      ],
      iepOnFile: true,
    });
    expect(isEmpty).toBe(false);
    const parent = cards.find((c) => c.kind === "parent")!;
    expect(parent.count).toBe(11);
    const baseline = cards.find((c) => c.kind === "baseline")!;
    expect(baseline.count).toBe(23);
    // Two collaborator cards, one per role, with per-role counts.
    const therapist = cards.find((c) => c.key === "collaborator:therapist")!;
    expect(therapist.count).toBe(2);
    expect(therapist.role).toBe("therapist");
    const teacher = cards.find((c) => c.key === "collaborator:teacher")!;
    expect(teacher.count).toBe(1);
    // IEP is presence-only.
    const iep = cards.find((c) => c.kind === "iep")!;
    expect(iep.presenceOnly).toBe(true);
  });

  it("designs the zero-contributor empty state", () => {
    const { cards, isEmpty } = assembleContributions({
      parentCompletedSections: 0,
      parentSubmitted: false,
      baselineAnswered: 0,
      collaboratorInsights: [],
      iepOnFile: false,
    });
    expect(cards).toEqual([]);
    expect(isEmpty).toBe(true);
  });

  it("handles the partial-source variant (parent only, no baseline/collab/iep)", () => {
    const { cards } = assembleContributions({
      parentCompletedSections: 4,
      parentSubmitted: false,
      baselineAnswered: 0,
      collaboratorInsights: [],
      iepOnFile: false,
    });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe("parent");
  });
});

describe("assembleOperatingInstructions (screen 3)", () => {
  it("emits cards with a real source + confidence for each backed facet", () => {
    const instructions = assembleOperatingInstructions({
      state: makeState(),
      baselineAnswered: 20,
    });
    // Every instruction has a source and a confidence (no naked cards).
    for (const ins of instructions) {
      expect(ins.source).toBeTruthy();
      expect(["high", "medium", "low"]).toContain(ins.confidence);
    }
    // Modality is parent + baseline → high (≥2 voices).
    const modality = instructions.find((i) => i.facet === "modality")!;
    expect(modality.valueKey).toBe("visual");
    expect(modality.confidence).toBe("high");
  });

  it("attributes a collaborator (therapist) sensory insight on the sensory card", () => {
    const state = makeState({
      xaiExplanation: {
        summary: "",
        masteryDecisions: [],
        accommodationDecisions: [],
        tutorDecisions: [],
        raiCompliance: true,
        accommodationDecisionsDetailed: [
          {
            accommodation: "sensory_breaks",
            displayLabel: "Sensory breaks",
            reasoning: "therapist insight (sensory)",
            source: "collaborator:therapist",
          },
        ],
      },
    });
    const instructions = assembleOperatingInstructions({ state, baselineAnswered: 0 });
    const sensory = instructions.find((i) => i.facet === "sensory")!;
    // Parent said "avoiding" + a therapist observed sensory → 2 voices → high,
    // and the chip names the collaborator (most specific).
    expect(sensory.source.kind).toBe("collaborator");
    expect(sensory.source.role).toBe("therapist");
    expect(sensory.confidence).toBe("high");
  });

  it("omits a facet entirely when no real source backs it (partial-data state)", () => {
    // Parent never completed the assessment, no baseline, no collaborators →
    // facets that depend only on the parent have no backing → dropped.
    const state = makeState({
      confidenceSignals: { parentAssessment: false, iep: false, baselineAttempts: 0 },
      sensoryProfile: { sensitivities: [], seekingOrAvoiding: "unspecified", notes: "" },
      supportDefaults: {
        extendedTime: false,
        readAloud: false,
        speechToText: false,
        visualSchedules: false,
        sensoryBreaks: false,
      },
      attentionProfile: { focusWindowMinutes: 0, breakStyle: "unspecified", movementHelps: false },
    });
    const instructions = assembleOperatingInstructions({ state, baselineAnswered: 0 });
    expect(instructions).toEqual([]);
  });
});

describe("assembleStartingPoints (screen 4)", () => {
  it("passes qualitative estimates through with no grade numbers", () => {
    const points = assembleStartingPoints(makeState());
    expect(points).toEqual([
      { subjectId: "reading", subjectName: "Reading", estimate: "new", gradeBandLabel: null },
      { subjectId: "math", subjectName: "Math", estimate: "growing", gradeBandLabel: null },
    ]);
    // No numeric grade anywhere on the view-model.
    for (const p of points) {
      expect(typeof (p as unknown as { grade?: unknown }).grade).toBe("undefined");
    }
  });

  it("defaults gradeBandLabel to null when the builder grounded none (D4b fallback)", () => {
    const points = assembleStartingPoints(makeState());
    expect(points.every((p) => p.gradeBandLabel === null)).toBe(true);
  });

  it("passes through an authoritative curriculum-svc grade-band label when present (D4b)", () => {
    const state = makeState();
    state.masteryOverview = [
      {
        subjectId: "reading",
        subjectName: "Reading",
        estimate: "new",
        gradeBandLabel: "Early elementary range",
      },
      { subjectId: "math", subjectName: "Math", estimate: "growing" },
    ];
    const points = assembleStartingPoints(state);
    expect(points[0].gradeBandLabel).toBe("Early elementary range");
    // A subject the catalogue didn't ground stays null — never fabricated.
    expect(points[1].gradeBandLabel).toBeNull();
  });
});

describe("buildShareArtifact (screen 7) — content safety", () => {
  const built = buildShareArtifact({
    firstName: "Maya",
    goodAt: ["Drawing", "Building with Lego", "Drawing"],
    strongSubjects: ["Science"],
    loves: "Space documentaries and dinosaurs",
    motivates: "Earning stickers",
  });

  it("keeps only firstName, strengths, and interests — no other fields", () => {
    // The ENTIRE field surface, asserted exactly. A new field that could leak a
    // level/accommodation/diagnosis/source breaks this test.
    expect(Object.keys(built).sort()).toEqual(["firstName", "interests", "strengths"]);
  });

  it("dedupes strengths and merges baseline-strong subjects", () => {
    expect(built.firstName).toBe("Maya");
    expect(built.strengths).toEqual(["Drawing", "Building with Lego", "Science"]);
  });

  it("splits free-text interests into short phrases", () => {
    expect(built.interests).toContain("Space documentaries");
    expect(built.interests).toContain("dinosaurs");
    expect(built.interests).toContain("Earning stickers");
  });

  it("never carries a diagnosis, accommodation, level, or source even if present upstream", () => {
    const serialized = JSON.stringify(built).toLowerCase();
    // Sentinel values a leak would surface — none must appear.
    for (const banned of [
      "adhd",
      "autism",
      "dyslexia",
      "iep",
      "read_aloud",
      "extended_time",
      "sensory",
      "growing",
      "confident",
      "advanced",
      "collaborator",
      "baseline",
      "functioning",
    ]) {
      expect(serialized).not.toContain(banned);
    }
  });

  it("flags content vs the empty state", () => {
    expect(shareArtifactHasContent(built)).toBe(true);
    expect(
      shareArtifactHasContent({ firstName: "Sky", strengths: [], interests: [] }),
    ).toBe(false);
  });
});
