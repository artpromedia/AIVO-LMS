export * from "./learning-events.js";
export * from "./problem-session-events.js";

export const EVENTS = {
  ASSESSMENT_COMPLETED: "assessment.completed",
  ASSESSMENT_STARTED: "assessment.started",
  BRAIN_CLONE_REQUESTED: "brain.clone.requested",
  BRAIN_CLONE_COMPLETED: "brain.clone.completed",
  BRAIN_SNAPSHOT_CREATED: "brain.snapshot.created",
  BRAIN_RECOMMENDATION_CREATED: "brain.recommendation.created",
  BRAIN_RECOMMENDATION_RESOLVED: "brain.recommendation.resolved",
  USER_REGISTERED: "user.registered",
  USER_LOGGED_IN: "user.logged_in",
  LEARNER_CREATED: "learner.created",
  LEARNER_LEVEL_CHANGED: "learner.level_changed",
  IEP_UPLOADED: "iep.uploaded",
  IEP_PARSED: "iep.parsed",
  XP_EARNED: "engagement.xp_earned",
  BADGE_AWARDED: "engagement.badge_awarded",
  STREAK_UPDATED: "engagement.streak_updated",
  TUTOR_ACTIVATED: "tutor.activated",
  TUTOR_DEACTIVATED: "tutor.deactivated",
  TUTOR_SESSION_STARTED: "tutor.session.started",
  TUTOR_SESSION_COMPLETED: "tutor.session.completed",
  LESSON_SESSION_STARTED: "learner.session.started",
  LESSON_SESSION_COMPLETED: "learner.session.completed",
  CONTENT_GENERATED: "content.generated",
  CONTENT_QUALITY_FAILED: "content.quality.failed",
  MASTERY_UPDATED: "brain.mastery.updated",
  CONSENT_GRANTED: "consent.granted",
  CONSENT_REVOKED: "consent.revoked",
  SUBSCRIPTION_CHANGED: "subscription.changed",
  SPEECH_BUDDY_SESSION_STARTED: "speech_buddy.session.started",
  SPEECH_BUDDY_SESSION_ENDED: "speech_buddy.session.ended",
  SPEECH_BUDDY_TURN_RECORDED: "speech_buddy.turn.recorded",
  SPEECH_BUDDY_SKILL_EVIDENCE: "speech_buddy.skill.evidence",
  SPEECH_BUDDY_SAFETY_FLAG_RAISED: "speech_buddy.safety.flag.raised",
  SPEECH_BUDDY_QUEST_ASSIGNED: "speech_buddy.quest.assigned",
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];

export interface AivoEvent<T = unknown> {
  id: string;
  type: EventName;
  tenantId: string;
  timestamp: string;
  payload: T;
  source: string;
}

export interface AssessmentCompletedPayload {
  attemptId: string;
  learnerId: string;
  type: string;
  domainScores: Record<string, number>;
}

export interface BrainCloneRequestedPayload {
  learnerId: string;
  assessmentId: string;
  functioningLevel: string;
  parentAssessmentId?: string;
  iepProfileId?: string;
}

export interface BrainCloneCompletedPayload {
  learnerId: string;
  brainStateId: string;
  snapshotId: string;
  version: number;
}

export interface LearnerLevelChangedPayload {
  learnerId: string;
  previousLevel: string;
  newLevel: string;
  reason: string;
}

export interface TutorSessionCompletedPayload {
  sessionId: string;
  learnerId: string;
  tutorSku: string;
  tutorName: string;
  skillsFocused: string[];
  masteryUpdates: Record<string, number>;
  durationSeconds: number;
  completionQuality: number;
  xpEarned: number;
}

export interface LessonSessionCompletedPayload {
  sessionId: string;
  learnerId: string;
  subject: string;
  contentType: string;
  masteryBefore: Record<string, number>;
  masteryAfter: Record<string, number>;
  xpEarned: number;
  durationSeconds: number;
}

export interface ContentGeneratedPayload {
  sessionId: string;
  learnerId: string;
  subject: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  qualityScore: number;
}

export interface MasteryUpdatedPayload {
  learnerId: string;
  subject: string;
  skill: string;
  previousScore: number;
  newScore: number;
  source: string;
}

