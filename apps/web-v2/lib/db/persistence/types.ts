/**
 * Persistence adapter — domain-store interfaces.
 *
 * Each per-domain store is a small surface that a `lib/db/repos.ts`
 * function can call instead of reaching into `getStore()` directly.
 * The same interface has two implementations:
 *
 *   - `MemoryAdapter` wraps the existing `Map` store (default).
 *   - `DrizzleAdapter` talks to Postgres via `packages/db`.
 *
 * See `docs/adr/0007-web-v2-persistence-migration.md` for the
 * decision record + migration order.
 */
import type {
  AIBudget,
  AICostEvent,
  AuditLog,
  BaselineAssessment,
  BaselineAttempt,
  BaselineBankItem,
  BaselineItemResponseLog,
  BaselineQuestion,
  BillingAccount,
  AiGenerationJob,
  AssessmentBlueprint,
  CurriculumImportJob,
  CurriculumMap,
  Domain,
  LessonObjectiveTemplate,
  SkillPrerequisite,
  SkillVersion,
  Standard,
  StandardDocument,
  StandardsFramework,
  CalmSessionRecord,
  DigestSchedule,
  HomeworkHelpSession,
  LearnerBadge,
  LearnerEngagement,
  LearnerSensoryProfile,
  NotificationPreference,
  PlatformApiKey,
  PlatformEmailTemplate,
  PlatformWebhookEndpoint,
  SupportTicket,
  TenantSettings,
  AudioAsset,
  AudioCacheEntry,
  BlockedGeneration,
  HomeworkInputAudit,
  HumanReviewCase,
  LearnerVoicePreference,
  ModerationEvent,
  PronunciationOverride,
  ReadAloudUsageEvent,
  SafetyPolicyVersion,
  TTSGenerationJob,
  TutorResponseAudit,
  Classroom,
  Course,
  Coupon,
  DailyBillingBatch,
  ExternalRosterMapping,
  LessonSyncState,
  RosterImportError,
  RosterImportJob,
  SISConnection,
  CollaboratorInsight,
  CollaboratorMember,
  ConsentRecord,
  ConsentType,
  ConsentVersion,
  DataDeletionRequest,
  DataExportRequest,
  DataInventoryItem,
  DataRetentionPolicy,
  DisclosureLog,
  IEPDocumentAccessLog,
  TermsAcceptance,
  Enrollment,
  GeneratedLessonPlan,
  IEPDocument,
  AccessibilityPreferences,
  LearnerBrainProfile,
  LearnerProfile,
  LessonInteraction,
  LessonRun,
  LearningPath,
  MasteryMap,
  Notification,
  NotificationDelivery,
  ParentAssessment,
  ParentLessonSummary,
  PolicyVersion,
  QuestChapter,
  QuestProgress,
  QuestWorld,
  ReadinessState,
  School,
  Skill,
  SkillMastery,
  Subject,
  SubprocessorRecord,
  TeacherAssignment,
  TenantMembership,
  User,
} from "@/lib/db/types";
import type {
  AgeGateRecord,
  IepAiDraftRecord,
  Incident,
  IncidentTimelineEvent,
  RiskRegisterEntry,
  SecurityControl,
  SecurityControlEvidence,
  StatePrivacyControlMapping,
  StatePrivacyRequirement,
  Vendor,
  VulnerabilityReport,
} from "@/lib/db/types";
import type { Role } from "@/lib/auth/types";
import type { CreateLearnerInput, PatchLearnerInput } from "@/lib/validators/learner";

export type PersistenceMode = "memory" | "postgres";

/**
 * Per-domain stores. The full `Persistence` interface aggregates one
 * field per migrated domain. Domains we haven't migrated yet keep
 * using `getStore()` directly — the adapter is opt-in per domain.
 */
export interface NotificationStore {
  /** List notifications for a (userId, tenantId), most recent first. */
  list(opts: { tenantId: string; userId: string; unreadOnly?: boolean }): Promise<Notification[]>;
  /** Mark up to N notifications read. Returns the count that flipped. */
  markRead(opts: { tenantId: string; userId: string; ids: string[] }): Promise<number>;
  /** Persist a new notification + the per-channel delivery rows. */
  create(input: {
    notification: Notification;
    deliveries: NotificationDelivery[];
  }): Promise<{ notification: Notification; deliveries: NotificationDelivery[] }>;
  /** Inspect the delivery rows for a notification (debug/observability). */
  listDeliveries(notificationId: string): Promise<NotificationDelivery[]>;

  // ── Sprint 8 remainder: notification preferences + digest schedules ──
  /** The user's notification preference row, or null (repo materializes a default). */
  getPreference(userId: string): Promise<NotificationPreference | null>;
  upsertPreference(pref: NotificationPreference): Promise<NotificationPreference>;
  /** All digest schedules (repo filters by tenant/user). */
  listDigestSchedules(): Promise<DigestSchedule[]>;
}

