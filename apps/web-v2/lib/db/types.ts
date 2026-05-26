/**
 * Core domain types for AIVO v2. Mirrors the eventual Drizzle/Postgres schema
 * so when we wire a real DB (Sprint 24+) we swap the repository backing only.
 * Every entity carries tenantId for multi-tenant scoping.
 */
import type { Role } from "@/lib/auth/types";

export type ID = string;
export type ISODate = string;

export type FunctioningLevel =
  | "standard"
  | "supported"
  | "alternative"
  | "non_verbal"
  | "pre_symbolic";

// ===== Identity =====
export type User = {
  id: ID;
  email: string;
  displayName: string;
  createdAt: ISODate;
};

export type Tenant = {
  id: ID;
  type: "family" | "school" | "district" | "platform";
  name: string;
  parentTenantId: ID | null;
  createdAt: ISODate;
};

export type TenantMembership = {
  userId: ID;
  tenantId: ID;
  role: Role;
  permissions: string[];
  createdAt: ISODate;
};

// ===== Learner =====
export type ReadinessState =
  | "profile_created"
  | "assessment_needed"
  | "iep_optional"
  | "baseline_needed"
  | "ready_for_today_mission"
  | "active_learning";

export type ComfortLevel = "new" | "growing" | "confident" | "advanced";
export type GradeBand = "preK" | "K" | "1-2" | "3-5" | "6-8" | "9-12" | "post_secondary";
export type AgeRange = "3-5" | "5-7" | "7-9" | "9-11" | "11-13" | "13-15" | "15-18";

export type LearnerAccessibilityDefaults = {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  audioFirst: boolean;
  captionsAlwaysOn: boolean;
};

export type LearnerProfile = {
  id: ID;
  tenantId: ID;
  displayName: string;
  /** Plain-language first name as supplied by parent. */
  firstName: string;
  /** Optional preferred / nickname AIVO should use in lessons. */
  preferredName: string | null;
  birthYear: number;
  pronouns?: string;
  avatar?: string;
  ageRange: AgeRange | null;
  gradeBand: GradeBand | null;
  schoolContext: "in_school" | "homeschool" | "hybrid" | "not_in_school" | null;
  primaryLanguage: string | null;
  readingComfort: ComfortLevel | null;
  mathComfort: ComfortLevel | null;
  knownStrengths: string[];
  knownChallenges: string[];
  accessibilityDefaults: LearnerAccessibilityDefaults;
  /** Sprint A: parent-supplied US zip; null if not provided. */
  zipCode: string | null;
  /** Sprint A: NCES district ID resolved from the zip (or null). */
  districtId: string | null;
  /** Sprint A: human-readable district name for parent-facing UI. */
  districtName: string | null;
  functioningLevel: FunctioningLevel | null;
  readinessState: ReadinessState;
  /**
   * Sprint 6: parent's decision on the optional IEP upload.
   *  - "uploaded": at least one IEPDocument exists
   *  - "skipped": parent explicitly skipped
   *  - null: not yet decided
   * Used by readiness to advance past `iep_optional`.
   */
  iepDecision: "uploaded" | "skipped" | null;
  createdAt: ISODate;
};

export type ParentLearnerRelationship = {
  id: ID;
  parentUserId: ID;
  learnerId: ID;
  tenantId: ID;
  relation: "parent" | "guardian" | "caregiver";
  isPrimary: boolean;
};

export type ParentAssessmentSectionId =
  | "goals"
  | "grade_subject"
  | "reading"
  | "math"
  | "attention"
  | "communication"
  | "sensory"
  | "homework"
  | "frustration"
  | "motivation"
  | "accommodations"
  | "pace"
  | "concerns"
  // ----- Legacy-parity sections (Sprint 14: brain-clone enrichment) -----
  // The v2 UI does not yet collect these; the data shape is reserved so the
  // brain-clone pipeline + future intake screens can persist them without
  // another schema migration. All fields are optional and treated as null
  // when absent. See `brain_state` parity notes in replit.md.
  /** Date of birth, pronouns, primary languages. */
  | "basics"
  /** What the child loves, is good at, and what motivates them. */
  | "strengths"
  /** Diagnoses + currently-receiving services (speech, OT, ABA, …). */
  | "background"
  /** Communication mode (verbal/sign/AAC/non-verbal), device interaction,
   *  response method, attention-span bucket, best learning modes. Drives
   *  the legacy functioning-level inference. */
  | "learning_profile";

export type ParentAssessmentAnswer = string | string[] | number | boolean | null;

export type ParentAssessment = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  /** Section-keyed answer maps; each section's fields are open-shape and
   *  validated by section-specific Zod schemas at the BFF layer. */
  answers: Record<ParentAssessmentSectionId, Record<string, ParentAssessmentAnswer>>;
  completedSections: ParentAssessmentSectionId[];
  startedAt: ISODate;
  updatedAt: ISODate;
  submittedAt: ISODate | null;
};

/**
 * Structured fields extracted from an uploaded IEP. Raw IEP text is NEVER
 * stored here — only the parsed structured fields that the BFF / UI can show.
 * The three role-specific summaries (`learnerSafeSummary`, `parentSummary`,
 * `teacherSummary`) are the only narrative content; the learner-safe variant
 * is the only one a learner UI is permitted to render.
 */
export type IEPExtraction = {
  accommodations: string[];
  serviceAreas: string[];
  learningGoals: string[];
  assistiveTechnologyNeeds: string[];
  extendedTime: boolean;
  readingSupport: boolean;
  writingSupport: boolean;
  behavioralSupport: boolean;
  sensorySupport: boolean;
  communicationSupport: boolean;
  learnerSafeSummary: string;
  parentSummary: string;
  teacherSummary: string;
  generatedAt: ISODate;
  source: "ai_extraction" | "fallback_from_assessment" | "manual";
};

export type IEPDocument = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  fileName: string;
  mimeType: string;
  bytes: number;
  uploadedAt: ISODate;
  status: "pending" | "parsed" | "failed";
  extraction: IEPExtraction | null;
  /**
   * Sprint 5: subset of `extraction.accommodations` that the parent has
   * explicitly consented to. When `null` we treat the full extraction
   * list as implicit consent (legacy behavior). When an array, AIVO
   * only applies the listed supports to lessons / homework / tutor.
   */
  acceptedAccommodations: string[] | null;
  /** Sprint 5: ISO timestamp of when the parent confirmed supports. */
  confirmedAt: ISODate | null;
};

export type AccommodationSummary = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  accommodations: string[];
  generatedAt: ISODate;
  source: "iep" | "parent" | "manual";
};

/**
 * Sprint A1: detailed XAI / RAI decision shapes mirroring the
 * `services/brain-svc/src/brain_svc/services/clone_pipeline.py`
 * `_build_xai_explanation` payload. Optional on `xaiExplanation` so
 * the deterministic fallback (`lib/learner/brain-profile.ts`) can
 * keep emitting only the flat string summaries while the real clone
 * pipeline emits the richer arrays consumed by the upcoming
 * BrainExplainabilityPanel (Sprint A2) + parent approval gate
 * (Sprint A4).
 */
export type BrainRaiCompliance = {
  dataSources: string[];
  biasMitigations: string[];
  transparency: string;
  humanOversight: string;
};

export type BrainMasteryDecision = {
  domain: string;
  score: number;
  displayLabel: string;
  reasoning: string;
  source?: "discovery_adventure" | "template_default" | string;
  rawScore?: string;
  difficulty?: string;
};

export type BrainAccommodationDecision = {
  accommodation: string;
  displayLabel: string;
  reasoning: string;
  source?: "functioning_level_template" | "parent_modification" | string;
  removable?: boolean;
};

export type BrainTutorDecision = {
  tutorKey: string;
  reasoning: string;
  source?: "functioning_level_template" | string;
};

export type BrainSignalDecision = {
  signal: string;
  value: string;
  displayLabel: string;
  reasoning: string;
};

/**
 * Sprint 7: typed snapshot of the AI-generated brain profile. Persisted via
 * `LearnerBrainProfile.state` and validated by the Zod schema in
 * `lib/validators/brain-profile.ts` before being stored.
 */
