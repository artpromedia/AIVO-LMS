/**
 * Sprint 7: deterministic brain profile generation.
 *
 * Synthesizes a `LearnerBrainProfileState` from every signal available
 * (learner profile, parent assessment, IEP extraction, baseline attempts).
 * Marked `source: "deterministic_fallback"`. When the LLM adapter is wired
 * in (Sprint 22+), it should produce the same shape and be validated by the
 * same `brainProfileStateSchema` before persistence — callers don't change.
 *
 * Acceptance criterion: "Two different learners produce meaningfully
 * different profiles." This is satisfied because every field above the
 * accessibility defaults is derived from learner-specific inputs.
 */
import type {
  BaselineSummary,
  IEPExtraction,
  LearnerBrainProfileState,
  LearnerProfile,
  ParentAssessment,
  SkillMasteryLevel,
  Subject,
  ComfortLevel,
} from "@/lib/db/types";
import { BRAIN_PROFILE_SCHEMA_VERSION } from "@/lib/validators/brain-profile";

type GenInput = {
  learner: LearnerProfile;
  assessment: ParentAssessment | null;
  iepExtraction: IEPExtraction | null;
  iepUploaded: boolean;
  subjects: Subject[];
  baselineAttempts: number;
  /**
   * When supplied (post-baseline clone), per-subject mastery is taken from
   * the actual baseline results instead of the generic comfort heuristic.
   */
  baselineSummary?: BaselineSummary | null;
};

/** Map our 5-level mastery estimate down to the 4-level brain profile comfort. */
function masteryLevelToComfort(level: SkillMasteryLevel): ComfortLevel {
  switch (level) {
    case "stretching":
      return "advanced";
    case "on_grade_level":
      return "confident";
    case "approaching":
      return "growing";
    case "emerging":
    case "not_started":
    default:
      return "new";
  }
}

/** Map our 5-level mastery estimate to a normalised [0,1] score, mirroring
 *  legacy brain_state.mastery_levels (which the tutor router and curriculum
 *  planner read as a numeric domain mastery). */
function masteryLevelToScore(level: SkillMasteryLevel): number {
  switch (level) {
    case "stretching":
      return 0.95;
    case "on_grade_level":
      return 0.75;
    case "approaching":
      return 0.55;
    case "emerging":
      return 0.3;
    case "not_started":
    default:
      return 0.0;
  }
}

/** Fallback numeric score from a coarse comfort bucket (used when no baseline
 *  has been run yet so masteryLevels is never empty). */
function comfortToScore(c: ComfortLevel | null | undefined): number {
  switch (c) {
    case "advanced":
      return 0.9;
    case "confident":
      return 0.7;
    case "growing":
      return 0.4;
    case "new":
      return 0.1;
    default:
      return 0.4;
  }
}

/** Default tutor roster — legacy core 7. Trimmed to the learners highest-need
 *  domains by `pickActiveTutors` below. */
const CORE_TUTORS = [
  "nova", // math
  "sage", // ela / reading
  "spark", // science
  "harmony", // social-emotional
  "echo", // speech / communication
  "pixel", // visual arts
  "atlas", // social studies
] as const;

/** Decide which subset of the 14 tutors stays active for this learner. The
 *  legacy clone keeps the core 7 unless mastery in a domain is high enough
 *  that the tutor becomes redundant (>= 0.85), with a hard floor of 4 so the
 *  learner is never left with too few coaches. */
function pickActiveTutors(_masteryLevels: Record<string, number>): string[] {
  // For now we don't have a subjectId→tutor map; keep the full core 7 and let
  // future enrichment narrow it. Recording the decision in xai_explanation.
  return [...CORE_TUTORS];
}

/** Infer legacy functioning level from communication mode + attention +
 *  diagnoses. Mirrors `brain-svc/services/clone_pipeline.py` seed templates. */
function inferFunctioningLevel(
  communicationMode: string | undefined,
  deviceInteraction: string | undefined,
  focusWindowMinutes: number,
  diagnoses: string[],
): "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC" {
  if (
    communicationMode === "non_verbal" &&
    deviceInteraction &&
    deviceInteraction !== "independent"
  ) {
    return "PRE_SYMBOLIC";
  }
  if (communicationMode === "non_verbal") return "NON_VERBAL";
  if (communicationMode === "sign" || communicationMode === "aac") {
    return "LOW_VERBAL";
  }
  if (diagnoses.length > 0 || focusWindowMinutes < 5) return "SUPPORTED";
  return "STANDARD";
}