/**
 * Engagement domain (Sprint 8 remainder) — homework-help + calm sessions,
 * per-learner engagement snapshot + badges + sensory profile. Live
 * gradebook/leaderboard is read from engagement-svc over REST (ADR 0015);
 * these are the web app's own durable rows. No RLS (per-learner scoping).
 */
export interface EngagementStore {
  upsertHomeworkSession(session: HomeworkHelpSession): Promise<HomeworkHelpSession>;
  getHomeworkSession(id: string): Promise<HomeworkHelpSession | null>;
  listHomeworkSessions(): Promise<HomeworkHelpSession[]>;
  appendCalmSession(session: CalmSessionRecord): Promise<CalmSessionRecord>;
  listCalmSessions(): Promise<CalmSessionRecord[]>;
  getEngagement(learnerId: string): Promise<LearnerEngagement | null>;
  listBadges(): Promise<LearnerBadge[]>;
  getSensoryProfile(learnerId: string): Promise<LearnerSensoryProfile | null>;
  upsertSensoryProfile(profile: LearnerSensoryProfile): Promise<LearnerSensoryProfile>;
}

/**
 * Append-only audit log. Reads are tenant-scoped; writes never delete
 * or rewrite (the `AuditLog` table is the canonical source for
 * compliance review).
 */
export interface AuditStore {
  append(entry: AuditLog): Promise<AuditLog>;
  recentForTenant(tenantId: string, limit: number): Promise<AuditLog[]>;
  recentForTenants(tenantIds: string[], limit: number): Promise<AuditLog[]>;
}

/**
 * Identity domain — users + tenant memberships. Sessions live in the
 * mock-session cookie + (eventually) `services/identity-svc` and are
 * deliberately out of scope for this store.
 */
export type StaffUserRole = "TEACHER" | "SCHOOL_ADMIN" | "THERAPIST" | "CAREGIVER";

export interface StaffUserRecord {
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: StaffUserRole;
  status: "INVITED";
  createdAt: string;
}

export interface UserSummary {
  user: User;
  tenantId: string;
  role: Role;
  joinedAt: string;
}

export interface IdentityStore {
  getUserById(id: string): Promise<User | null>;
  listUsersForTenants(tenantIds: string[]): Promise<UserSummary[]>;
  listMembershipsForUser(userId: string): Promise<TenantMembership[]>;
  updateUserDisplayName(userId: string, displayName: string): Promise<User | null>;
  /**
   * Add a "INVITED" staff user with a default tenant membership.
   * Idempotency / re-invite semantics are caller-controlled; the
   * store does no dedupe on email.
   */
  addStaffUser(input: {
    tenantId: string;
    email: string;
    displayName: string;
    role: StaffUserRole;
  }): Promise<StaffUserRecord>;
  /** Hard delete; returns false if the user isn't in this tenant. */
  removeStaffUser(userId: string, tenantId: string): Promise<boolean>;
}

/**
 * Learner domain — learner profiles + parent/learner relationships +
 * teacher classroom enrolments (for read-scope checks). The store owns
 * the data; cross-domain logic (e.g. readiness recomputation, IEP
 * cascade on delete) stays in repos.ts.
 */
export interface LearnerStore {
  /** Tenant-scoped lookup. Returns null if the learner doesn't belong. */
  getById(id: string, tenantId: string): Promise<LearnerProfile | null>;
  /** Learners linked to a parent via ParentLearnerRelationship. */
  listForParent(parentUserId: string, tenantId: string): Promise<LearnerProfile[]>;
  /** Learners enrolled in classrooms led / co-taught by `teacherUserId`. */
  listForTeacher(teacherUserId: string, tenantId: string): Promise<LearnerProfile[]>;
  /** All learners across one or more tenants. */
  listForTenants(tenantIds: string[]): Promise<LearnerProfile[]>;
  /** True iff a ParentLearnerRelationship exists for the triple. */
  parentCanAccess(parentUserId: string, learnerId: string, tenantId: string): Promise<boolean>;
  /** True iff the teacher shares a classroom with the learner. */
  teacherCanAccess(teacherUserId: string, learnerId: string, tenantId: string): Promise<boolean>;
  /** The `isPrimary` parent (or first by insertion order) for the learner. */
  findPrimaryParent(learnerId: string, tenantId: string): Promise<string | null>;
  /**
   * Insert a learner + the parent's primary ParentLearnerRelationship.
   * Caller has already done validation; the store does not enforce
   * uniqueness on first name / birth year / etc.
   */
  create(input: {
    tenantId: string;
    parentUserId: string;
    data: CreateLearnerInput;
  }): Promise<LearnerProfile>;
  /** Patch by id. Returns null if the learner doesn't belong to tenant. */
  update(id: string, tenantId: string, patch: PatchLearnerInput): Promise<LearnerProfile | null>;
  /** Hard delete + cascade (relationships, parent assessments). */
  delete(id: string, tenantId: string): Promise<boolean>;
  /** Set the cached readinessState. Returns the updated learner or null. */
  setReadinessState(
    id: string,
    tenantId: string,
    state: ReadinessState,
  ): Promise<LearnerProfile | null>;
  /**
   * Sprint 3: persist the parent's decision on the optional collaborator
   * invite step. Durable (stored on the learner document) so the onboarding
   * progression survives a restart. Returns the updated learner or null.
   */
  setTeamInviteDecision(
    id: string,
    tenantId: string,
    decision: "pending" | "done" | "skipped",
  ): Promise<LearnerProfile | null>;
  /**
   * Read the learner's stored accessibility preferences, or null if none have
   * been set (caller applies ACCESSIBILITY_DEFAULTS). Persisted on the learner
   * document so it is durable across restarts and shared across devices.
   */
  getAccessibility(id: string, tenantId: string): Promise<AccessibilityPreferences | null>;
  /**
   * Upsert the learner's accessibility preferences (pass null to clear back to
   * defaults). Returns the stored value (or null on clear / unknown learner).
   */
  setAccessibility(
    id: string,
    tenantId: string,
    prefs: AccessibilityPreferences | null,
  ): Promise<AccessibilityPreferences | null>;
}