export type LearnerBrainProfileState = {
  learnerProfileSnapshot: {
    learnerId: ID;
    displayName: string;
    ageRange: AgeRange | null;
    gradeBand: GradeBand | null;
    primaryLanguage: string | null;
  };
  parentAssessmentSummary: string;
  accommodationSummary: string;
  sensoryProfile: {
    sensitivities: string[];
    seekingOrAvoiding: "seeking" | "avoiding" | "mixed" | "neutral" | "unspecified";
    notes: string;
  };
  attentionProfile: {
    focusWindowMinutes: number;
    breakStyle: "frequent_short" | "occasional" | "long_uninterrupted" | "unspecified";
    movementHelps: boolean;
  };
  readingComfort: ComfortLevel | "unspecified";
  mathComfort: ComfortLevel | "unspecified";
  preferredModalities: ("visual" | "auditory" | "kinesthetic" | "reading_writing")[];
  motivationProfile: {
    rewardsThatHelp: string[];
    avoidanceFactors: string[];
  };
  frustrationTriggers: string[];
  accessibilityPreferences: LearnerAccessibilityDefaults;
  supportDefaults: {
    extendedTime: boolean;
    readAloud: boolean;
    speechToText: boolean;
    visualSchedules: boolean;
    sensoryBreaks: boolean;
  };
  masteryOverview: {
    subjectId: ID;
    subjectName: string;
    estimate: "new" | "growing" | "confident" | "advanced";
  }[];
  confidenceSignals: {
    parentAssessment: boolean;
    iep: boolean;
    baselineAttempts: number;
  };
  tutorPersonaRecommendation: {
    name?: string;
    style: "warm_coach" | "playful_friend" | "calm_guide" | "structured_mentor";
    rationale: string;
  };
  // ===== Sprint 14: legacy brain_state parity =====
  /**
   * Coarse functioning level used by the tutor router and curriculum
   * planner. Mirrors `brain-svc` enum (STANDARD, SUPPORTED, LOW_VERBAL,
   * NON_VERBAL, PRE_SYMBOLIC).
   */
  functioningLevel: "STANDARD" | "SUPPORTED" | "LOW_VERBAL" | "NON_VERBAL" | "PRE_SYMBOLIC";
  /** Per-subject mastery as a normalised score in [0, 1]. Keyed by subjectId. */
  masteryLevels: Record<string, number>;
  /** Raw, parent-/IEP-reported signals fed into the clone. */
  disabilitySignals: {
    communicationNeeds: string | null;
    attention: string | null;
    sensory: string | null;
    motor: string | null;
    diagnoses: string[];
  };
  /** Snapshot of the IEP at clone time (null if none uploaded). */
  iepProfile: {
    uploaded: boolean;
    categories: string[];
    goals: { domain: string; text: string }[];
  } | null;
  /** Flattened accommodations actually active for the learner. */
  activeAccommodations: string[];
  /** Tutor slugs the clone recommends keeping active for this learner. */
  activeTutors: string[];
  /** UI theme metadata for the learner's "brain" visualisation. */
  visualIdentity: {
    primaryHue: string;
    secondaryHues: string[];
    pulseRate: "calm" | "steady" | "energetic";
  };
  /** Explainable-AI breakdown: human-readable rationale for every decision
   *  the clone made. Required for RAI compliance + parent review screens.
   *
   *  Sprint A1 (Brain Clone Process Animation) added optional `*Detailed`
   *  decision arrays + `raiComplianceDetail` to mirror the richer payload
   *  produced by `services/brain-svc/src/brain_svc/services/clone_pipeline.py`
   *  (`_build_xai_explanation`). The flat string arrays + boolean
   *  `raiCompliance` remain for back-compat with the deterministic
   *  fallback path in `lib/learner/brain-profile.ts`. New consumers
   *  (RAI/XAI tabs, approval gate) should prefer the `*Detailed`
   *  fields when present and fall back to the flat fields otherwise. */
  xaiExplanation: {
    summary: string;
    masteryDecisions: string[];
    accommodationDecisions: string[];
    tutorDecisions: string[];
    raiCompliance: boolean;
    masteryDecisionsDetailed?: BrainMasteryDecision[];
    accommodationDecisionsDetailed?: BrainAccommodationDecision[];
    tutorDecisionsDetailed?: BrainTutorDecision[];
    signalDecisionsDetailed?: BrainSignalDecision[];
    raiComplianceDetail?: BrainRaiCompliance;
  };
  source: "ai_generated" | "deterministic_fallback";
  schemaVersion: number;
};

/**
 * Brain profile lifecycle:
 *   pre_clone — built from parent assessment (+ IEP) only, before baseline.
 *   cloned    — rebuilt at end of baseline using real per-domain mastery
 *               (mirrors brain-svc `/api/brain/clone` in production).
 *   approved  — parent reviewed the cloned profile and accepted it.
 */
export type BrainProfileCloneStage = "pre_clone" | "cloned" | "approved";

/**
 * Approval lifecycle for a cloned brain profile, mirrors legacy
 * `brain_states.approval_status`:
 *   pending_parent_review — clone exists but parent hasn't reviewed.
 *   approved              — parent accepted as-is.
 *   amended               — parent accepted with overrides; their overrides
 *                           are persisted on top of the original clone.
 */
export type BrainProfileApprovalStatus = "pending_parent_review" | "approved" | "amended";

export type LearnerBrainProfile = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  state: LearnerBrainProfileState;
  /** @deprecated Use `approvalStatus`. Kept for read back-compat; always
   *  equals `approvalStatus === "approved"`. */
  approvedByParent: boolean;
  approvalStatus: BrainProfileApprovalStatus;
  cloneStage: BrainProfileCloneStage;
  /** Timestamp of the post-baseline clone, null while in pre_clone. */
  clonedAt: ISODate | null;
  generatedAt: ISODate;
  updatedAt: ISODate;
};

export type AccessibilityPreferences = {
  learnerId: ID;
  tenantId: ID;
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  audioFirst: boolean;
  captionsAlwaysOn: boolean;
  hapticsEnabled: boolean;
  // Sprint 15 additions — full preference surface drives lesson UI + generation.
  readAloud: boolean;
  dyslexiaFriendlyFont: boolean;
  shorterSteps: boolean;
  extraHints: boolean;
  visualSupports: boolean;
  breakReminders: boolean;
  keyboardOptimized: boolean;
  // Sprint 7 — AAC bridge integration. When `aacEnabled` is true the
  // lesson player and tutor chat mount the AACTargetProvider and route
  // focus/selection through the configured input method.
  aacEnabled: boolean;
  aacInputMethod: "touch" | "switch_1" | "switch_2" | "eye_gaze" | "head_pointer";
  aacScanDelayMs: number;
  updatedAt: ISODate;
};

/** Defaults applied when no preferences are stored for a learner. */
export const ACCESSIBILITY_DEFAULTS: Omit<
  AccessibilityPreferences,
  "learnerId" | "tenantId" | "updatedAt"
> = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  audioFirst: false,
  captionsAlwaysOn: false,
  hapticsEnabled: false,
  readAloud: false,
  dyslexiaFriendlyFont: false,
  shorterSteps: false,
  extraHints: false,
  visualSupports: false,
  breakReminders: false,
  keyboardOptimized: false,
  aacEnabled: false,
  aacInputMethod: "touch",
  aacScanDelayMs: 1000,
};

// ===== Curriculum =====
export type Subject = {
  id: ID;
  slug: string;
  name: string;
  description: string;
  iconKey: string;
};

export type Skill = {
  id: ID;
  subjectId: ID;
  slug: string;
  name: string;
  gradeBand: string;
  prerequisites: ID[];
};

/** Sprint 9: per-learner mastery snapshot. One MasteryMap per learner. */
export type MasteryMap = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  generatedAt: ISODate;
  updatedAt: ISODate;
};

export type SkillMasteryLevel =
  | "not_started"
  | "emerging"
  | "approaching"
  | "on_grade_level"
  | "stretching";

export type SkillMastery = {
  learnerId: ID;
  skillId: ID;
  subjectId: ID;
  tenantId: ID;
  /** 0..1 confidence in the level estimate. */
  confidence: number;
  /** Derived bucket from the underlying 0..1 score. */
  level: SkillMasteryLevel;
  /** 0..1 mastery score from blended baseline + lesson signals. */
  score: number;
  /** True when this skill is queued for review. */
  needsReview: boolean;
  lastEvaluatedAt: ISODate | null;
};

// ===== Baseline (Sprint 8) =====
export type BaselineDifficulty = "foundational" | "approaching" | "grade_level" | "stretch";

export type BaselineAssessment = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  /** Subjects covered by this baseline (reading + math by default). */
  subjectIds: ID[];
  status: "not_started" | "in_progress" | "complete";
  startedAt: ISODate | null;
  completedAt: ISODate | null;
  createdAt: ISODate;
  /** Summary computed when status transitions to complete. */
  summary: BaselineSummary | null;
  /** Sprint B2: where the questions came from + token/model accounting
   *  for the audit trail. Optional for back-compat with baselines
   *  created before B2 (those rows simply have no metadata). */
  generationMetadata?: BaselineGenerationMetadata;
};

/**
 * Sprint B2: per-baseline provenance recorded when the BFF generates
 * a question set. `source` is the discriminator the parent UI uses to
 * render a "Personalized by AI" badge (when "ai") vs a "Calm starter"
 * badge (when "fallback").
 */
export type BaselineGenerationMetadata = {
  source: "ai" | "fallback";
  /** Why we fell back (only set when source === "fallback"). */
  fallbackReason?: string;
  /** LLM model that produced the questions (only when source === "ai"). */
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  /**
   * Phase B — present when the Discovery Adventure path produced
   * questions. Lists the chapter IDs that succeeded so the parent
   * dashboard can surface coverage gaps when one subject failed and
   * was filled by a different path.
   */
  chaptersUsed?: string[];
  /**
   * Phase B — per-chapter failure reasons. Empty/omitted when every
   * chapter succeeded. Populated even on the happy path when at least
   * one chapter failed but others compensated, so rollout dashboards
   * can track partial-failure rates.
   */
  chapterFailures?: { chapterId: string; reason: string }[];
  generatedAt: ISODate;
};

