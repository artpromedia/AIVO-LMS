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
  AuditLog,
  BaselineAssessment,
  BaselineAttempt,
  BaselineItemResponseLog,
  BaselineQuestion,
  Classroom,
  ConsentRecord,
  ConsentType,
  Enrollment,
  GeneratedLessonPlan,
  IEPDocument,
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
import type { AgeGateRecord } from "@/lib/db/types";
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