/**
 * Assessment domain — parent intake assessment + per-learner baseline
 * runs (assessment + questions + attempts). Orchestration that builds
 * masteries, learning paths, and the brain clone stays in repos.ts;
 * the store owns only the raw row-level reads + writes.
 */
export interface AssessmentStore {
  // Parent assessment
  findParentAssessment(learnerId: string, tenantId: string): Promise<ParentAssessment | null>;
  upsertParentAssessment(assessment: ParentAssessment): Promise<ParentAssessment>;

  // Baseline assessments
  getBaselineById(baselineId: string, tenantId: string): Promise<BaselineAssessment | null>;
  /** Most-recent baseline (by createdAt) for the learner, regardless of status. */
  getActiveBaselineForLearner(
    learnerId: string,
    tenantId: string,
  ): Promise<BaselineAssessment | null>;
  upsertBaseline(baseline: BaselineAssessment): Promise<BaselineAssessment>;

  // Baseline questions + attempts
  listBaselineQuestions(baselineId: string): Promise<BaselineQuestion[]>;
  appendBaselineQuestions(questions: BaselineQuestion[]): Promise<void>;
  listBaselineAttempts(baselineId: string, tenantId: string): Promise<BaselineAttempt[]>;
  /**
   * Replace attempts for a specific (questionId, learnerId) pair, then
   * append the new attempt. The "latest-attempt-wins" semantics are
   * baked into the store so callers don't need a transaction.
   */
  recordBaselineAttempt(
    attempt: BaselineAttempt,
    replaceWhere: { questionId: string; learnerId: string },
  ): Promise<BaselineAttempt>;

  // Adaptive-baseline telemetry (per-item psychometric logs). Append-only;
  // read back per tenant (optionally narrowed to a learner) for the
  // recalibration job + admin psychometrics.
  appendBaselineTelemetry(logs: BaselineItemResponseLog[]): Promise<void>;
  listBaselineTelemetry(filter: {
    tenantId: string;
    learnerId?: string;
  }): Promise<BaselineItemResponseLog[]>;
}

/**
 * Lesson-run domain — LessonRun rows, the GeneratedLessonPlan content
 * they reference, the per-step interaction log, and the parent-facing
 * summary row created on completion. Higher-level orchestration
 * (createLessonRun, completeLessonRun, retryLessonRun) stays in
 * repos.ts; the store owns the raw row-level reads + writes.
 */
export interface LessonRunStore {
  getRunById(lessonRunId: string, tenantId: string): Promise<LessonRun | null>;
  upsertRun(run: LessonRun): Promise<LessonRun>;
  listForLearner(
    learnerId: string,
    tenantId: string,
    opts?: { limit?: number; status?: LessonRun["status"] },
  ): Promise<LessonRun[]>;
  /** Count completed/in-progress runs — drives readiness promotion. */
  countForLearner(learnerId: string, tenantId: string): Promise<number>;

  getPlanById(planId: string, tenantId: string): Promise<GeneratedLessonPlan | null>;
  upsertPlan(plan: GeneratedLessonPlan): Promise<GeneratedLessonPlan>;

  appendInteraction(interaction: LessonInteraction): Promise<void>;
  listInteractions(lessonRunId: string, tenantId: string): Promise<LessonInteraction[]>;

  upsertParentSummary(summary: ParentLessonSummary): Promise<ParentLessonSummary>;
  getParentSummaryForRun(
    lessonRunId: string,
    tenantId: string,
  ): Promise<ParentLessonSummary | null>;
}