export type BaselineSummary = {
  totalQuestions: number;
  totalAnswered: number;
  correctCount: number;
  perSubject: {
    subjectId: ID;
    subjectName: string;
    answered: number;
    correct: number;
    accuracy: number;
    estimate: SkillMasteryLevel;
  }[];
  recommendedStartSkillId: ID | null;
  parentSummary: string;
  learnerSafeSummary: string;
};

export type BaselineQuestion = {
  id: ID;
  baselineId: ID;
  subjectId: ID;
  skillId: ID;
  order: number;
  prompt: string;
  choices?: string[];
  /**
   * Optional per-choice emoji parallel to `choices`. When present,
   * the renderer uses it as the leading glyph on each choice card.
   * Picture-referencing prompts (e.g., "Which word matches the
   * picture of a cat?") MUST set this so the choice for "cat" shows
   * a 🐱 rather than just the word.
   */
  choiceEmojis?: string[];
  /**
   * Optional scene emoji shown above the prompt as a visual anchor
   * for picture-prompts (e.g., the cat picture above the cat
   * question). Larger than the per-choice glyph.
   */
  sceneEmoji?: string;
  /**
   * Optional inline illustration URL. Reserved for the LLM /
   * Discovery Adventure path when a model emits an actual image
   * rather than an emoji.
   */
  imageUrl?: string;
  /** Alt text for `imageUrl`. */
  imageAlt?: string;
  expectedAnswer?: string;
  hint?: string;
  readAloudText?: string;
  difficulty: BaselineDifficulty;
  accommodationTags: string[];
};

export type BaselineAttempt = {
  id: ID;
  baselineId: ID;
  questionId: ID;
  learnerId: ID;
  tenantId: ID;
  response: string;
  isCorrect: boolean;
  /** Whether the learner skipped (vs gave a real answer). */
  skipped: boolean;
  respondedAt: ISODate;
};

// ===== Learning Path (Sprint 9) =====
export type LearningPathNodeKind = "first_skill" | "next_unmastered" | "review" | "stretch";

export type LearningPathNode = {
  id: ID;
  order: number;
  subjectId: ID;
  skillId: ID;
  kind: LearningPathNodeKind;
  reason: string;
  estimatedMinutes: number;
};

export type LearningPath = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  generatedAt: ISODate;
  /** Source MasteryMap snapshot id this path was derived from. */
  basedOnMasteryMapId: ID | null;
  nodes: LearningPathNode[];
};

export type ReviewSchedule = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  skillId: ID;
  dueAt: ISODate;
  reason: string;
};

// ===== Lesson (Sprints 10–11) =====
export type LessonRunSource =
  | "today_mission"
  | "quest"
  | "homework"
  | "baseline_followup"
  | "parent_assigned"
  | "teacher_assigned"
  | "review"
  | "subject_path";

export type LessonRunStatus =
  | "generating"
  | "ready"
  | "in_progress"
  | "completed"
  | "failed"
  | "abandoned";

/**
 * Snapshot of the learner context captured when a LessonRun is created.
 * Frozen with the run so a refresh/resume always sees the same lesson the
 * tutor started with, even if the learner's brain profile updates later.
 */
export type LessonContextSnapshot = {
  displayName: string;
  ageRange: AgeRange | null;
  gradeBand: GradeBand | null;
  primaryLanguage: string | null;
  preferredModalities: ("visual" | "auditory" | "kinesthetic" | "reading_writing")[];
  tutorStyle: "warm_coach" | "playful_friend" | "calm_guide" | "structured_mentor";
};

export type LessonMasterySnapshot = {
  skillId: ID;
  subjectId: ID;
  score: number;
  level: SkillMasteryLevel;
  confidence: number;
  /** Other skills in this subject and their levels, ordered by score asc. */
  subjectContext: { skillId: ID; score: number; level: SkillMasteryLevel }[];
};

export type LessonAccommodationSnapshot = {
  /** Distilled tags such as "extended_time", "read_aloud", etc. */
  tags: string[];
  /** Booleans the tutor honors during plan generation. */
  supportDefaults: {
    extendedTime: boolean;
    readAloud: boolean;
    speechToText: boolean;
    visualSchedules: boolean;
    sensoryBreaks: boolean;
  };
  accessibility: LearnerAccessibilityDefaults;
};

/**
 * Sprint 11: the full tutor-generated plan. Validated by Zod before persist;
 * a malformed plan is repaired/retried by the AI adapter, not stored.
 */
export type GeneratedLessonPlan = {
  id: ID;
  lessonRunId: ID;
  tenantId: ID;
  title: string;
  objective: string;
  estimatedMinutes: number;
  tutorPersona: string;
  tutorGreeting: string;
  storyHook: string;
  microLesson: string;
  example: {
    prompt: string;
    explanation: string;
  };
  guidedPractice: Array<{
    id: ID;
    prompt: string;
    expectedAnswer?: string;
    choices?: string[];
    hint: string;
    scaffold: string;
    skillId: ID;
    surfaceType?: string;
    media?: {
      surfaceType: "video" | "audio";
      assets: Array<{
        id: string;
        kind: "video" | "audio" | "captions";
        src: string;
        alt?: string;
        mimeType?: string;
        language?: string;
        label?: string;
        default?: boolean;
      }>;
    };
  }>;
  checksForUnderstanding: Array<{
    id: ID;
    prompt: string;
    expectedAnswer?: string;
    choices?: string[];
    supportIfWrong: string;
    surfaceType?: string;
    media?: {
      surfaceType: "video" | "audio";
      assets: Array<{
        id: string;
        kind: "video" | "audio" | "captions";
        src: string;
        alt?: string;
        mimeType?: string;
        language?: string;
        label?: string;
        default?: boolean;
      }>;
    };
  }>;
  accessibilitySupports: string[];
  encouragement: string;
  parentSummary: string;
  nextRecommendedStep: string;
  generatedAt: ISODate;
  /** Generator telemetry. */
  generation: {
    provider: "mock" | "ai";
    model: string;
    attempts: number;
    latencyMs: number;
    schemaVersion: number;
  };
};

export type LessonRun = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  subjectId: ID;
  /** Primary skill targeted by the LessonRun. */
  skillId: ID;
  source: LessonRunSource;
  /** ID of the LearningPathNode / Quest / Assignment / ReviewSchedule that
   *  caused this run. null when ad-hoc. */
  sourceRefId: ID | null;
  tutorPersona: string;
  learnerContextSnapshot: LessonContextSnapshot;
  masterySnapshot: LessonMasterySnapshot;
  accommodationSnapshot: LessonAccommodationSnapshot;
  /** Frozen brain-profile state at run-creation time. Reused by retry so
   *  regenerated plans don't drift when the brain profile is later edited. */
  brainStateSnapshot: LearnerBrainProfileState;
  /** Pointer to the GeneratedLessonPlan record (null while generating). */
  lessonPlanId: ID | null;
  status: LessonRunStatus;
  /** Retry counter for failed generation. */
  retryCount: number;
  /** Last error message when status === "failed". */
  failureReason: string | null;
  startedAt: ISODate | null;
  completedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type LessonStepKind =
  | "intro"
  | "story_hook"
  | "micro_lesson"
  | "example"
  | "guided_practice"
  | "check"
  | "check_for_understanding"
  | "encouragement"
  | "celebrate"
  | "progress_update"
  | "next_step"
  | "answer_submitted"
  | "hint_used"
  | "scaffold_used";

export type LessonInteraction = {
  id: ID;
  lessonRunId: ID;
  learnerId: ID;
  tenantId: ID;
  stepKind: LessonStepKind;
  /** Plan-item id (guidedPractice or check id) when stepKind is one of those. */
  stepRefId: ID | null;
  response: string | null;
  isCorrect: boolean | null;
  skipped: boolean;
  occurredAt: ISODate;
};

export type ParentProgressSummary = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  weekOf: ISODate;
  summary: string;
  highlights: string[];
};

/** Sprint 13/14: outcome captured by the lesson player on completion. Drives
 *  mastery delta + parent summary copy. */
export type LessonOutcome = {
  checksTotal: number;
  checksCorrect: number;
  hintsUsed: number;
  scaffoldsUsed: number;
  secondsActive: number;
  abandoned: boolean;
};

/** Sprint 14: per-LessonRun plain-language summary surfaced in the parent
 *  dashboard. Never contains raw IEP text or raw AI JSON. */
export type ParentLessonSummary = {
  id: ID;
  lessonRunId: ID;
  learnerId: ID;
  tenantId: ID;
  subjectId: ID;
  skillId: ID;
  /** 1–2 sentence plain-language headline (e.g. "Sky practiced CVC words
   *  in Reading with one hint."). */
  headline: string;
  /** Short bullets: what went well, where the learner needed help, supports
   *  used, recommended next step. */
  highlights: {
    whatWorkedOn: string;
    wentWell: string;
    neededHelp: string | null;
    supportsUsed: string[];
    recommendedNext: string;
  };
  /** Snapshot of the mastery delta this run produced. */
  masteryDelta: {
    before: number;
    after: number;
    levelBefore: SkillMasteryLevel;
    levelAfter: SkillMasteryLevel;
  };
  createdAt: ISODate;
};