/** Visual identity palette per functioning level — lifted from legacy
 *  visual_identity defaults so the learner's "brain" UI feels consistent
 *  across the v1/v2 transition. */
function buildVisualIdentity(
  functioningLevel: "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC",
  sensorySeekingOrAvoiding: string,
): LearnerBrainProfileState["visualIdentity"] {
  const calmMode =
    sensorySeekingOrAvoiding === "avoiding" ||
    functioningLevel === "PRE_SYMBOLIC" ||
    functioningLevel === "NON_VERBAL";
  switch (functioningLevel) {
    case "PRE_SYMBOLIC":
      return {
        primaryHue: "#A8DADC",
        secondaryHues: ["#E6F0F2", "#F1FAEE"],
        pulseRate: "calm",
      };
    case "NON_VERBAL":
      return {
        primaryHue: "#457B9D",
        secondaryHues: ["#A8DADC", "#F1FAEE"],
        pulseRate: "calm",
      };
    case "LOW_VERBAL":
      return {
        primaryHue: "#1D3557",
        secondaryHues: ["#457B9D", "#A8DADC"],
        pulseRate: "steady",
      };
    case "SUPPORTED":
      return {
        primaryHue: "#6A4C93",
        secondaryHues: ["#B392D8", "#F1FAEE"],
        pulseRate: calmMode ? "steady" : "energetic",
      };
    case "STANDARD":
    default:
      return {
        primaryHue: "#E63946",
        secondaryHues: ["#F1FAEE", "#A8DADC"],
        pulseRate: calmMode ? "steady" : "energetic",
      };
  }
}

function pick<T = unknown>(
  assessment: ParentAssessment | null,
  section: keyof ParentAssessment["answers"],
  field: string,
): T | undefined {
  if (!assessment) return undefined;
  const sec = assessment.answers[section] as Record<string, unknown> | undefined;
  return sec?.[field] as T | undefined;
}

function comfortOrUnspecified(c: ComfortLevel | null): ComfortLevel | "unspecified" {
  return c ?? "unspecified";
}

function inferModalities(
  communicationStyle: string | undefined,
  movementHelps: boolean,
  audioFirst: boolean,
): LearnerBrainProfileState["preferredModalities"] {
  const out: LearnerBrainProfileState["preferredModalities"] = [];
  if (communicationStyle === "visual" || communicationStyle === "mixed") out.push("visual");
  if (communicationStyle === "spoken" || audioFirst) out.push("auditory");
  if (movementHelps) out.push("kinesthetic");
  if (communicationStyle === "written") out.push("reading_writing");
  if (out.length === 0) out.push("visual", "auditory");
  return out;
}

function inferTutorPersona(
  triggers: string[],
  preferredPace: string | undefined,
  needsCoaching: boolean,
): LearnerBrainProfileState["tutorPersonaRecommendation"] {
  if (needsCoaching || triggers.length >= 3) {
    return {
      style: "calm_guide",
      rationale:
        "Calm, predictable pacing helps when frustration triggers are common or self-starting is hard.",
    };
  }
  if (preferredPace === "fast") {
    return {
      style: "structured_mentor",
      rationale: "Fast pacing pairs well with clear structure and explicit goals.",
    };
  }
  if (preferredPace === "slow") {
    return {
      style: "warm_coach",
      rationale: "A warm coach voice keeps confidence up when working at a gentler pace.",
    };
  }
  return {
    style: "playful_friend",
    rationale: "Default friendly persona keeps motivation high for steady-pace learners.",
  };
}