/**
 * Brain-profile domain — per-learner brain profile lifecycle
 * (pre_clone → cloned → approved). Cross-domain logic (e.g. brain-clone
 * preparation from a BaselineSummary) stays in repos.ts and composes
 * these primitives.
 */
export interface BrainProfileStore {
  getForLearner(learnerId: string, tenantId: string): Promise<LearnerBrainProfile | null>;
  upsert(profile: LearnerBrainProfile): Promise<LearnerBrainProfile>;
}

/**
 * Curriculum domain — subjects + skills (seed-time reference data),
 * plus per-learner masteryMaps + skillMasteries + learningPaths.
 * Subjects/skills are read-heavy and effectively immutable post-seed;
 * paths/masteries are per-learner mutable.
 */
export interface CurriculumStore {
  listSubjects(): Promise<Subject[]>;
  getSubjectById(subjectId: string): Promise<Subject | null>;
  listSkills(subjectId?: string): Promise<Skill[]>;
  getSkillById(skillId: string): Promise<Skill | null>;
  /** Sprint 8 remainder: insert/replace a skill (skill-graph authoring). */
  upsertSkill(skill: Skill): Promise<Skill>;

  getMasteryMapForLearner(
    learnerId: string,
    tenantId: string,
  ): Promise<{ map: MasteryMap | null; skillMasteries: SkillMastery[] }>;

  getLearningPath(learnerId: string, tenantId: string): Promise<LearningPath | null>;
  /** Replace the learner's path atomically — delete prior + insert next. */
  replaceLearningPath(
    learnerId: string,
    tenantId: string,
    next: LearningPath,
  ): Promise<LearningPath>;
}

/**
 * Compliance domain — parental consent records, IEP documents, age
 * gate, and the platform-wide policy + subprocessor catalog.
 * Consent reads are the hot path (every BFF guard hits them).
 */
export interface ComplianceStore {
  // Consent
  getActiveConsentForUser(
    parentUserId: string,
    consentType: ConsentType,
    tenantId: string,
    learnerId: string | null,
  ): Promise<ConsentRecord | null>;
  listConsentsForUser(parentUserId: string, tenantId: string): Promise<ConsentRecord[]>;
  /** Records belonging to a specific parent + learner triple. */
  listConsentsForLearner(
    parentUserId: string,
    learnerId: string,
    tenantId: string,
  ): Promise<ConsentRecord[]>;
  upsertConsent(record: ConsentRecord): Promise<ConsentRecord>;

  // IEP
  getIEPForLearner(learnerId: string, tenantId: string): Promise<IEPDocument | null>;
  upsertIEP(doc: IEPDocument): Promise<IEPDocument>;
  /** Hard delete the active IEP for a learner. Returns true on success. */
  deleteIEP(learnerId: string, tenantId: string): Promise<boolean>;

  // Age gate
  getAgeGateForLearner(learnerId: string, tenantId: string): Promise<AgeGateRecord | null>;
  upsertAgeGate(record: AgeGateRecord): Promise<AgeGateRecord>;

  // Policy + subprocessor catalogs (platform-wide reference data)
  listPolicyVersions(): Promise<PolicyVersion[]>;
  listSubprocessors(): Promise<SubprocessorRecord[]>;

  // ── Sprint 5: privacy / DSAR / terms / inventory / retention / disclosure ──
  // These web_* tables are PLATFORM/ADMIN-accessed (DPO consoles read DSAR +
  // disclosure across tenants; access/disclosure logs are append-only audit),
  // so they carry tenant_id but are NOT RLS-protected — the same exclusion
  // 0050 makes for web_users / web_audit_logs. App code filters by tenant.
  listConsentVersions(): Promise<ConsentVersion[]>;
  appendTermsAcceptance(acceptance: TermsAcceptance): Promise<TermsAcceptance>;
  listDataInventory(): Promise<DataInventoryItem[]>;
  listRetentionPolicies(): Promise<DataRetentionPolicy[]>;
  getRetentionPolicy(id: string): Promise<DataRetentionPolicy | null>;
  upsertRetentionPolicy(policy: DataRetentionPolicy): Promise<DataRetentionPolicy>;
  /** Append a FERPA disclosure log entry (append-only). */
  appendDisclosure(entry: DisclosureLog): Promise<DisclosureLog>;
  /** Disclosures for a tenant, newest-first. */
  listDisclosures(tenantId: string): Promise<DisclosureLog[]>;
  // DSAR export requests
  upsertExportRequest(request: DataExportRequest): Promise<DataExportRequest>;
  getExportRequestById(id: string): Promise<DataExportRequest | null>;
  listExportRequests(): Promise<DataExportRequest[]>;
  // DSAR deletion requests
  upsertDeletionRequest(request: DataDeletionRequest): Promise<DataDeletionRequest>;
  getDeletionRequestById(id: string): Promise<DataDeletionRequest | null>;
  listDeletionRequests(): Promise<DataDeletionRequest[]>;
  /** Append an IEP-document access log entry (append-only audit integrity). */
  appendIepAccessLog(entry: IEPDocumentAccessLog): Promise<IEPDocumentAccessLog>;
  listIepAccessForLearner(learnerId: string, tenantId: string): Promise<IEPDocumentAccessLog[]>;
}