// ===== Quest =====
export type QuestWorld = {
  id: ID;
  slug: string;
  name: string;
  description: string;
};

export type QuestChapter = {
  id: ID;
  questWorldId: ID;
  order: number;
  title: string;
  /** Plain-language description shown on the chapter card. */
  description: string;
  /** Skills this chapter exercises. Sprint 16 picks `skillIds[0]` to seed the LessonRun. */
  skillIds: ID[];
  subjectId: ID;
  /** Boss chapters unlock only after every chapter in `prerequisiteChapterIds` is complete. */
  isBoss: boolean;
  prerequisiteChapterIds: ID[];
};

export type QuestProgress = {
  id: ID;
  learnerId: ID;
  questWorldId: ID;
  chapterId: ID;
  tenantId: ID;
  progress: number; // 0..1
  updatedAt: ISODate;
};

// ===== Helper / Teacher =====
export type HomeworkHelpMessage = {
  id: ID;
  role: "learner" | "tutor";
  text: string;
  /** True for tutor messages that intentionally withhold the final answer. */
  guidedOnly?: boolean;
  occurredAt: ISODate;
};

/**
 * Sprint 1 (learner roadmap): an optional attachment uploaded when the learner
 * starts a homework session — a photo of their work or a PDF worksheet.
 * Stored inline (base64) in dev/local; in production this would be moved
 * to object storage with a signed URL.
 */
export type HomeworkAttachment = {
  /** MIME type, restricted to a small allow-list (see lib/homework/attachments). */
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "application/pdf";
  /** Original filename if provided by the learner; null for camera captures. */
  filename: string | null;
  /** Decoded byte size; used for the UI chip and to enforce the size cap. */
  sizeBytes: number;
  /** Base64-encoded payload (without the data: prefix). */
  dataBase64: string;
};

export type HomeworkHelpSession = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  topic: string;
  /** Subject classified from the topic when possible (e.g. "math", "reading"). */
  subjectId: ID | null;
  /** Optional photo/PDF uploaded at session start. */
  attachment: HomeworkAttachment | null;
  messages: HomeworkHelpMessage[];
  /** Plain-language insight written on complete — what the learner practiced. */
  insight: string | null;
  /** Optional follow-up LessonRun created at completion time. */
  followUpRunId: ID | null;
  startedAt: ISODate;
  endedAt: ISODate | null;
};

export type TeacherAssignment = {
  id: ID;
  teacherId: ID;
  tenantId: ID;
  /** Optional class scope; null for ad-hoc assignments to specific learners. */
  classId: ID | null;
  title: string;
  instructions: string;
  subjectId: ID;
  skillIds: ID[];
  learnerIds: ID[];
  status: "active" | "archived";
  dueAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
};

// ===== Ops =====
export type AuditLog = {
  id: ID;
  userId: ID | null;
  tenantId: ID | null;
  learnerId: ID | null;
  action: string;
  metadata: Record<string, unknown>;
  requestId: string;
  occurredAt: ISODate;
};

export type AiGenerationJob = {
  id: ID;
  tenantId: ID;
  kind: "brain_profile" | "lesson_plan" | "baseline" | "summary";
  status: "queued" | "running" | "complete" | "failed";
  inputRef: string;
  outputRef: string | null;
  startedAt: ISODate;
  completedAt: ISODate | null;
};

export type BillingAccount = {
  id: ID;
  tenantId: ID;
  plan: "free" | "family" | "school" | "district";
  status: "trialing" | "active" | "past_due" | "canceled";
  createdAt: ISODate;
};

export type SupportTicket = {
  id: ID;
  userId: ID;
  tenantId: ID;
  subject: string;
  body: string;
  status: "open" | "in_progress" | "resolved";
  createdAt: ISODate;
};

// ===== Sprint 24: Consent, terms, age-gate (data layer only; production auth
// swap is intentionally deferred). Every consent decision is versioned so
// that policy updates require fresh acceptance per COPPA / FERPA practice.
export const CONSENT_TYPES = [
  "parent_account_terms",
  "parent_privacy_policy",
  "child_data_collection",
  "iep_document_storage",
  "ai_personalization",
  "school_roster_import",
  "teacher_access",
  "marketing_opt_in",
  "data_export_request",
  "data_deletion_request",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export type ConsentVersion = {
  id: ID;
  consentType: ConsentType;
  version: string;
  effectiveAt: ISODate;
  summary: string;
};

export type ConsentRecord = {
  id: ID;
  tenantId: ID;
  parentUserId: ID;
  learnerId: ID | null;
  consentType: ConsentType;
  version: string;
  acceptedAt: ISODate;
  revokedAt: ISODate | null;
  ipHash: string | null;
  userAgent: string | null;
};

export type TermsAcceptance = {
  id: ID;
  tenantId: ID;
  userId: ID;
  termsVersion: string;
  acceptedAt: ISODate;
};

export type AgeGateRecord = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  recordedByUserId: ID;
  ageRange: string | null;
  requiresParentConsent: boolean;
  recordedAt: ISODate;
};

// ────────────────────────────────────────────────────────────────────────────
// Sprint 25 — Privacy, compliance, DSAR.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Coarse-grained classification per the sprint plan. Drives retention rules,
 * who can request export/deletion, and which surfaces may render the data.
 */
export const DATA_CLASSIFICATIONS = [
  "public",
  "account_data",
  "parent_data",
  "learner_profile_data",
  "education_record",
  "iep_sensitive_document",
  "ai_generated_learning_data",
  "usage_telemetry",
  "billing_data",
  "support_data",
  "security_audit_data",
] as const;
export type DataClassification = (typeof DATA_CLASSIFICATIONS)[number];

/**
 * Lawful basis labels. Kept as a small union so the UI can render a stable
 * legend; not an exhaustive GDPR Art. 6 mapping.
 */
export type LawfulBasis =
  | "consent"
  | "contract"
  | "legitimate_interest"
  | "legal_obligation"
  | "ferpa_education_record";

export type DataProcessingPurpose =
  | "service_delivery"
  | "personalization"
  | "safety_and_moderation"
  | "billing_and_accounting"
  | "support"
  | "security_audit"
  | "research_with_consent";

export type DataInventoryItem = {
  id: ID;
  key: string;
  classification: DataClassification;
  description: string;
  purposes: DataProcessingPurpose[];
  lawfulBasis: LawfulBasis;
  storeLocation: "primary_db" | "object_storage" | "audit_log" | "cache";
  containsChildData: boolean;
  ownedBy: "parent" | "school" | "platform";
};

export type DataRetentionPolicy = {
  id: ID;
  classification: DataClassification;
  retentionDays: number;
  /** Days after the retention window during which records are archived (read-only). */
  archiveDays: number;
  description: string;
  updatedAt: ISODate;
  updatedByUserId: ID | null;
};

export type DisclosureRecipientType =
  | "school_official"
  | "auditor"
  | "law_enforcement"
  | "parent"
  | "court_order"
  | "ferpa_directory"
  | "other";

export type DisclosureLog = {
  id: ID;
  tenantId: ID;
  learnerId: ID | null;
  recipientType: DisclosureRecipientType;
  recipientName: string;
  reason: string;
  /** Short FERPA basis label — e.g. "school_official_exception", "parent_consent". */
  ferpaBasis: string;
  disclosedAt: ISODate;
  disclosedByUserId: ID;
};

export type PrivacyRequestKind = "export" | "delete" | "rectify" | "restrict";
export type PrivacyRequestStatus = "pending" | "approved" | "in_progress" | "completed" | "denied";

export type DataExportRequest = {
  id: ID;
  tenantId: ID;
  parentUserId: ID;
  learnerId: ID | null;
  status: PrivacyRequestStatus;
  requestedAt: ISODate;
  completedAt: ISODate | null;
  /** Mock signed URL pointer; real impl writes to object storage. */
  exportUrl: string | null;
  notes: string | null;
};

export type DataDeletionRequest = {
  id: ID;
  tenantId: ID;
  parentUserId: ID;
  learnerId: ID | null;
  status: PrivacyRequestStatus;
  requestedAt: ISODate;
  completedAt: ISODate | null;
  /** Scope of deletion the parent requested. */
  scope: "account" | "learner" | "iep_only";
  notes: string | null;
};

export type IEPDocumentAccessLog = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  documentId: ID;
  accessedByUserId: ID;
  accessedAt: ISODate;
  purpose: "view_summary" | "view_raw" | "extract" | "delete" | "download";
};

export type PolicyKind =
  | "privacy_policy"
  | "terms_of_service"
  | "coppa_notice"
  | "ferpa_notice"
  | "dpa_template";

export type PolicyVersion = {
  id: ID;
  kind: PolicyKind;
  version: string;
  effectiveAt: ISODate;
  summary: string;
  url: string | null;
};

export type DPARecord = {
  id: ID;
  tenantId: ID;
  schoolName: string;
  signedAt: ISODate | null;
  expiresAt: ISODate | null;
  status: "draft" | "active" | "expired" | "terminated";
  notes: string | null;
};

export type SubprocessorRecord = {
  id: ID;
  name: string;
  purpose: string;
  region: string;
  status: "active" | "deprecated";
  dpaUrl: string | null;
};