/* ----------------------------------------------------------------------------
 * Speech Buddy shared types
 *
 * These are the stable surface that ai-svc, tutor-svc, engagement-svc, and the
 * web/mobile clients all import from. Adding a new SkillTag, AgeBand, or
 * SafetyFlagCategory must be done here first, then in the docs at
 * docs/products/speech-buddy/.
 * ----------------------------------------------------------------------------
 */

/** Age bands for Speech Buddy. Captured at consent time, never inferred. */
export const AGE_BANDS = ["6-9", "10-12", "13-15"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];

/**
 * SEL micro-skill identifiers. Stable strings — must match the SEL skill map
 * table in docs/products/speech-buddy/README.md.
 */
export const SKILL_TAGS = [
  "name_a_feeling",
  "notice_body_signal",
  "pause_before_reacting",
  "use_calm_strategy",
  "read_a_facial_cue",
  "take_others_perspective",
  "ask_open_question",
  "give_a_compliment",
  "repair_a_rupture",
  "weigh_two_options",
  "consider_consequences",
] as const;
export type SkillTag = (typeof SKILL_TAGS)[number];

/** Categories enforced by the safety filter. See safety.md. */
export const SAFETY_FLAG_CATEGORIES = [
  "self_harm",
  "abuse_disclosure",
  "romantic_sexual",
  "violence",
  "medical_advice",
  "pii",
  "jailbreak",
] as const;
export type SafetyFlagCategory = (typeof SAFETY_FLAG_CATEGORIES)[number];

export type SafetyFlagSeverity = "soft" | "hard";

export interface SafetyFlag {
  /** Correlation id for the turn this flag was raised on. */
  correlationId: string;
  category: SafetyFlagCategory;
  severity: SafetyFlagSeverity;
  /** Which side raised the flag — child input or buddy output. */
  source: "child_input" | "buddy_output";
  /**
   * Which layer of the filter fired (regex blocklist, classifier, LLM judge).
   * Logged for auditability; never includes transcript text.
   */
  layer: "regex" | "classifier" | "llm_judge";
  raisedAt: string;
}

/** Speech Buddy session state machine vertices. */
export type SpeechBuddyState =
  | "greet"
  | "pickScenario"
  | "roleplayTurn"
  | "reflect"
  | "assignQuest"
  | "farewell";

export interface SpeechBuddySession {
  id: string;
  tenantId: string;
  /** Hashed learner id when used in events; never the raw learner id in logs. */
  learnerId: string;
  ageBand: AgeBand;
  /** Per-session nickname token. The child's real name is never in prompts. */
  nicknameToken: string;
  /** Locale of the session (BCP-47). Must be a shipped locale. */
  locale: string;
  state: SpeechBuddyState;
  startedAt: string;
  endedAt?: string;
  /** Skill tags the planner is targeting this session. */
  targetedSkills: SkillTag[];
  consentRecordId: string;
}

export interface TurnEvent {
  sessionId: string;
  turnIndex: number;
  /** Who spoke this turn. */
  speaker: "child" | "buddy";
  /** Stable correlation id used by safety logs and audit trail. */
  correlationId: string;
  /** Skill evidence produced by `scoreTurn` for this turn. */
  skillEvidence: Array<{ skill: SkillTag; weight: number }>;
  /** Any safety flags raised on this turn (empty array if clean). */
  safetyFlags: SafetyFlag[];
  recordedAt: string;
}

export interface SpeechBuddySessionStartedPayload {
  sessionId: string;
  ageBand: AgeBand;
  locale: string;
  targetedSkills: SkillTag[];
}

export interface SpeechBuddySessionEndedPayload {
  sessionId: string;
  durationSeconds: number;
  turnCount: number;
  skillEvidenceTotals: Partial<Record<SkillTag, number>>;
  questAssigned?: string;
  endedReason: "completed" | "child_paused" | "child_called_grownup" | "safety_hard_flag";
}

export interface SpeechBuddySafetyFlagPayload {
  sessionId: string;
  correlationId: string;
  category: SafetyFlagCategory;
  severity: SafetyFlagSeverity;
  ageBand: AgeBand;
}

export interface SpeechBuddySkillEvidencePayload {
  sessionId: string;
  /** Hashed learner id. */
  learnerId: string;
  ageBand: AgeBand;
  skill: SkillTag;
  /** Rubric-weighted evidence value. */
  weight: number;
}

export interface SpeechBuddyQuestAssignedPayload {
  sessionId: string;
  /** Short imperative quest string, already localised. */
  quest: string;
  skill: SkillTag;
}