/**
 * Quest / gamification domain — QuestWorlds and QuestChapters are
 * seed-time reference data; QuestProgress is per-learner mutable.
 * Higher-level orchestration (startQuestChapter, the LessonRun
 * coupling on completion) stays in repos.ts.
 */
export interface QuestStore {
  listWorlds(): Promise<QuestWorld[]>;
  getWorldById(worldId: string): Promise<QuestWorld | null>;
  listChaptersForWorld(worldId: string): Promise<QuestChapter[]>;
  getChapterById(chapterId: string): Promise<QuestChapter | null>;
  /** All progress rows for the learner, optionally scoped to a world. */
  listProgressForLearner(
    learnerId: string,
    tenantId: string,
    worldId?: string,
  ): Promise<QuestProgress[]>;
  getProgressForChapter(
    learnerId: string,
    tenantId: string,
    chapterId: string,
  ): Promise<QuestProgress | null>;
  upsertProgress(progress: QuestProgress): Promise<QuestProgress>;
}

/**
 * Admin domain — schools, classrooms, enrollments, and teacher
 * assignments. Cross-tenant defense-in-depth (e.g. dropping
 * learnerIds that don't belong to the tenant) stays in repos.ts;
 * the store does raw row-level reads + writes.
 */
export interface AdminStore {
  // Schools (typically one per tenant, but lookups accept either scope).
  listSchools(tenantId?: string): Promise<School[]>;
  getSchoolById(id: string): Promise<School | null>;

  // Classrooms
  listClassrooms(opts: {
    tenantId: string;
    schoolId?: string;
    teacherUserId?: string;
  }): Promise<Classroom[]>;
  getClassroomById(id: string, tenantId: string): Promise<Classroom | null>;
  upsertClassroom(classroom: Classroom): Promise<Classroom>;

  // Enrollments
  listEnrollmentsForClassroom(classroomId: string): Promise<Enrollment[]>;
  upsertEnrollment(enrollment: Enrollment): Promise<Enrollment>;
  /** Atomic ensure-by-natural-key for (classroomId, subjectId, role). */
  findEnrollmentByNaturalKey(input: {
    classroomId: string;
    subjectId: string;
    role: Enrollment["role"];
  }): Promise<Enrollment | null>;

  // Teacher assignments
  listTeacherAssignments(
    teacherId: string,
    tenantId: string,
    opts?: { status?: "active" | "archived" },
  ): Promise<TeacherAssignment[]>;
  getTeacherAssignmentById(
    assignmentId: string,
    teacherId: string,
    tenantId: string,
  ): Promise<TeacherAssignment | null>;
  upsertTeacherAssignment(assignment: TeacherAssignment): Promise<TeacherAssignment>;
  deleteTeacherAssignment(
    assignmentId: string,
    teacherId: string,
    tenantId: string,
  ): Promise<boolean>;
}

/**
 * Collaboration (Sprint 4): collaborator perspectives ("insights") + accepted
 * care-team members for a learner. Insights are read by the brain builder so
 * the pre-build invite step shapes the clone. Tenant-scoped on every call.
 */
export interface CollaborationStore {
  /** Persist a collaborator insight. */
  addInsight(insight: CollaboratorInsight): Promise<CollaboratorInsight>;
  /** Every insight for a learner, newest first. */
  listInsightsForLearner(learnerId: string, tenantId: string): Promise<CollaboratorInsight[]>;
  /** Upsert (insert or status-update) a care-team member. */
  upsertMember(member: CollaboratorMember): Promise<CollaboratorMember>;
  /** Accepted members for a learner (pending/declined/revoked excluded). */
  listAcceptedMembers(learnerId: string, tenantId: string): Promise<CollaboratorMember[]>;
  /** Every member row for a learner, any status (the care-team view). */
  listMembersForLearner(learnerId: string, tenantId: string): Promise<CollaboratorMember[]>;
  /** Every member row in a tenant — caller filters by user/email/role. */
  listMembersForTenant(tenantId: string): Promise<CollaboratorMember[]>;
}

/**
 * Billing domain (Sprint 2) — the WEB-OWNED operational/financial rows that
 * previously lived in the in-memory Map (real money/quota data lost on
 * restart). Per ADR 0015 the canonical subscription/invoice/seat state stays
 * in `services/billing-svc` and is read over REST (see
 * `lib/billing/billing-svc-client.ts`); this store owns only web_* rows:
 * billing-account snapshots, AI spend budgets + the per-request cost ledger,
 * the admin coupon catalog, and the nightly batch run log.
 */