// ===== Sprint 26: Curriculum / Standards / Skill Graph =====
//
// The existing Subject + Skill rows (seeded since S9) are kept as-is to avoid
// breaking 20+ call sites that read them. S26 adds standards alignment, domain
// hierarchy, prerequisite graph (separate from the array on Skill so we can
// store a strength/notes per edge), skill versioning, and curriculum maps
// alongside lesson objective + assessment blueprint templates that AI gen
// reads as constraints.

export type StandardsFrameworkSlug =
  | "common-core-math"
  | "common-core-ela"
  | "ngss-science"
  | "state-placeholder"
  | "aivo-extensions";

export type StandardsFramework = {
  id: ID;
  slug: StandardsFrameworkSlug;
  name: string;
  issuer: string;
  description: string;
  homepageUrl: string | null;
  status: "active" | "deprecated";
};

export type StandardDocument = {
  id: ID;
  frameworkId: ID;
  /** e.g. "K-5", "6-8", "9-12" within a framework. */
  scope: string;
  title: string;
  version: string;
  publishedAt: ISODate;
  /** Total Standards referenced by this document (denormalized for listing). */
  standardCount: number;
};

export type Standard = {
  id: ID;
  frameworkId: ID;
  documentId: ID;
  /** Canonical code in the framework, e.g. CCSS.MATH.CONTENT.1.OA.A.1 */
  code: string;
  title: string;
  description: string;
  gradeBand: string;
  /** Free-form taxonomy path, e.g. "Operations & Algebraic Thinking > Add/Subtract within 20". */
  taxonomyPath: string[];
};

export type Domain = {
  id: ID;
  subjectId: ID;
  slug: string;
  name: string;
  description: string;
  /** Optional sort order within the subject. */
  orderIndex: number;
};

/**
 * Prerequisite edge in the skill graph. Stored separately from
 * `Skill.prerequisites: ID[]` so we can attach edge metadata (strength,
 * notes) without bloating the Skill row. The array on Skill remains the
 * fast-read view for AI gen.
 */
export type SkillPrerequisite = {
  id: ID;
  skillId: ID;
  prerequisiteSkillId: ID;
  /** "hard" = cannot teach skill before prereq; "soft" = recommended. */
  strength: "hard" | "soft";
  notes: string | null;
  createdAt: ISODate;
};

/**
 * Versioning row for a Skill. Each Skill has at least one SkillVersion; the
 * version with the latest effectiveAt is treated as current. AI gen reads
 * the current version's objectiveSummary as the bounded scope.
 */
export type SkillVersion = {
  id: ID;
  skillId: ID;
  version: string;
  effectiveAt: ISODate;
  objectiveSummary: string;
  /** Marks one version as the active/current version. */
  isCurrent: boolean;
};

/**
 * A CurriculumMap connects a Skill to the standards it covers, plus the
 * Domain bucket and grade band, so an admin can see "this skill teaches
 * CCSS.MATH.1.OA.A.1 + CCSS.MATH.1.OA.A.2". One row per (skill, standard)
 * pair, intentionally many-to-many.
 */
export type CurriculumMap = {
  id: ID;
  skillId: ID;
  domainId: ID;
  standardId: ID;
  /** Strength of the alignment; admins may flag indirect coverage as "supports". */
  alignment: "primary" | "supports" | "introduces";
};

export type LessonObjectiveTemplate = {
  id: ID;
  skillId: ID;
  /** Short title shown in admin UI. */
  title: string;
  /** Bulleted learning objectives the lesson must address. */
  objectives: string[];
  /** Suggested introductory question or hook. */
  hook: string;
  status: "draft" | "active" | "retired";
  createdAt: ISODate;
};

export type AssessmentBlueprintItemKind =
  | "concept_check"
  | "application"
  | "transfer"
  | "common_misconception";

export type AssessmentBlueprint = {
  id: ID;
  skillId: ID;
  name: string;
  description: string;
  /** Distribution of question kinds and counts that any baseline run for this
   *  skill must satisfy. Sum of counts = total questions. */
  items: {
    kind: AssessmentBlueprintItemKind;
    count: number;
    /** 0..1 expected mastery threshold for "on grade level" on this kind. */
    masteryThreshold: number;
  }[];
  status: "draft" | "active" | "retired";
  createdAt: ISODate;
};

export type CurriculumImportJob = {
  id: ID;
  frameworkSlug: StandardsFrameworkSlug;
  /** Source identifier — file name, URL, or "manual". */
  source: string;
  status: "queued" | "running" | "succeeded" | "failed";
  startedAt: ISODate;
  completedAt: ISODate | null;
  imported: { frameworks: number; documents: number; standards: number };
  /** First error if status=failed. */
  error: string | null;
  requestedByUserId: ID;
};

// ===== Sprint 27: AI Safety & Moderation =====

export type SafetyCategory =
  | "self_harm"
  | "violence"
  | "sexual_content"
  | "adult_contact_risk"
  | "bullying"
  | "hate_or_harassment"
  | "medical_or_legal_advice"
  | "prompt_injection"
  | "privacy_leakage"
  | "academic_cheating"
  | "unsafe_external_link"
  | "diagnostic_labeling";

export type SafetySeverity = "info" | "low" | "medium" | "high" | "critical";

export type SafetyDecision = "allow" | "review" | "block";

export type SafetySubjectKind =
  | "tutor_response"
  | "lesson_plan"
  | "homework_input"
  | "user_message"
  | "uploaded_text";

export type SafetyClassification = {
  /** All categories that matched at any confidence above the policy floor. */
  categories: SafetyCategory[];
  /** category -> 0..1 score from the classifier ruleset. */
  confidences: Partial<Record<SafetyCategory, number>>;
  /** Overall worst-case severity for the highest-scoring category. */
  severity: SafetySeverity;
  /** Final decision after policy thresholds applied. */
  decision: SafetyDecision;
  /** SafetyPolicyVersion.id that produced this classification. */
  policyVersionId: ID;
};

export type PromptInjectionSignal = {
  /** Regex/pattern slug that matched (e.g. "ignore_previous_instructions"). */
  pattern: string;
  /** Excerpt around the match for the human reviewer. */
  snippet: string;
};

export type CrisisSignal = {
  category: "self_harm" | "harm_to_other" | "abuse_disclosure";
  severity: SafetySeverity;
  /** Phrase that triggered the crisis classifier. */
  excerpt: string;
};

export type ModerationEvent = {
  id: ID;
  tenantId: ID;
  /** If the moderated content was per a learner; null for tenant-wide. */
  learnerId: ID | null;
  subjectKind: SafetySubjectKind;
  /** Free-form ref into the originating record (lessonRunId, sessionId, etc.). */
  subjectRefId: string | null;
  /** Snippet of the moderated content; may be a sanitized excerpt. */
  excerpt: string;
  classification: SafetyClassification;
  injectionSignals: PromptInjectionSignal[];
  crisisSignals: CrisisSignal[];
  /** User attribution: who produced the moderated content. */
  createdByUserId: ID | null;
  /** Whether a HumanReviewCase was opened for this event. */
  reviewCaseId: ID | null;
  createdAt: ISODate;
};

export type HumanReviewCaseStatus =
  | "open"
  | "in_review"
  | "resolved_allow"
  | "resolved_block"
  | "escalated";

export type HumanReviewCase = {
  id: ID;
  eventId: ID;
  tenantId: ID;
  learnerId: ID | null;
  status: HumanReviewCaseStatus;
  assignedToUserId: ID | null;
  /** Reviewer note + final disposition. */
  resolution: string | null;
  resolvedByUserId: ID | null;
  resolvedAt: ISODate | null;
  escalatedAt: ISODate | null;
  createdAt: ISODate;
};

export type SafetyPolicyVersion = {
  id: ID;
  version: string;
  effectiveAt: ISODate;
  /** Snapshot of the active ruleset for traceability. */
  ruleset: {
    blockThreshold: number;
    reviewThreshold: number;
    /** Categories that auto-escalate to a human reviewer regardless of score. */
    autoReviewCategories: SafetyCategory[];
    /** Categories that always result in a block. */
    autoBlockCategories: SafetyCategory[];
  };
  status: "active" | "retired";
};

export type BlockedGeneration = {
  id: ID;
  tenantId: ID;
  learnerId: ID | null;
  subjectKind: SafetySubjectKind;
  reason: string;
  /** Replacement text shown to the user. */
  fallbackResponse: string;
  createdAt: ISODate;
};

export type TutorResponseAudit = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  /** Either a lessonRunId or a homeworkSessionId. */
  contextKind: "lesson_run" | "homework_session";
  contextRefId: string;
  tutorPersona: string;
  excerpt: string;
  classification: SafetyClassification;
  createdAt: ISODate;
};

export type HomeworkInputAudit = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  homeworkSessionId: string;
  rawExcerpt: string;
  sanitizedExcerpt: string;
  classification: SafetyClassification;
  /** True when the sanitizer removed at least one PII-looking span. */
  piiRedacted: boolean;
  createdAt: ISODate;
};

// ===== Sprint 28: TTS / Read-Aloud / Audio Caching =====

export type TTSVoiceId =
  | "warm_female"
  | "warm_male"
  | "calm_neutral"
  | "kid_friendly"
  | "narrator_low"
  | "narrator_high";

