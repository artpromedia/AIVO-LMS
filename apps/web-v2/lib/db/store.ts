/**
 * In-memory Map store — now a TEST FIXTURE, not a production datastore
 * (ADR 0007, Sprints 0–9). Every migrated domain (22 of them) reads/writes
 * Postgres via `getPersistence()` and is parity-proven; in production the
 * persistence adapter REFUSES `memory` (lib/env.ts schema +
 * `assertNoMemoryAdapterInProduction` in persistence/index.ts), so the
 * memory adapters here are reached only under `NODE_ENV=test` / vitest.
 *
 * Remaining direct readers: a set of not-yet-migrated repos functions whose
 * canonical data is owned by a service per ADR 0015 (tutor-svc curriculum
 * uploads, billing-svc subscriptions/seats, family-svc clinical, identity-svc
 * tenants) plus a few cross-domain aggregate readers. These still call
 * `getStore()` for their dev/mock path and are tracked for the final REST
 * cutover; until then `getStore()` is intentionally NOT hard-gated so those
 * paths keep working in dev. `resetStore()` is for Vitest fixtures only.
 *
 * Survives within a single Node process (dev/test). Restart to reset.
 */
import type {
  AccommodationSummary,
  AuditLog,
  BaselineAssessment,
  BaselineAttempt,
  BaselineItemResponseLog,
  BaselineQuestion,
  BillingAccount,
  GeneratedLessonPlan,
  IEPDocument,
  LearnerBadge,
  LearnerBrainProfile,
  BrainProfileApproval,
  LearnerEngagement,
  LearnerProfile,
  LearnerSensoryProfile,
  LessonInteraction,
  LearningPath,
  LessonRun,
  MasteryMap,
  MasterySnapshot,
  ReviewSchedule,
  CollaboratorInsight,
  CollaboratorMember,
  ParentAssessment,
  TeacherAssessmentDraft,
  TherapistAssessmentDraft,
  ParentLearnerRelationship,
  ParentLessonSummary,
  ParentProgressSummary,
  QuestChapter,
  QuestProgress,
  QuestWorld,
  Skill,
  SkillMastery,
  Subject,
  SupportTicket,
  TeacherAssignment,
  Tenant,
  TenantMembership,
  User,
  AiGenerationJob,
  HomeworkHelpSession,
  CalmSessionRecord,
  CurriculumUpload,
  ConsentRecord,
  ConsentVersion,
  TermsAcceptance,
  AgeGateRecord,
  DataInventoryItem,
  DataRetentionPolicy,
  DisclosureLog,
  DataExportRequest,
  DataDeletionRequest,
  IEPDocumentAccessLog,
  PolicyVersion,
  DPARecord,
  SubprocessorRecord,
  StandardsFramework,
  StandardDocument,
  Standard,
  Domain,
  SkillPrerequisite,
  SkillVersion,
  CurriculumMap,
  LessonObjectiveTemplate,
  AssessmentBlueprint,
  CurriculumImportJob,
  ModerationEvent,
  HumanReviewCase,
  SafetyPolicyVersion,
  BlockedGeneration,
  TutorResponseAudit,
  HomeworkInputAudit,
  AudioAsset,
  TTSGenerationJob,
  PronunciationOverride,
  LearnerVoicePreference,
  ReadAloudUsageEvent,
  AudioCacheEntry,
  School,
  Classroom,
  Course,
  Enrollment,
  RosterImportJob,
  RosterImportError,
  SISConnection,
  ExternalRosterMapping,
  DeviceSession,
  LessonSyncState,
  Notification,
  NotificationPreference,
  NotificationDelivery,
  DigestSchedule,
  Plan,
  Price,
  Subscription,
  Invoice,
  SeatLicense,
  SeatAssignment,
  AIBudget,
  AICostEvent,
  MigrationJob,
  MigrationRecord,
  SecurityControl,
  SecurityControlEvidence,
  RiskRegisterEntry,
  Incident,
  IncidentTimelineEvent,
  Vendor,
  StatePrivacyRequirement,
  StatePrivacyControlMapping,
  VulnerabilityReport,
  TenantSettings,
  Coupon,
  DailyBillingBatch,
  PlatformApiKey,
  PlatformEmailTemplate,
  PlatformWebhookEndpoint,
  IepGoalRecord,
  TherapistSessionNote,
  CaregiverObservation,
  IepAiDraftRecord,
  TermSyllabus,
} from "@/lib/db/types";