export interface BillingStore {
  // Billing-account snapshots (tenant-scoped).
  getAccountForTenant(tenantId: string): Promise<BillingAccount | null>;
  listAccountsForTenants(tenantIds: string[]): Promise<BillingAccount[]>;
  upsertAccount(account: BillingAccount): Promise<BillingAccount>;

  // AI budgets (one row per tenant). `get` returns null when unset — the repo
  // layer materializes the default (so the store stays a pure row store).
  getAIBudget(tenantId: string): Promise<AIBudget | null>;
  upsertAIBudget(budget: AIBudget): Promise<AIBudget>;

  // AI cost ledger (append-only). `list` is newest-first, tenant-filtered,
  // capped by `limit` (default 200). The repo sums month-to-date in app code
  // so the period maths is identical across backends.
  recordAICostEvent(event: AICostEvent): Promise<AICostEvent>;
  listAICostEvents(opts: { tenantId?: string; limit?: number }): Promise<AICostEvent[]>;

  // Coupons (platform-wide), newest-first.
  listCoupons(): Promise<Coupon[]>;
  upsertCoupon(coupon: Coupon): Promise<Coupon>;

  // Daily billing batches (platform-wide), newest run-date first.
  listDailyBillingBatches(): Promise<DailyBillingBatch[]>;
  upsertDailyBillingBatch(batch: DailyBillingBatch): Promise<DailyBillingBatch>;
}

/**
 * Clinical domain (Sprint 3) — the WEB-OWNED IEP AI-draft review inbox.
 * Per ADR 0015 the canonical clinical records (IEP goals, therapist session
 * notes, caregiver observations) are owned by `family-svc` and written through
 * over REST (`lib/clinical/family-svc-client.ts`); this store owns only the
 * `web_iep_ai_drafts` row per learner (one upserted draft moving through a
 * review lifecycle). Tenant-scoped on every call.
 */
export interface ClinicalStore {
  /** The current AI draft for a learner, or null. (One row per learner.) */
  getDraftForLearner(learnerId: string, tenantId: string): Promise<IepAiDraftRecord | null>;
  /** A draft by id, tenant-scoped. */
  getDraftById(id: string, tenantId: string): Promise<IepAiDraftRecord | null>;
  /** Insert or replace the draft row (the repo owns lifecycle/transition logic). */
  upsertDraft(draft: IepAiDraftRecord): Promise<IepAiDraftRecord>;
  /** Drafts for a set of learner ids in a tenant, newest-updated first. */
  listDraftsForLearners(learnerIds: string[], tenantId: string): Promise<IepAiDraftRecord[]>;
}

/**
 * Security / SOC 2 / privacy-matrix domain (Sprint 4) — PLATFORM-GLOBAL
 * compliance artifacts (no tenant scoping). The store owns raw row-level
 * reads + writes; id generation, patch-merge, timestamp stamping, and
 * referential checks stay in repos.ts. Every list is sorted in app code to
 * match the in-memory store byte-for-byte.
 */
export interface SecurityStore {
  // SOC 2 controls + evidence
  listControls(): Promise<SecurityControl[]>;
  getControl(id: string): Promise<SecurityControl | null>;
  upsertControl(control: SecurityControl): Promise<SecurityControl>;
  listEvidenceForControl(controlId: string): Promise<SecurityControlEvidence[]>;
  upsertEvidence(evidence: SecurityControlEvidence): Promise<SecurityControlEvidence>;

  // Risk register
  listRisks(): Promise<RiskRegisterEntry[]>;
  getRisk(id: string): Promise<RiskRegisterEntry | null>;
  upsertRisk(risk: RiskRegisterEntry): Promise<RiskRegisterEntry>;

  // Incidents + timeline
  listIncidents(): Promise<Incident[]>;
  getIncident(id: string): Promise<Incident | null>;
  upsertIncident(incident: Incident): Promise<Incident>;
  listIncidentTimeline(incidentId: string): Promise<IncidentTimelineEvent[]>;
  appendIncidentTimeline(event: IncidentTimelineEvent): Promise<IncidentTimelineEvent>;

  // Vendors
  listVendors(): Promise<Vendor[]>;
  getVendor(id: string): Promise<Vendor | null>;
  upsertVendor(vendor: Vendor): Promise<Vendor>;

  // State-privacy-law matrix
  listStatePrivacyRequirements(): Promise<StatePrivacyRequirement[]>;
  getStatePrivacyRequirement(id: string): Promise<StatePrivacyRequirement | null>;
  listStatePrivacyMappingsFor(requirementId: string): Promise<StatePrivacyControlMapping[]>;
  getStatePrivacyMapping(id: string): Promise<StatePrivacyControlMapping | null>;
  upsertStatePrivacyMapping(
    mapping: StatePrivacyControlMapping,
  ): Promise<StatePrivacyControlMapping>;