export type AudioFormat = "mp3" | "ogg" | "wav";

/**
 * An AudioAsset is the durable record of a generated read-aloud clip.
 * The clip itself is referenced by `storageKey` (e.g. an S3 key in prod, or a
 * data: URL slot in the mock); `durationMs` and `format` are denormalized for
 * fast UI rendering.
 */
export type AudioAsset = {
  id: ID;
  tenantId: ID;
  /** Stable hash of (text, voiceId, languageCode, pronunciationOverrideSetHash). */
  contentHash: string;
  text: string;
  voiceId: TTSVoiceId;
  languageCode: string;
  format: AudioFormat;
  durationMs: number;
  /** Where the audio bytes live. Opaque to the BFF. */
  storageKey: string;
  /** Captions/transcript blob, line-by-line. */
  captions: { startMs: number; endMs: number; text: string }[];
  /** Cost in micro-USD so a single int field captures fractional cents. */
  costMicroUsd: number;
  /** Provider that generated this clip ("mock" in dev). */
  provider: string;
  createdAt: ISODate;
};

export type TTSGenerationJobStatus = "queued" | "running" | "completed" | "failed" | "cached_hit";

export type TTSGenerationJob = {
  id: ID;
  tenantId: ID;
  learnerId: ID | null;
  text: string;
  voiceId: TTSVoiceId;
  languageCode: string;
  status: TTSGenerationJobStatus;
  audioAssetId: ID | null;
  /** Surfaced to the UI when status === "failed". */
  errorMessage: string | null;
  createdAt: ISODate;
  completedAt: ISODate | null;
};

export type PronunciationOverride = {
  id: ID;
  tenantId: ID;
  /** Token as it appears in source text (case-insensitive match). */
  token: string;
  /** SSML phoneme or grapheme replacement used by the TTS adapter. */
  replacement: string;
  /** "ipa" | "x-sampa" | "plain" — the encoding of `replacement`. */
  encoding: "ipa" | "x-sampa" | "plain";
  /** Scope: platform = all tenants; otherwise restricted to one tenant. */
  scope: "platform" | "tenant";
  /** Free-form context for the admin reviewer (subject, dialect, etc.). */
  notes: string | null;
  createdByUserId: ID;
  createdAt: ISODate;
};

export type LearnerVoicePreference = {
  learnerId: ID;
  tenantId: ID;
  voiceId: TTSVoiceId;
  /** 0.5 - 2.0. Capped on the server to keep clips intelligible. */
  speed: number;
  /** True when the learner's parent has enabled read-aloud. */
  enabled: boolean;
  /** True when transcripts/captions are always shown. */
  captionsAlways: boolean;
  updatedAt: ISODate;
};

export type ReadAloudContextKind =
  | "baseline_question"
  | "lesson_step"
  | "homework_message"
  | "ui_label";

/**
 * Per-playback usage event, used by the admin cost dashboard and to flag
 * runaway TTS spend. One row per playback, not per generation.
 */
export type ReadAloudUsageEvent = {
  id: ID;
  tenantId: ID;
  learnerId: ID | null;
  audioAssetId: ID;
  contextKind: ReadAloudContextKind;
  /** Free-form ref to the originating step / question / message. */
  contextRefId: string | null;
  /** True when the asset already existed (no provider call charged). */
  cacheHit: boolean;
  /** Cost charged to the tenant for this playback (0 on cache hit). */
  costMicroUsd: number;
  createdAt: ISODate;
};

/**
 * Lightweight cache index: contentHash → audioAssetId, scoped by tenant +
 * language. Lets `prewarm` and `tts` short-circuit before calling the
 * provider. The actual AudioAsset is the source of truth — this is a hint.
 */
export type AudioCacheEntry = {
  contentHash: string;
  tenantId: ID;
  languageCode: string;
  audioAssetId: ID;
  hits: number;
  lastHitAt: ISODate;
};

// ===== Sprint 29: Rostering / SIS / Sync / Notifications =====

export type SchoolGradeBand = "K-2" | "3-5" | "6-8" | "9-12";

export type School = {
  id: ID;
  tenantId: ID;
  name: string;
  /** NCES school id when available; opaque otherwise. */
  externalId: string | null;
  gradeBands: SchoolGradeBand[];
  city: string | null;
  state: string | null;
  createdAt: ISODate;
};

export type Classroom = {
  id: ID;
  tenantId: ID;
  schoolId: ID;
  /** Human-friendly room/section label (e.g. "Mrs. Smith — 4A"). */
  name: string;
  gradeBand: SchoolGradeBand;
  /** Primary teacher (user id). Co-teachers tracked via Enrollment. */
  teacherUserId: ID;
  /** Optional course id; one course can run across many classrooms. */
  courseId: ID | null;
  createdAt: ISODate;
};

export type Course = {
  id: ID;
  tenantId: ID;
  schoolId: ID;
  name: string;
  /** Subject id from S26 curriculum graph. */
  subjectId: ID;
  gradeBand: SchoolGradeBand;
  createdAt: ISODate;
};

export type EnrollmentRole = "learner" | "teacher" | "co_teacher";

export type Enrollment = {
  id: ID;
  tenantId: ID;
  classroomId: ID;
  /** Either a learnerId (learner role) or a userId (teacher / co_teacher). */
  subjectId: ID;
  /** "learner" → subjectId is a learnerId; otherwise a userId. */
  role: EnrollmentRole;
  createdAt: ISODate;
};

export type RosterImportSource =
  | "csv"
  | "oneroster_v1p1"
  | "oneroster_v1p2"
  | "clever"
  | "classlink";
export type RosterImportStatus = "queued" | "running" | "completed" | "failed" | "dry_run";

export type RosterImportJob = {
  id: ID;
  tenantId: ID;
  schoolId: ID;
  source: RosterImportSource;
  status: RosterImportStatus;
  /** Counts surfaced to the admin UI. */
  totalRows: number;
  createdRows: number;
  updatedRows: number;
  skippedRows: number;
  errorRows: number;
  /** True if this was a dry-run preview (no writes). */
  dryRun: boolean;
  createdByUserId: ID;
  createdAt: ISODate;
  completedAt: ISODate | null;
};

export type RosterImportError = {
  id: ID;
  jobId: ID;
  rowNumber: number;
  /** Raw input row (header → value). */
  row: Record<string, string>;
  message: string;
};

export type SISProvider = "oneroster" | "clever" | "classlink";

export type SISConnection = {
  id: ID;
  tenantId: ID;
  schoolId: ID;
  provider: SISProvider;
  /** Display label for the connection (e.g. "Acme USD — Clever"). */
  label: string;
  /** Stub fields; production stores them encrypted at rest. */
  clientId: string;
  /** Last successful sync. null when never synced. */
  lastSyncedAt: ISODate | null;
  status: "active" | "paused" | "error";
  createdAt: ISODate;
};

export type ExternalRosterMapping = {
  id: ID;
  tenantId: ID;
  connectionId: ID;
  /** Internal entity kind: classroom / course / learner / teacher. */
  entityKind: "classroom" | "course" | "learner" | "teacher";
  internalId: ID;
  externalId: string;
  createdAt: ISODate;
};

export type DeviceSession = {
  id: ID;
  tenantId: ID;
  userId: ID;
  /** Stable client-generated device identifier (cookie or local storage). */
  deviceFingerprint: string;
  userAgent: string;
  lastSeenAt: ISODate;
  createdAt: ISODate;
};

export type LessonSyncState = {
  lessonRunId: ID;
  tenantId: ID;
  learnerId: ID;
  /** Monotonic counter — clients submit-then-read to detect conflicts. */
  version: number;
  /** Free-form state blob owned by the lesson player. */
  state: Record<string, unknown>;
  /** Last device that wrote state — surfaced to other devices for awareness. */
  lastWriterDeviceId: ID;
  updatedAt: ISODate;
};

export type NotificationType =
  | "parent_progress_summary"
  | "baseline_completed"
  | "lesson_completed"
  | "teacher_assignment_created"
  | "teacher_assignment_due"
  | "streak_reminder"
  | "quest_unlocked"
  | "iep_extraction_ready"
  | "data_request_completed"
  | "billing_notice"
  | "safety_review_required";

export type NotificationChannel = "in_app" | "email" | "push";

export type Notification = {
  id: ID;
  tenantId: ID;
  /** Recipient user. */
  userId: ID;
  type: NotificationType;
  title: string;
  body: string;
  /** Where the user lands when they tap/click. */
  href: string | null;
  /** Optional learner this notification refers to, for IEP/learner-context. */
  learnerId: ID | null;
  readAt: ISODate | null;
  createdAt: ISODate;
};

export type NotificationPreference = {
  userId: ID;
  tenantId: ID;
  /** Per-type, per-channel boolean. Keyed `${type}:${channel}`. */
  preferences: Record<string, boolean>;
  /** Quiet hours, e.g. "22:00-07:00". null disables. */
  quietHours: string | null;
  /** Digest cadence override for parent_progress_summary. */
  digestCadence: "daily" | "weekly" | "off";
  updatedAt: ISODate;
};

export type NotificationDeliveryStatus = "pending" | "sent" | "failed" | "skipped";