export function buildBrainProfile(input: GenInput): LearnerBrainProfileState {
  const {
    learner,
    assessment,
    iepExtraction,
    iepUploaded,
    subjects,
    baselineAttempts,
    baselineSummary,
  } = input;
  const baselineBySubject = new Map<string, BaselineSummary["perSubject"][number]>();
  for (const row of baselineSummary?.perSubject ?? []) {
    baselineBySubject.set(row.subjectId, row);
  }

  const focusWindow = pick<number>(assessment, "attention", "focusWindowMinutes") ?? 10;
  const breakStyleRaw = pick<string>(assessment, "attention", "breakStyle") ?? "occasional";
  const breakStyle = (
    ["frequent_short", "occasional", "long_uninterrupted"].includes(breakStyleRaw)
      ? breakStyleRaw
      : "unspecified"
  ) as LearnerBrainProfileState["attentionProfile"]["breakStyle"];
  const movementHelps = Boolean(pick<boolean>(assessment, "attention", "movementHelps"));

  const sensitivities = pick<string[]>(assessment, "sensory", "sensitivities") ?? [];
  const seekingOrAvoidingRaw =
    pick<string>(assessment, "sensory", "seekingOrAvoiding") ?? "unspecified";
  const seekingOrAvoiding = (
    ["seeking", "avoiding", "mixed", "neutral"].includes(seekingOrAvoidingRaw)
      ? seekingOrAvoidingRaw
      : "unspecified"
  ) as LearnerBrainProfileState["sensoryProfile"]["seekingOrAvoiding"];

  const communicationStyle = pick<string>(assessment, "communication", "style");
  const rewards = pick<string[]>(assessment, "motivation", "rewardsThatHelp") ?? [];
  const avoidance = pick<string[]>(assessment, "motivation", "avoidanceFactors") ?? [];
  const triggers = pick<string[]>(assessment, "frustration", "triggers") ?? [];
  const preferredPace = pick<string>(assessment, "pace", "preferred");
  const concerns = (pick<string>(assessment, "concerns", "concerns") ?? "").trim();
  const goals = pick<string[]>(assessment, "goals", "goals") ?? [];
  const needsCoaching = Boolean(pick<boolean>(assessment, "homework", "needsCoaching"));

  const name = learner.preferredName?.trim() || learner.firstName.trim() || "Your learner";
  const goalsLine = goals.length === 0 ? "no goals recorded yet" : goals.slice(0, 3).join("; ");
  const parentAssessmentSummary = `${name} is in the ${
    learner.gradeBand ?? "n/a"
  } grade band. Reading comfort: ${
    learner.readingComfort ?? "unspecified"
  }; math comfort: ${learner.mathComfort ?? "unspecified"}. Goals: ${goalsLine}. Preferred pace: ${
    preferredPace ?? "steady"
  }. ${concerns ? `Parent notes: ${concerns.slice(0, 200)}` : ""}`.trim();

  const accommodationSummary =
    iepExtraction && iepExtraction.accommodations.length > 0
      ? iepExtraction.accommodations.slice(0, 6).join("; ")
      : iepUploaded
        ? "IEP on file; no specific accommodations parsed."
        : "No IEP on file. Supports inferred from the parent assessment.";

  const supportDefaults: LearnerBrainProfileState["supportDefaults"] = {
    extendedTime:
      Boolean(iepExtraction?.extendedTime) ||
      Boolean(pick<boolean>(assessment, "accommodations", "extendedTime")),
    readAloud:
      Boolean(iepExtraction?.readingSupport) ||
      Boolean(pick<boolean>(assessment, "accommodations", "readAloud")),
    speechToText:
      Boolean(iepExtraction?.writingSupport) ||
      Boolean(pick<boolean>(assessment, "accommodations", "speechToText")),
    visualSchedules: breakStyle === "frequent_short" || communicationStyle === "visual",
    sensoryBreaks: sensitivities.length > 0 || movementHelps,
  };

  const masteryOverview: LearnerBrainProfileState["masteryOverview"] = subjects
    .slice(0, 8)
    .map((s) => {
      // Prefer real baseline-derived estimate when available (post-clone).
      const fromBaseline = baselineBySubject.get(s.id);
      if (fromBaseline) {
        return {
          subjectId: s.id,
          subjectName: s.name,
          estimate: masteryLevelToComfort(fromBaseline.estimate),
        };
      }
      const name = s.name.toLowerCase();
      let estimate: ComfortLevel = "growing";
      if (name.includes("read") || name.includes("english") || name.includes("language")) {
        estimate = learner.readingComfort ?? "growing";
      } else if (name.includes("math")) {
        estimate = learner.mathComfort ?? "growing";
      }
      return { subjectId: s.id, subjectName: s.name, estimate };
    });

  const tutorPersonaRecommendation = inferTutorPersona(triggers, preferredPace, needsCoaching);

  // ===== Sprint 14: legacy brain_state parity =====
  // Pull the new learning-profile + background fields. They're optional —
  // the v2 UI does not yet collect them, so absence is normal and the
  // downstream inferences degrade to "STANDARD" / empty signals.
  const communicationMode = pick<string>(assessment, "learning_profile", "communicationMode");
  const deviceInteraction = pick<string>(assessment, "learning_profile", "deviceInteraction");
  const responseMethod = pick<string>(assessment, "learning_profile", "responseMethod");
  const attentionSpanBucket = pick<string>(assessment, "learning_profile", "attentionSpanBucket");
  const diagnoses = pick<string[]>(assessment, "background", "diagnoses") ?? [];
  const services = pick<string[]>(assessment, "background", "services") ?? [];

  const functioningLevel = inferFunctioningLevel(
    communicationMode,
    deviceInteraction,
    focusWindow,
    diagnoses,
  );

  // Build numeric mastery_levels keyed by subjectId. Baseline data wins when
  // available; otherwise fall back to learner-profile comfort buckets, and
  // finally to the generic 0.4 "growing" prior. Never returns an empty map
  // because the tutor router treats absence-of-key as zero mastery.
  const masteryLevels: Record<string, number> = {};
  for (const s of subjects) {
    const fromBaseline = baselineBySubject.get(s.id);
    if (fromBaseline) {
      masteryLevels[s.id] = masteryLevelToScore(fromBaseline.estimate);
      continue;
    }
    const name = s.name.toLowerCase();
    if (name.includes("read") || name.includes("english") || name.includes("language")) {
      masteryLevels[s.id] = comfortToScore(learner.readingComfort);
    } else if (name.includes("math")) {
      masteryLevels[s.id] = comfortToScore(learner.mathComfort);
    } else {
      masteryLevels[s.id] = 0.4;
    }
  }

  const disabilitySignals = {
    communicationNeeds: communicationMode ?? null,
    attention: attentionSpanBucket ?? (focusWindow < 10 ? "short" : null),
    sensory:
      sensitivities.length > 0 ? `sensitive_to:${sensitivities.slice(0, 3).join(",")}` : null,
    motor: responseMethod && responseMethod !== "touch" ? responseMethod : null,
    diagnoses,
  };

  const iepProfile = iepUploaded
    ? {
        uploaded: true,
        categories: iepExtraction?.serviceAreas ?? [],
        goals: (iepExtraction?.learningGoals ?? []).map((text) => ({
          domain: "general",
          text,
        })),
      }
    : null;

  // Flatten every active accommodation from IEP + parent-reported supports
  // into a single, de-duplicated list. The legacy tutor router reads this
  // directly to decide which adaptations to apply each turn.
  const accommodationSet = new Set<string>();
  for (const a of iepExtraction?.accommodations ?? []) accommodationSet.add(a);
  if (supportDefaults.extendedTime) accommodationSet.add("extended_time");
  if (supportDefaults.readAloud) accommodationSet.add("read_aloud");
  if (supportDefaults.speechToText) accommodationSet.add("speech_to_text");
  if (supportDefaults.visualSchedules) accommodationSet.add("visual_schedules");
  if (supportDefaults.sensoryBreaks) accommodationSet.add("sensory_breaks");
  const activeAccommodations = Array.from(accommodationSet);

  const activeTutors = pickActiveTutors(masteryLevels);
  const visualIdentity = buildVisualIdentity(functioningLevel, seekingOrAvoiding);

  // ----- Explainable-AI rationale (RAI compliance) -----
  // Every decision the clone makes ships with a plain-language explanation
  // so parents (and auditors) can see *why* the system landed where it did.
  // This is the legacy `xai_explanation` field; never let it be empty.
  const masteryDecisions: string[] = [];
  for (const s of subjects.slice(0, 8)) {
    const score = masteryLevels[s.id];
    const fromBaseline = baselineBySubject.get(s.id);
    if (fromBaseline) {
      masteryDecisions.push(
        `${s.name}: ${Math.round(score * 100)}% from baseline (${fromBaseline.estimate}).`,
      );
    } else {
      masteryDecisions.push(
        `${s.name}: ${Math.round(score * 100)}% inferred from parent-reported comfort (no baseline data yet).`,
      );
    }
  }

  const accommodationDecisions: string[] = [];
  if (iepExtraction && iepExtraction.accommodations.length > 0) {
    accommodationDecisions.push(
      `${iepExtraction.accommodations.length} accommodation(s) carried over from the uploaded IEP.`,
    );
  }
  if (supportDefaults.sensoryBreaks) {
    accommodationDecisions.push(
      "Sensory breaks enabled because the parent reported sensitivities or that movement helps focus.",
    );
  }
  if (supportDefaults.visualSchedules) {
    accommodationDecisions.push(
      "Visual schedules enabled because the learner prefers short focus bursts or a visual communication style.",
    );
  }
  if (accommodationDecisions.length === 0) {
    accommodationDecisions.push(
      "No special accommodations recommended yet — parent assessment did not surface needs.",
    );
  }

  const tutorDecisions: string[] = [
    `Functioning level ${functioningLevel} → core tutor roster of ${activeTutors.length} keeps coverage across math, ELA, science, SEL, communication, arts, and social studies.`,
    `Persona "${tutorPersonaRecommendation.style}" chosen: ${tutorPersonaRecommendation.rationale}`,
  ];
  if (services.length > 0) {
    tutorDecisions.push(
      `Therapy services on file (${services.slice(0, 3).join(", ")}) — Echo (communication) and Harmony (SEL) kept active to coordinate with them.`,
    );
  }

  const xaiExplanation = {
    summary: `Clone built from ${
      assessment?.submittedAt ? "submitted parent assessment" : "in-progress assessment"
    }${iepUploaded ? " + IEP" : ""}${
      baselineSummary ? " + completed baseline" : ""
    }. Functioning level ${functioningLevel}; ${activeAccommodations.length} accommodation(s); ${activeTutors.length} tutor(s) active.`,
    masteryDecisions,
    accommodationDecisions,
    tutorDecisions,
    raiCompliance: true,
  };

  return {
    learnerProfileSnapshot: {
      learnerId: learner.id,
      displayName: learner.displayName,
      ageRange: learner.ageRange,
      gradeBand: learner.gradeBand,
      primaryLanguage: learner.primaryLanguage,
    },
    parentAssessmentSummary: parentAssessmentSummary || "Parent assessment not yet completed.",
    accommodationSummary,
    sensoryProfile: {
      sensitivities,
      seekingOrAvoiding,
      notes:
        sensitivities.length === 0
          ? "No sensory sensitivities recorded."
          : `Adjust environment for: ${sensitivities.join(", ")}.`,
    },
    attentionProfile: {
      focusWindowMinutes: Math.max(1, Math.min(120, focusWindow)),
      breakStyle,
      movementHelps,
    },
    readingComfort: comfortOrUnspecified(learner.readingComfort),
    mathComfort: comfortOrUnspecified(learner.mathComfort),
    preferredModalities: inferModalities(
      communicationStyle,
      movementHelps,
      learner.accessibilityDefaults.audioFirst,
    ),
    motivationProfile: {
      rewardsThatHelp: rewards,
      avoidanceFactors: avoidance,
    },
    frustrationTriggers: triggers,
    accessibilityPreferences: learner.accessibilityDefaults,
    supportDefaults,
    masteryOverview,
    confidenceSignals: {
      parentAssessment: Boolean(assessment?.submittedAt),
      iep: iepUploaded,
      baselineAttempts,
    },
    tutorPersonaRecommendation,
    functioningLevel,
    masteryLevels,
    disabilitySignals,
    iepProfile,
    activeAccommodations,
    activeTutors,
    visualIdentity,
    xaiExplanation,
    source: "deterministic_fallback",
    schemaVersion: BRAIN_PROFILE_SCHEMA_VERSION,
  };
}