  // Vulnerability reports
  listVulnerabilities(): Promise<VulnerabilityReport[]>;
  getVulnerability(id: string): Promise<VulnerabilityReport | null>;
  upsertVulnerability(report: VulnerabilityReport): Promise<VulnerabilityReport>;
}

/**
 * Rostering / SIS / lesson-sync domain (Sprint 6) — web-owned operational
 * aggregates. Tenant-scoped in app code (no RLS; see web-rostering.ts). The
 * canonical SIS sync (integrations-svc) + teacher-rostering grant (identity-
 * svc) are read over REST and are NOT part of this store.
 */
export interface RosteringStore {
  // Courses (per tenant; seeded reference web surfaces).
  listCoursesForTenant(tenantId: string): Promise<Course[]>;
  // Roster import jobs + per-row errors.
  upsertImportJob(job: RosterImportJob): Promise<RosterImportJob>;
  /** Get a job by id WITHOUT tenant scoping (platform-admin escape hatch). */
  getImportJobById(jobId: string): Promise<RosterImportJob | null>;
  listImportJobsForTenant(tenantId: string): Promise<RosterImportJob[]>;
  appendImportError(error: RosterImportError): Promise<RosterImportError>;
  listImportErrors(jobId: string): Promise<RosterImportError[]>;
  // SIS connections + external roster mappings (web aggregates).
  listSISConnectionsForTenant(tenantId: string): Promise<SISConnection[]>;
  listExternalMappingsForConnection(connectionId: string): Promise<ExternalRosterMapping[]>;
  // Multi-device lesson sync state (keyed by lessonRunId; optimistic version).
  getLessonSyncState(lessonRunId: string): Promise<LessonSyncState | null>;
  upsertLessonSyncState(state: LessonSyncState): Promise<LessonSyncState>;
}

/**
 * Audio domain (Sprint 7) — TTS jobs, audio assets, the read-aloud cache
 * (composite key `${tenantId}:${lang}:${hash}`), pronunciation overrides,
 * per-learner voice prefs, read-aloud usage. Filtering/sorting + the cache
 * key + TTL/hit logic stay in repos; the store is a row store. No RLS.
 */
export interface AudioStore {
  getAudioAsset(id: string): Promise<AudioAsset | null>;
  listAudioAssets(): Promise<AudioAsset[]>;
  upsertAudioAsset(asset: AudioAsset): Promise<AudioAsset>;
  upsertTtsJob(job: TTSGenerationJob): Promise<TTSGenerationJob>;
  listPronunciationOverrides(): Promise<PronunciationOverride[]>;
  getPronunciationOverride(id: string): Promise<PronunciationOverride | null>;
  upsertPronunciationOverride(o: PronunciationOverride): Promise<PronunciationOverride>;
  getVoicePreference(learnerId: string): Promise<LearnerVoicePreference | null>;
  upsertVoicePreference(pref: LearnerVoicePreference): Promise<LearnerVoicePreference>;
  appendReadAloudUsage(event: ReadAloudUsageEvent): Promise<ReadAloudUsageEvent>;
  listReadAloudUsage(): Promise<ReadAloudUsageEvent[]>;
  /** Audio cache by composite key. */
  getCacheEntry(cacheKey: string): Promise<AudioCacheEntry | null>;
  upsertCacheEntry(cacheKey: string, entry: AudioCacheEntry): Promise<AudioCacheEntry>;
}

/**
 * Safety domain (Sprint 7) — moderation events + human-review cases +
 * safety-policy catalog + blocked generations + tutor/homework safety audits.
 * Moderation events + audits are append-only. No RLS (admin cross-tenant
 * trust console). Canonical responsible-AI evals/models read via REST.
 */
export interface SafetyStore {
  listSafetyPolicyVersions(): Promise<SafetyPolicyVersion[]>;
  appendModerationEvent(event: ModerationEvent): Promise<ModerationEvent>;
  getModerationEvent(id: string): Promise<ModerationEvent | null>;
  listModerationEvents(): Promise<ModerationEvent[]>;
  upsertHumanReviewCase(c: HumanReviewCase): Promise<HumanReviewCase>;
  getHumanReviewCase(id: string): Promise<HumanReviewCase | null>;
  listHumanReviewCases(): Promise<HumanReviewCase[]>;
  appendBlockedGeneration(b: BlockedGeneration): Promise<BlockedGeneration>;
  listBlockedGenerations(): Promise<BlockedGeneration[]>;
  appendTutorResponseAudit(a: TutorResponseAudit): Promise<TutorResponseAudit>;
  listTutorResponseAudits(): Promise<TutorResponseAudit[]>;
  appendHomeworkInputAudit(a: HomeworkInputAudit): Promise<HomeworkInputAudit>;
  listHomeworkInputAudits(): Promise<HomeworkInputAudit[]>;
}