export type NotificationDelivery = {
  id: ID;
  notificationId: ID;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  /** Provider message id for de-dup / receipts. */
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptedAt: ISODate;
};

export type DigestSchedule = {
  id: ID;
  tenantId: ID;
  userId: ID;
  type: NotificationType;
  cadence: "daily" | "weekly";
  /** ISO weekday 1-7 (1=Mon). null for daily. */
  weekday: number | null;
  /** 24h hour 0-23. */
  hour: number;
  nextRunAt: ISODate;
  lastRunAt: ISODate | null;
};

// ===== Sprint 30: Billing, AI cost controls, Migration =====

export type PlanAudience = "family" | "school" | "district";
export type PlanInterval = "monthly" | "yearly";
export type Plan = {
  id: ID;
  code: string;
  name: string;
  audience: PlanAudience;
  description: string;
  features: string[];
  maxLearners: number | null;
  maxSeats: number | null;
  active: boolean;
  createdAt: ISODate;
};
export type Price = {
  id: ID;
  planId: ID;
  /** Lowest currency unit (cents). */
  amountCents: number;
  currency: "USD";
  interval: PlanInterval;
  trialDays: number;
  active: boolean;
  createdAt: ISODate;
};

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "paused";
export type Subscription = {
  id: ID;
  tenantId: ID;
  /** Owner user; parent for family plans, admin for school/district. */
  ownerUserId: ID;
  planId: ID;
  priceId: ID;
  status: SubscriptionStatus;
  trialEndAt: ISODate | null;
  currentPeriodStartAt: ISODate;
  currentPeriodEndAt: ISODate;
  cancelAtPeriodEnd: boolean;
  canceledAt: ISODate | null;
  /** Mock-provider customer id; real Stripe id in production. */
  externalCustomerId: string | null;
  createdAt: ISODate;
};

export type InvoiceStatus = "open" | "paid" | "void" | "uncollectible";
export type Invoice = {
  id: ID;
  subscriptionId: ID;
  tenantId: ID;
  amountCents: number;
  currency: "USD";
  status: InvoiceStatus;
  periodStartAt: ISODate;
  periodEndAt: ISODate;
  paidAt: ISODate | null;
  number: string;
  createdAt: ISODate;
};

export type SeatLicense = {
  id: ID;
  tenantId: ID;
  subscriptionId: ID;
  totalSeats: number;
  createdAt: ISODate;
};
export type SeatAssignment = {
  id: ID;
  licenseId: ID;
  tenantId: ID;
  /** Either a learnerId (most common) or a teacher userId. */
  subjectId: ID;
  subjectKind: "learner" | "teacher";
  assignedAt: ISODate;
  revokedAt: ISODate | null;
};

export type AIBudget = {
  tenantId: ID;
  /** Monthly cap in cents. null = unbounded (platform tenant). */
  monthlyCapCents: number | null;
  /** Soft warning threshold 0..1 — alert when usage crosses it. */
  warnAt: number;
  /** Hard stop — when true, requests are denied at 100% of cap. */
  hardStop: boolean;
  updatedAt: ISODate;
};

export type AICostEvent = {
  id: ID;
  tenantId: ID;
  feature: "baseline" | "lesson_plan" | "homework_help" | "tts" | "moderation" | "other";
  provider: "anthropic" | "openai" | "google" | "elevenlabs" | "mock";
  model: string;
  /** Cost in cents (fractional ok). */
  amountCents: number;
  promptTokens: number;
  completionTokens: number;
  learnerId: ID | null;
  occurredAt: ISODate;
};

export type MigrationJobStatus = "queued" | "running" | "completed" | "failed" | "dry_run";
export type MigrationJob = {
  id: ID;
  /** Source system label, e.g. "v1-postgres-readreplica". */
  source: string;
  /** What this job migrates — drives the runner. */
  kind: "users" | "learners" | "iep_documents" | "lesson_runs";
  dryRun: boolean;
  status: MigrationJobStatus;
  totalRecords: number;
  successRecords: number;
  failedRecords: number;
  skippedRecords: number;
  createdByUserId: ID;
  createdAt: ISODate;
  completedAt: ISODate | null;
};
export type MigrationRecord = {
  id: ID;
  jobId: ID;
  sourceId: string;
  targetId: ID | null;
  status: "migrated" | "skipped" | "failed";
  message: string | null;
  attemptedAt: ISODate;
};

// ===== Sprint 31: Security / SOC 2 / Privacy law matrix / Incident response =====

export type TrustServicesCriterion =
  | "security"
  | "availability"
  | "processing_integrity"
  | "confidentiality"
  | "privacy";
export type ControlStatus = "implemented" | "partial" | "not_started" | "not_applicable";
export type SecurityControl = {
  id: ID;
  /** Short code, e.g. "CC6.1" (Common Criteria) or "AIVO-AC-01". */
  code: string;
  title: string;
  description: string;
  criterion: TrustServicesCriterion;
  /** Free-form owner role label, e.g. "Platform Security". */
  owner: string;
  status: ControlStatus;
  lastReviewedAt: ISODate;
  createdAt: ISODate;
};
export type SecurityControlEvidence = {
  id: ID;
  controlId: ID;
  /** What kind of artifact — log, policy doc, screenshot, runbook ID, etc. */
  kind: "policy" | "log" | "config" | "screenshot" | "report" | "runbook" | "ticket";
  summary: string;
  /** External URL or repo path. Optional because some evidence is verbal. */
  uri: string | null;
  collectedByUserId: ID;
  collectedAt: ISODate;
};