export type Store = {
  users: Map<string, User>;
  tenants: Map<string, Tenant>;
  memberships: TenantMembership[];

  learnerProfiles: Map<string, LearnerProfile>;
  parentLearnerRelationships: ParentLearnerRelationship[];
  parentAssessments: Map<string, ParentAssessment>;
  /** Sprint C-07: teacher assessment wizard autosave drafts (system of
   *  record is assessment-svc). Keyed by draft id. */
  teacherAssessmentDrafts: Map<string, TeacherAssessmentDraft>;
  /** Sprint C-10: therapist assessment autosave drafts (system of record is
   *  assessment-svc). Sibling of teacherAssessmentDrafts. Keyed by draft id. */
  therapistAssessmentDrafts: Map<string, TherapistAssessmentDraft>;
  iepDocuments: Map<string, IEPDocument>;
  accommodationSummaries: Map<string, AccommodationSummary>;
  brainProfiles: Map<string, LearnerBrainProfile>;
  /** Sprint C-06: append-only parent approval/amend/decline records. */
  brainProfileApprovals: BrainProfileApproval[];

  subjects: Map<string, Subject>;
  skills: Map<string, Skill>;
  masteryMaps: Map<string, MasteryMap>;
  skillMasteries: SkillMastery[];
  learningPaths: Map<string, LearningPath>;
  reviewSchedules: ReviewSchedule[];
  masterySnapshots: MasterySnapshot[];

  baselineAssessments: Map<string, BaselineAssessment>;
  baselineQuestions: Map<string, BaselineQuestion>;
  baselineAttempts: BaselineAttempt[];
  /** Per-item adaptive-baseline telemetry; append-only, written on finalize. */
  baselineItemResponseLogs: BaselineItemResponseLog[];

  lessonRuns: Map<string, LessonRun>;
  generatedLessonPlans: Map<string, GeneratedLessonPlan>;
  lessonInteractions: LessonInteraction[];
  parentProgressSummaries: Map<string, ParentProgressSummary>;
  parentLessonSummaries: Map<string, ParentLessonSummary>;

  questWorlds: Map<string, QuestWorld>;
  questChapters: Map<string, QuestChapter>;
  questProgress: Map<string, QuestProgress>;

  learnerEngagement: Map<string, LearnerEngagement>;
  learnerBadges: Map<string, LearnerBadge>;
  learnerSensoryProfiles: Map<string, LearnerSensoryProfile>;

  homeworkHelpSessions: Map<string, HomeworkHelpSession>;
  calmSessions: Map<string, CalmSessionRecord>;
  teacherAssignments: Map<string, TeacherAssignment>;
  curriculumUploads: Map<string, CurriculumUpload>;
  termSyllabi: Map<string, TermSyllabus>;

  auditLogs: AuditLog[];
  aiGenerationJobs: Map<string, AiGenerationJob>;
  billingAccounts: Map<string, BillingAccount>;
  supportTickets: Map<string, SupportTicket>;

  // Sprint 24: consent + terms + age-gate.
  consentVersions: Map<string, ConsentVersion>;
  consentRecords: ConsentRecord[];
  termsAcceptances: TermsAcceptance[];
  ageGateRecords: Map<string, AgeGateRecord>;

  // Sprint 25: privacy / compliance / DSAR.
  dataInventory: Map<string, DataInventoryItem>;
  dataRetentionPolicies: Map<string, DataRetentionPolicy>;
  disclosureLogs: DisclosureLog[];
  dataExportRequests: Map<string, DataExportRequest>;
  dataDeletionRequests: Map<string, DataDeletionRequest>;
  iepDocumentAccessLogs: IEPDocumentAccessLog[];
  policyVersions: Map<string, PolicyVersion>;
  dpaRecords: Map<string, DPARecord>;
  subprocessors: Map<string, SubprocessorRecord>;

  // Sprint 26: curriculum / standards / skill graph.
  standardsFrameworks: Map<string, StandardsFramework>;
  standardDocuments: Map<string, StandardDocument>;
  standards: Map<string, Standard>;
  domains: Map<string, Domain>;
  skillPrerequisites: Map<string, SkillPrerequisite>;
  skillVersions: Map<string, SkillVersion>;
  curriculumMaps: Map<string, CurriculumMap>;
  lessonObjectiveTemplates: Map<string, LessonObjectiveTemplate>;
  assessmentBlueprints: Map<string, AssessmentBlueprint>;
  curriculumImportJobs: Map<string, CurriculumImportJob>;

  // Sprint 27: AI Safety + Moderation
  moderationEvents: Map<string, ModerationEvent>;
  humanReviewCases: Map<string, HumanReviewCase>;
  safetyPolicyVersions: Map<string, SafetyPolicyVersion>;
  blockedGenerations: Map<string, BlockedGeneration>;
  tutorResponseAudits: Map<string, TutorResponseAudit>;
  homeworkInputAudits: Map<string, HomeworkInputAudit>;

  // Sprint 28: TTS + Read-Aloud
  audioAssets: Map<string, AudioAsset>;
  ttsGenerationJobs: Map<string, TTSGenerationJob>;
  pronunciationOverrides: Map<string, PronunciationOverride>;
  learnerVoicePreferences: Map<string, LearnerVoicePreference>;
  readAloudUsageEvents: Map<string, ReadAloudUsageEvent>;
  /** Keyed by `${tenantId}:${languageCode}:${contentHash}`. */
  audioCacheEntries: Map<string, AudioCacheEntry>;

  // Sprint 29: Rostering / SIS / Sync / Notifications
  schools: Map<string, School>;
  classrooms: Map<string, Classroom>;
  courses: Map<string, Course>;
  enrollments: Map<string, Enrollment>;
  rosterImportJobs: Map<string, RosterImportJob>;
  rosterImportErrors: Map<string, RosterImportError>;
  sisConnections: Map<string, SISConnection>;
  externalRosterMappings: Map<string, ExternalRosterMapping>;
  deviceSessions: Map<string, DeviceSession>;
  /** Keyed by lessonRunId. */
  lessonSyncStates: Map<string, LessonSyncState>;
  notifications: Map<string, Notification>;
  /** Keyed by userId. */
  notificationPreferences: Map<string, NotificationPreference>;
  notificationDeliveries: Map<string, NotificationDelivery>;
  digestSchedules: Map<string, DigestSchedule>;

  // Sprint 9 / 10 — therapist + caregiver domain rows.
  iepGoalRecords: Map<string, IepGoalRecord>;
  therapistSessionNotes: Map<string, TherapistSessionNote>;
  caregiverObservations: Map<string, CaregiverObservation>;

  // Sprint 11 — AI-drafted IEPs from services/ai-svc /api/ai/iep/draft.
  // One row per learner; regenerations upsert. Tracks the review
  // lifecycle so the teacher dashboard can render an inbox.
  iepAiDrafts: Map<string, IepAiDraftRecord>;

  // Sprint 30: Billing / AI Cost / Migration
  plans: Map<string, Plan>;
  prices: Map<string, Price>;
  subscriptions: Map<string, Subscription>;
  invoices: Map<string, Invoice>;
  seatLicenses: Map<string, SeatLicense>;
  seatAssignments: Map<string, SeatAssignment>;
  /** Keyed by tenantId. */
  aiBudgets: Map<string, AIBudget>;
  aiCostEvents: Map<string, AICostEvent>;
  migrationJobs: Map<string, MigrationJob>;
  migrationRecords: Map<string, MigrationRecord>;

  // Sprint 31: Security / SOC 2 / Privacy matrix / Incidents
  securityControls: Map<string, SecurityControl>;
  securityControlEvidence: Map<string, SecurityControlEvidence>;
  riskRegister: Map<string, RiskRegisterEntry>;
  incidents: Map<string, Incident>;
  incidentTimelineEvents: Map<string, IncidentTimelineEvent>;
  vendors: Map<string, Vendor>;
  statePrivacyRequirements: Map<string, StatePrivacyRequirement>;
  statePrivacyMappings: Map<string, StatePrivacyControlMapping>;
  vulnerabilityReports: Map<string, VulnerabilityReport>;

  /** Keyed by tenantId. District + school admin settings (branding, prefs, SSO). */
  tenantSettings: Map<string, TenantSettings>;

  // Sprint 4: collaboration domain (web-v2's own store, keyed by record id).
  collaboratorInsights: Map<string, CollaboratorInsight>;
  collaboratorMembers: Map<string, CollaboratorMember>;

  // Platform-admin: billing operations
  coupons: Map<string, Coupon>;
  dailyBillingBatches: Map<string, DailyBillingBatch>;

  // Platform-admin: settings (API keys, email templates, webhooks)
  platformApiKeys: Map<string, PlatformApiKey>;
  platformEmailTemplates: Map<string, PlatformEmailTemplate>;
  platformWebhookEndpoints: Map<string, PlatformWebhookEndpoint>;

  seeded: boolean;
};