/**
 * Support domain (Sprint 8) — support tickets + the AI-generation job log.
 * Filtering/sorting + status-scope checks stay in repos. No RLS (admin
 * cross-tenant consoles).
 */
export interface SupportStore {
  listSupportTickets(): Promise<SupportTicket[]>;
  getSupportTicket(id: string): Promise<SupportTicket | null>;
  upsertSupportTicket(ticket: SupportTicket): Promise<SupportTicket>;
  listAiGenerationJobs(): Promise<AiGenerationJob[]>;
  appendAiGenerationJob(job: AiGenerationJob): Promise<AiGenerationJob>;
}

/**
 * Settings domain (Sprint 8) — per-tenant settings (keyed by tenantId) + the
 * platform settings catalogs (API keys, email templates, webhook endpoints).
 * No RLS (tenant-keyed + platform-global).
 */
export interface SettingsStore {
  getTenantSettings(tenantId: string): Promise<TenantSettings | null>;
  upsertTenantSettings(settings: TenantSettings): Promise<TenantSettings>;
  listPlatformApiKeys(): Promise<PlatformApiKey[]>;
  listPlatformEmailTemplates(): Promise<PlatformEmailTemplate[]>;
  listPlatformWebhookEndpoints(): Promise<PlatformWebhookEndpoint[]>;
}

/**
 * Standards / skill-graph domain (Sprint 8 remainder) — platform-global
 * curriculum-standards reference + skill-graph metadata. Filtering/sorting +
 * active-version/template selection stay in repos; the store is a row store.
 * No RLS. Per-learner curriculum uploads / term syllabi are tutor-svc-owned
 * (REST) and not part of this store.
 */
export interface StandardsStore {
  listFrameworks(): Promise<StandardsFramework[]>;
  getFramework(id: string): Promise<StandardsFramework | null>;
  upsertFramework(f: StandardsFramework): Promise<StandardsFramework>;
  listStandardDocuments(): Promise<StandardDocument[]>;
  listStandards(): Promise<Standard[]>;
  getStandard(id: string): Promise<Standard | null>;
  listDomains(): Promise<Domain[]>;
  listSkillPrerequisites(): Promise<SkillPrerequisite[]>;
  upsertSkillPrerequisite(p: SkillPrerequisite): Promise<SkillPrerequisite>;
  listSkillVersions(): Promise<SkillVersion[]>;
  upsertSkillVersion(v: SkillVersion): Promise<SkillVersion>;
  listCurriculumMaps(): Promise<CurriculumMap[]>;
  upsertCurriculumMap(m: CurriculumMap): Promise<CurriculumMap>;
  listLessonObjectiveTemplates(): Promise<LessonObjectiveTemplate[]>;
  listAssessmentBlueprints(): Promise<AssessmentBlueprint[]>;
  /**
   * Pre-generated baseline question bank (web_baseline_bank), grown daily by
   * the baseline-bank-generator CronJob and read by createBaseline to serve
   * baselines instantly. Returns [] in memory mode (the committed seed file is
   * the dev/test source).
   */
  listBaselineBankItems(): Promise<BaselineBankItem[]>;
  listImportJobs(): Promise<CurriculumImportJob[]>;
  getImportJob(id: string): Promise<CurriculumImportJob | null>;
  upsertImportJob(j: CurriculumImportJob): Promise<CurriculumImportJob>;
}

export interface Persistence {
  mode: PersistenceMode;
  notifications: NotificationStore;
  audit: AuditStore;
  identity: IdentityStore;
  learners: LearnerStore;
  assessments: AssessmentStore;
  lessonRuns: LessonRunStore;
  brainProfiles: BrainProfileStore;
  curriculum: CurriculumStore;
  compliance: ComplianceStore;
  quests: QuestStore;
  admin: AdminStore;
  collaboration: CollaborationStore;
  billing: BillingStore;
  clinical: ClinicalStore;
  security: SecurityStore;
  rostering: RosteringStore;
  audio: AudioStore;
  safety: SafetyStore;
  support: SupportStore;
  settings: SettingsStore;
  engagement: EngagementStore;
  standards: StandardsStore;
  /**
   * Future domains land here. Each new domain ships:
   *   1. An interface in this file.
   *   2. A memory impl in `./memory/<domain>.ts`.
   *   3. A drizzle impl in `./drizzle/<domain>.ts`.
   *   4. A line in `Persistence` aggregating it.
   *   5. A line in `index.ts` `getPersistence` resolving the per-domain
   *      mode and constructing the chosen impl.
   * The migration order is fixed by ADR 0007.
   */
}