export type RiskSeverity = "low" | "medium" | "high" | "critical";
export type RiskTreatment = "accept" | "mitigate" | "transfer" | "avoid";
export type RiskRegisterEntry = {
  id: ID;
  title: string;
  description: string;
  category: "security" | "privacy" | "availability" | "operational" | "third_party";
  inherentSeverity: RiskSeverity;
  residualSeverity: RiskSeverity;
  treatment: RiskTreatment;
  owner: string;
  /** True when the risk is currently being actively addressed. */
  open: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type IncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";
export type IncidentStatus = "open" | "investigating" | "mitigating" | "resolved" | "post_mortem";
export type Incident = {
  id: ID;
  title: string;
  summary: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  /** Who owns the incident bridge. */
  commanderUserId: ID;
  /** True if this incident may have exposed customer or learner data. */
  customerImpact: boolean;
  /** True if regulators must be notified (FERPA / state breach laws). */
  regulatorNotificationRequired: boolean;
  detectedAt: ISODate;
  resolvedAt: ISODate | null;
  createdAt: ISODate;
};
export type IncidentTimelineEvent = {
  id: ID;
  incidentId: ID;
  authorUserId: ID;
  /** Tag the kind of update so the post-mortem reads naturally. */
  kind: "detection" | "investigation" | "mitigation" | "communication" | "resolution" | "note";
  message: string;
  occurredAt: ISODate;
};

export type VendorRiskTier = "tier1" | "tier2" | "tier3";
export type Vendor = {
  id: ID;
  name: string;
  category:
    | "llm_provider"
    | "tts_provider"
    | "infra"
    | "analytics"
    | "support"
    | "billing"
    | "other";
  /** Where the vendor processes data, e.g. "US", "EU", "Global". */
  dataResidency: string;
  /** True if the vendor processes learner data. Drives subprocessor disclosure. */
  processesLearnerData: boolean;
  /** True if a DPA / BAA / contract is signed and on file. */
  dpaSigned: boolean;
  riskTier: VendorRiskTier;
  lastReviewedAt: ISODate;
  approved: boolean;
  notes: string | null;
  createdAt: ISODate;
};

export type StatePrivacyLawCode =
  | "FERPA"
  | "COPPA"
  | "SOPIPA_CA"
  | "NY_2D"
  | "IL_SOPPA"
  | "CO_SDP"
  | "CT_PA1814"
  | "STUDENT_PRIVACY_PLEDGE";
export type StatePrivacyRequirement = {
  id: ID;
  code: StatePrivacyLawCode;
  /** Human label, e.g. "California SOPIPA" or "Student Privacy Pledge". */
  label: string;
  jurisdiction: string;
  summary: string;
  /** Key operator obligation, e.g. "Prohibits targeted advertising to students." */
  obligation: string;
  createdAt: ISODate;
};
export type StatePrivacyControlMappingStatus = "covered" | "partial" | "gap" | "not_applicable";
export type StatePrivacyControlMapping = {
  id: ID;
  requirementId: ID;
  /** Pointer to the SecurityControl that satisfies this obligation. */
  controlId: ID;
  status: StatePrivacyControlMappingStatus;
  evidence: string;
  reviewedByUserId: ID;
  reviewedAt: ISODate;
};

export type VulnerabilitySeverity = "low" | "medium" | "high" | "critical";
export type VulnerabilityStatus = "open" | "triaged" | "fixed" | "wontfix";
export type VulnerabilityReport = {
  id: ID;
  title: string;
  /** CVE id or internal finding id. */
  cveId: string | null;
  severity: VulnerabilitySeverity;
  status: VulnerabilityStatus;
  /** Where the finding came from. */
  source:
    | "dependency_scan"
    | "container_scan"
    | "iac_scan"
    | "pen_test"
    | "external_report"
    | "internal";
  affectedComponent: string;
  /** Free-form, e.g. ">=1.2.3" or "patched in 4.5.0". */
  fixedIn: string | null;
  discoveredAt: ISODate;
  resolvedAt: ISODate | null;
};

// ===== Tenant settings (district/school admin) =====
/**
 * Per-tenant configuration surfaced through the district + school admin
 * dashboards. Drives branding (display name, support email, primary colour),
 * notification preferences, and product feature overrides.
 *
 * Persisted in the in-memory store today; will move to a `tenant_settings`
 * Postgres table when Drizzle wires the real DB. Defaults are filled in by
 * `getTenantSettings()` so a freshly created tenant always returns sane
 * values without needing a write.
 */
export type TenantNotificationPrefs = {
  weeklyDigestEmail: boolean;
  incidentAlertsEmail: boolean;
  rosterDriftEmail: boolean;
  complianceRemindersEmail: boolean;
};

export type TenantFeatureOverrides = {
  /** District-level toggle: allow learners to use the homework helper. */
  homeworkHelpEnabled: boolean;
  /** Permit families to upload IEP documents directly. */
  parentIepUploadEnabled: boolean;
  /** Show the avatar shop + virtual currency to learners. */
  rewardsShopEnabled: boolean;
  /** Allow the Discovery Adventure baseline assessment. */
  discoveryAdventureEnabled: boolean;
};

export type TenantSSOConfig = {
  /** "off" until a real IdP has been configured. */
  mode: "off" | "saml" | "oidc";
  /** Display name shown on the learner/staff login page. */
  idpName: string | null;
  /** Metadata URL for SAML or discovery URL for OIDC. */
  metadataUrl: string | null;
  /** Whether SCIM provisioning is permitted from the IdP. */
  scimEnabled: boolean;
  /** Last time a SCIM token was rotated. */
  lastScimRotationAt: ISODate | null;
};

export type TenantBranding = {
  /** Override for the tenant display name shown in product chrome. */
  displayName: string | null;
  /** Public-facing support email for this tenant's families/staff. */
  supportEmail: string | null;
  /** Hex colour (`#RRGGBB`) used as the primary brand accent. */
  primaryColor: string | null;
};

export type TenantSettings = {
  tenantId: ID;
  branding: TenantBranding;
  notifications: TenantNotificationPrefs;
  features: TenantFeatureOverrides;
  sso: TenantSSOConfig;
  updatedAt: ISODate;
};

// ============================================================
// Platform-admin billing & operations
// ============================================================

export type CouponStatus = "active" | "expired" | "disabled";
export type CouponDiscount =
  | { kind: "percent"; percentOff: number }
  | { kind: "amount"; amountOffCents: number; currency: "USD" };

export type Coupon = {
  id: ID;
  code: string;
  name: string;
  discount: CouponDiscount;
  status: CouponStatus;
  redemptionsCount: number;
  maxRedemptions: number | null;
  appliesToPlans: Array<"family" | "school" | "district"> | null;
  validFrom: ISODate;
  validUntil: ISODate | null;
  createdAt: ISODate;
};

export type DailyBillingBatchStatus = "scheduled" | "running" | "success" | "partial" | "failed";

export type DailyBillingBatch = {
  id: ID;
  runDate: ISODate;
  status: DailyBillingBatchStatus;
  invoicesGenerated: number;
  invoicesFailed: number;
  totalAmountCents: number;
  startedAt: ISODate;
  finishedAt: ISODate | null;
  errorMessage: string | null;
};

// ============================================================
// Platform-admin settings: API keys, email templates, webhooks
// ============================================================

export type PlatformApiKeyStatus = "active" | "revoked";

export type PlatformApiKey = {
  id: ID;
  label: string;
  prefix: string;
  scopes: string[];
  status: PlatformApiKeyStatus;
  createdByUserId: ID;
  createdAt: ISODate;
  lastUsedAt: ISODate | null;
  revokedAt: ISODate | null;
};

export type PlatformEmailTemplateStatus = "active" | "draft";

export type PlatformEmailTemplate = {
  id: ID;
  key: string;
  name: string;
  description: string;
  subject: string;
  fromName: string;
  fromEmail: string;
  status: PlatformEmailTemplateStatus;
  sendCount: number;
  lastSentAt: ISODate | null;
  updatedAt: ISODate;
};

export type PlatformWebhookDeliveryStatus = "success" | "failed" | "pending";
export type PlatformWebhookStatus = "active" | "disabled";

export type PlatformWebhookEndpoint = {
  id: ID;
  url: string;
  description: string;
  events: string[];
  status: PlatformWebhookStatus;
  secretPrefix: string;
  failureCount: number;
  createdAt: ISODate;
  lastDeliveryAt: ISODate | null;
  lastStatus: PlatformWebhookDeliveryStatus | null;
};

// ============================================================
// Sprint 30: Parent enterprise parity — engagement, badges, sensory
// ============================================================

export type LearnerEngagement = {
  learnerId: ID;
  tenantId: ID;
  totalXp: number;
  level: number;
  currentStreakDays: number;
  longestStreakDays: number;
  coins: number;
  gems: number;
  lastSessionAt: ISODate | null;
  updatedAt: ISODate;
};

export type BadgeKey =
  | "first_session"
  | "on_fire"
  | "brain_activated"
  | "bookworm"
  | "mastery_champion"
  | "goal_getter"
  | "team_player"
  | "multi_subject"
  | "speed_learner"
  | "explorer";

export type LearnerBadge = {
  id: ID;
  learnerId: ID;
  tenantId: ID;
  badgeKey: BadgeKey;
  earnedAt: ISODate;
};

export type SensoryModality = "visual" | "auditory" | "tactile" | "vestibular" | "proprioception";

export type SensoryResponse = "hyper" | "neutral" | "hypo" | "unknown";

export type LearnerSensoryProfile = {
  learnerId: ID;
  tenantId: ID;
  modalities: Record<SensoryModality, SensoryResponse>;
  notes: string;
  updatedAt: ISODate;
};

// ---------------------------------------------------------------------------
// Sprint 9 / 10 — therapist + caregiver domain. Kept separate from the
// IEPDocument extraction blob so goals can be edited, scored, and
// progressed independently of the source PDF.
// ---------------------------------------------------------------------------

export type IepGoalStatus =
  | "draft"
  | "active"
  | "met"
  | "not_met"
  | "discontinued";

export type IepGoalRecord = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  /** Who authored the goal — typically the therapist or special-ed
   *  teacher who owns the discipline. */
  authoredByUserId: ID;
  domain: string;
  goalText: string;
  baseline: string;
  targetCriteria: string;
  measurableCriteria: string;
  status: IepGoalStatus;
  /** Progress percentage 0..100 captured at the most recent session. */
  progressPct: number;
  /** Optional ordered list of {date, value, note} for trend reporting. */
  dataPoints: Array<{ date: ISODate; value: number; note?: string }>;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type TherapistSessionNote = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  therapistUserId: ID;
  sessionDate: ISODate;
  durationMinutes: number;
  /** SOAP template — Subjective / Objective / Assessment / Plan. */
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  /** Goals worked on this session (referenced for progress trending). */
  goalIds: ID[];
  /** Signed off when the therapist marks the note final. */
  signedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
};

export type CaregiverObservation = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  caregiverUserId: ID;
  observedAt: ISODate;
  behaviour: string;
  antecedent: string;
  consequence: string;
  durationMinutes: number | null;
  location: string;
  /** Optional attachment reference — image / video uploaded separately. */
  attachmentUrl: string | null;
  createdAt: ISODate;
};

// ---------------------------------------------------------------------------
// Sprint 11 — AI-drafted IEPs surfaced to the teacher review queue.
// Mirrors the iep_drafts postgres table introduced by services/ai-svc
// Sprint 6; here we use it client-side so the teacher dashboard can
// show / edit / approve drafts before the IEP team finalises.
// ---------------------------------------------------------------------------

export type IepAiDraftStatus =
  | "ai_draft"
  | "teacher_review"
  | "admin_approved"
  | "active"
  | "archived";

export type IepAiDraftGoal = {
  domain: string;
  goalText: string;
  baseline: string;
  targetCriteria: string;
  measurableCriteria: string;
  evidence: string[];
};

export type IepAiDraftAccommodation = {
  type: string;
  description: string;
  frequency: string;
  rationale: string;
  priority: number;
};

export type IepAiDraftService = {
  serviceType: string;
  minutesPerWeek: number;
  frequency: string;
  location: string;
  rationale: string;
};

export type IepAiDraftBody = {
  summary: string;
  goals: IepAiDraftGoal[];
  accommodations: IepAiDraftAccommodation[];
  services: IepAiDraftService[];
  risks: string[];
};

export type IepAiDraftRecord = {
  id: ID;
  tenantId: ID;
  learnerId: ID;
  sourceAttemptId: ID | null;
  status: IepAiDraftStatus;
  draft: IepAiDraftBody;
  model: string | null;
  responsibleAi: Record<string, unknown>;
  generatedAt: ISODate;
  reviewedByUserId: ID | null;
  reviewedAt: ISODate | null;
  approvedByUserId: ID | null;
  approvedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
};