declare global {
  // `declare var` is required for global augmentation in TS; this is
  // expected pattern for module-scoped singletons.
  var __aivoStore: Store | undefined;
}

function createStore(): Store {
  return {
    users: new Map(),
    tenants: new Map(),
    memberships: [],
    learnerProfiles: new Map(),
    parentLearnerRelationships: [],
    parentAssessments: new Map(),
    teacherAssessmentDrafts: new Map(),
    therapistAssessmentDrafts: new Map(),
    iepDocuments: new Map(),
    accommodationSummaries: new Map(),
    brainProfiles: new Map(),
    brainProfileApprovals: [],
    subjects: new Map(),
    skills: new Map(),
    masteryMaps: new Map(),
    skillMasteries: [],
    learningPaths: new Map(),
    reviewSchedules: [],
    masterySnapshots: [],
    baselineAssessments: new Map(),
    baselineQuestions: new Map(),
    baselineAttempts: [],
    baselineItemResponseLogs: [],
    lessonRuns: new Map(),
    generatedLessonPlans: new Map(),
    lessonInteractions: [],
    parentProgressSummaries: new Map(),
    parentLessonSummaries: new Map(),
    questWorlds: new Map(),
    questChapters: new Map(),
    questProgress: new Map(),
    learnerEngagement: new Map(),
    learnerBadges: new Map(),
    learnerSensoryProfiles: new Map(),
    homeworkHelpSessions: new Map(),
    calmSessions: new Map(),
    teacherAssignments: new Map(),
    collaboratorInsights: new Map(),
    collaboratorMembers: new Map(),
    curriculumUploads: new Map(),
    termSyllabi: new Map(),
    auditLogs: [],
    aiGenerationJobs: new Map(),
    billingAccounts: new Map(),
    supportTickets: new Map(),
    consentVersions: new Map(),
    consentRecords: [],
    termsAcceptances: [],
    ageGateRecords: new Map(),
    dataInventory: new Map(),
    dataRetentionPolicies: new Map(),
    disclosureLogs: [],
    dataExportRequests: new Map(),
    dataDeletionRequests: new Map(),
    iepDocumentAccessLogs: [],
    policyVersions: new Map(),
    dpaRecords: new Map(),
    subprocessors: new Map(),
    standardsFrameworks: new Map(),
    standardDocuments: new Map(),
    standards: new Map(),
    domains: new Map(),
    skillPrerequisites: new Map(),
    skillVersions: new Map(),
    curriculumMaps: new Map(),
    lessonObjectiveTemplates: new Map(),
    assessmentBlueprints: new Map(),
    curriculumImportJobs: new Map(),
    moderationEvents: new Map(),
    humanReviewCases: new Map(),
    safetyPolicyVersions: new Map(),
    blockedGenerations: new Map(),
    tutorResponseAudits: new Map(),
    homeworkInputAudits: new Map(),
    audioAssets: new Map(),
    ttsGenerationJobs: new Map(),
    pronunciationOverrides: new Map(),
    learnerVoicePreferences: new Map(),
    readAloudUsageEvents: new Map(),
    audioCacheEntries: new Map(),
    schools: new Map(),
    classrooms: new Map(),
    courses: new Map(),
    enrollments: new Map(),
    rosterImportJobs: new Map(),
    rosterImportErrors: new Map(),
    sisConnections: new Map(),
    externalRosterMappings: new Map(),
    deviceSessions: new Map(),
    lessonSyncStates: new Map(),
    notifications: new Map(),
    notificationPreferences: new Map(),
    notificationDeliveries: new Map(),
    digestSchedules: new Map(),

    iepGoalRecords: new Map(),
    therapistSessionNotes: new Map(),
    caregiverObservations: new Map(),
    iepAiDrafts: new Map(),

    plans: new Map(),
    prices: new Map(),
    subscriptions: new Map(),
    invoices: new Map(),
    seatLicenses: new Map(),
    seatAssignments: new Map(),
    aiBudgets: new Map(),
    aiCostEvents: new Map(),
    migrationJobs: new Map(),
    migrationRecords: new Map(),

    securityControls: new Map(),
    securityControlEvidence: new Map(),
    riskRegister: new Map(),
    incidents: new Map(),
    incidentTimelineEvents: new Map(),
    vendors: new Map(),
    statePrivacyRequirements: new Map(),
    statePrivacyMappings: new Map(),
    vulnerabilityReports: new Map(),

    tenantSettings: new Map(),
    coupons: new Map(),
    dailyBillingBatches: new Map(),
    platformApiKeys: new Map(),
    platformEmailTemplates: new Map(),
    platformWebhookEndpoints: new Map(),

    seeded: false,
  };
}

export function getStore(): Store {
  if (!globalThis.__aivoStore) {
    globalThis.__aivoStore = createStore();
  }
  return globalThis.__aivoStore;
}

/**
 * Reset the in-memory store. Used by unit tests so each `it()` block
 * starts from a clean slate; never call from production code paths.
 */
export function resetStore(): void {
  globalThis.__aivoStore = createStore();
}

export function newId(prefix: string): string {
  const r = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now().toString(36)}${r}`;
}

export function nowIso(): ISODate {
  return new Date().toISOString();
}

type ISODate = string;
