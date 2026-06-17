/**
 * Typed repository functions over the in-memory store. Every read scopes by
 * tenantId; every write stamps tenantId. This keeps the swap to Drizzle +
 * Postgres a body-only replacement (signatures stay stable).
 */
import { getStore, newId, nowIso } from "@/lib/db/store";
import { getPersistence, resolvePersistenceMode } from "@/lib/db/persistence";
import {
  traceAssessmentSubmitAttempt,
  traceAssessmentSubmitPersisted,
  traceAssessmentSubmitFailed,
} from "@/lib/observability/assessment-trace";
import {
  assertLiveConfigured,
  isLiveCurriculum,
  tutorActiveFocusSafe,
  tutorCreateCurriculum,
  tutorDeleteCurriculum,
  tutorListCurriculum,
} from "@/lib/bff/tutor-curriculum";
import { brainPacingFocusSafe } from "@/lib/bff/brain-pacing";
import { ensureSeeded } from "@/lib/db/seed";
import { computeReadinessFor } from "@/lib/learner/readiness";
import { listLearnersForMember as listLearnersForTeamMember, getCareTeam } from "@/lib/db/team-invites";
import {
  deriveRoleAcknowledgements,
  type RoleAcknowledgementPayload,
} from "@/lib/collaboration/contribution-acknowledgement";
import { dispatchContributionAckEmail } from "@/lib/collaboration/contribution-acknowledgement-dispatch";
import {
  contributionAction,
  contributionEventsFromAuditLogs,
  computeContributionRetention,
  type ContributionEvent,
  type ContributionRetention,
} from "@/lib/collaboration/contribution-retention";
import type {
  AuditLog,
  BaselineAssessment,
  BaselineAttempt,
  BaselineGenerationMetadata,
  BaselineItemResponseLog,
  BaselineQuestion,
  BaselineSummary,
  ItemPsychometrics,
  AccessibilityPreferences,
  ID,
  TermSyllabus,
  TermSyllabusUnit,
} from "@/lib/db/types";
import { ACCESSIBILITY_DEFAULTS } from "@/lib/db/types";
import type {
  ChildProfileDisclosure,
  CollaboratorInsight,
  IEPDocument,
  IEPExtraction,
  LearnerBrainProfile,
  BrainProfileApproval,
  LearnerBrainProfileChange,
  BrainProfileChangeSource,
  ContributionAcknowledgement,
  ContributionRole,
  LearnerBrainProfileState,
  LearnerProfile,
  LearningPath,
  LessonOutcome,
  MasteryMap,
  MasterySnapshot,
  ParentAssessment,
  ParentAssessmentSectionId,
  TeacherAssessmentDraft,
  TeacherAssessmentSectionId,
  TherapistAssessmentDraft,
  ParentLessonSummary,
  ParentModification,
  ReadinessState,
  ReviewSchedule,
  Skill,
  SkillMastery,
  SkillMasteryLevel,
  Subject,
  StandardsFramework,
  StandardsFrameworkSlug,
  StandardDocument,
  Standard,
  Domain,
  SkillPrerequisite,
  SkillVersion,
  CurriculumMap,
  LessonObjectiveTemplate,
  AssessmentBlueprint,
  BaselineBankItem,
  CurriculumImportJob,
} from "@/lib/db/types";
import {
  defaultBaselineSubjectSlugs,
  generateAdaptiveBaselinePool,
  generateBaselineQuestions,
} from "@/lib/learner/baseline";
import { assertCorrectionsAllowed, foldParentModifications } from "@/lib/db/brain-corrections";
import { detectBrainProfileChange } from "@/lib/db/brain-profile-changes";
import {
  aggregateItemPsychometrics,
  buildRunTelemetry,
  recalibrationMap,
} from "@/lib/learner/baseline-telemetry";
import type { CalibrationMap } from "@/lib/learner/baseline-adaptive";
import {
  generateBaselineQuestionsViaLLM,
  mapLlmQuestionsToBaselineQuestions,
} from "@/lib/learner/baseline-llm";
import {
  ADVENTURE_CHAPTERS,
  generateDiscoveryChapter,
  mapDiscoveryActivitiesToBaselineQuestions,
} from "@/lib/learner/baseline-discovery";
import { selectBaselineFromBank, bankHasItems, bankModel } from "@/lib/learner/baseline-bank";
import {
  baselineAdaptiveEnabled,
  baselineBankEnabled,
  baselineDiscoveryEnabled,
  baselineLlmEnabled,
} from "@/lib/feature-flags";
import { logger } from "@/lib/observability/logger";
import { clientEnv } from "@/lib/env";
import { emitDegradation } from "@/lib/observability/degradation";
import {
  buildBaselineSummary,
  buildMasterySnapshotRows,
  computeSkillMasteryFromBaseline,
  generateLearningPath,
  generateReviewSchedules,
  levelFromScore,
} from "@/lib/learner/mastery";
import { selectNextSkills } from "@/lib/learner/select-next-skills";
import { emitLessonMasterySignal } from "@/lib/learner/mastery-signal-emitter";
import {
  canonicalSubjectKey,
  deliveryLevelFromTheta,
  normalizeGradeBand,
  masteryTargetFromOutcome,
  moveMasteryScore,
} from "@aivo/scoring";
import { buildBrainProfile } from "@/lib/learner/brain-profile";
import { brainProfileStateSchema } from "@/lib/validators/brain-profile";
import type { CreateLearnerInput, PatchLearnerInput } from "@/lib/validators/learner";

function db() {
  ensureSeeded();
  return getStore();
}

// ===== Subjects / Skills =====
// Routed through the persistence adapter (ADR 0007 step 8). Subjects
// and skills are effectively immutable post-seed; in postgres mode
// each call is a cached SELECT.
export async function listSubjects(): Promise<Subject[]> {
  return getPersistence().curriculum.listSubjects();
}

export async function getSubjectById(subjectId: string): Promise<Subject | null> {
  return getPersistence().curriculum.getSubjectById(subjectId);
}

export async function listSkills(subjectId?: string): Promise<Skill[]> {
  return getPersistence().curriculum.listSkills(subjectId);
}

// ===== Learner =====
// Routed through the persistence adapter (ADR 0007 step 4). The cross-
// domain logic — readiness recomputation, IEP cascade — stays here;
// the store owns only the learner row + relationship cascade on delete.

export async function listLearnersForParent(
  parentUserId: string,
  tenantId: string,
): Promise<LearnerProfile[]> {
  return getPersistence().learners.listForParent(parentUserId, tenantId);
}

export async function getLearner(id: string, tenantId: string): Promise<LearnerProfile | null> {
  return getPersistence().learners.getById(id, tenantId);
}

export async function parentCanAccessLearner(
  parentUserId: string,
  learnerId: string,
  tenantId: string,
): Promise<boolean> {
  return getPersistence().learners.parentCanAccess(parentUserId, learnerId, tenantId);
}

/**
 * Find the primary (or first) parent-of-record for a learner. Used by
 * consent enforcement so learner/teacher requests are still blocked
 * when the parent has revoked consent.
 */
export async function findPrimaryParentForLearner(
  learnerId: string,
  tenantId: string,
): Promise<string | null> {
  return getPersistence().learners.findPrimaryParent(learnerId, tenantId);
}

export async function createLearner(input: {
  tenantId: string;
  parentUserId: string;
  data: CreateLearnerInput;
}): Promise<LearnerProfile> {
  return getPersistence().learners.create(input);
}

export async function updateLearner(
  id: string,
  tenantId: string,
  patch: PatchLearnerInput,
): Promise<LearnerProfile | null> {
  return getPersistence().learners.update(id, tenantId, patch);
}

export async function deleteLearner(id: string, tenantId: string): Promise<boolean> {
  return getPersistence().learners.delete(id, tenantId);
}

export async function refreshLearnerReadiness(
  id: string,
  tenantId: string,
): Promise<ReadinessState | null> {
  const existing = await getPersistence().learners.getById(id, tenantId);
  if (!existing) return null;
  const state = await computeReadinessFor(id, tenantId);
  if (state !== existing.readinessState) {
    await getPersistence().learners.setReadinessState(id, tenantId, state);
  }
  return state;
}

/**
 * Sprint 3: persist the parent's decision on the optional collaborator
 * invite step and recompute readiness so the learner advances out of
 * `team_invite_optional`. Routed through the persistence adapter so the
 * decision is durable (survives a restart) in both memory and postgres.
 */
export async function setTeamInviteDecision(
  learnerId: string,
  tenantId: string,
  decision: "pending" | "done" | "skipped",
): Promise<LearnerProfile | null> {
  const updated = await getPersistence().learners.setTeamInviteDecision(
    learnerId,
    tenantId,
    decision,
  );
  if (!updated) return null;
  await refreshLearnerReadiness(learnerId, tenantId);
  return updated;
}

/**
 * Sprint 4: best-effort read of accepted-collaborator insights for the brain
 * builder. Isolated — any failure returns [] and is logged, so the insight
 * read can never throw back into submitParentAssessment / completeBaseline
 * (the durable write must not be masked by an optional input fetch).
 */
async function listCollaboratorInsightsSafe(
  learnerId: string,
  tenantId: string,
): Promise<CollaboratorInsight[]> {
  try {
    return await getPersistence().collaboration.listInsightsForLearner(learnerId, tenantId);
  } catch (err) {
    logger.warn({
      event: "brain_clone.collaborator_insights_unavailable",
      learnerId,
      tenantId,
      err: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ===== Parent Assessment =====
function emptyAnswers(): ParentAssessment["answers"] {
  return {
    goals: {},
    grade_subject: {},
    reading: {},
    math: {},
    attention: {},
    communication: {},
    sensory: {},
    homework: {},
    frustration: {},
    motivation: {},
    accommodations: {},
    pace: {},
    concerns: {},
    basics: {},
    strengths: {},
    background: {},
    learning_profile: {},
  };
}

/**
 * Read-only lookup of the existing parent assessment for a learner. Returns
 * null if none has been started yet — does NOT create a draft. Use this in
 * read paths and preflight validators that must remain mutation-free.
 */
export async function findParentAssessment(
  learnerId: string,
  tenantId: string,
): Promise<ParentAssessment | null> {
  return getPersistence().assessments.findParentAssessment(learnerId, tenantId);
}

export async function getOrCreateParentAssessment(
  learnerId: string,
  tenantId: string,
): Promise<ParentAssessment> {
  const existing = await findParentAssessment(learnerId, tenantId);
  if (existing) return existing;
  const id = newId("pa");
  const now = nowIso();
  const assessment: ParentAssessment = {
    id,
    learnerId,
    tenantId,
    answers: emptyAnswers(),
    completedSections: [],
    startedAt: now,
    updatedAt: now,
    submittedAt: null,
  };
  return getPersistence().assessments.upsertParentAssessment(assessment);
}

export async function patchParentAssessmentSection(
  learnerId: string,
  tenantId: string,
  section: ParentAssessmentSectionId,
  data: Record<string, unknown>,
): Promise<ParentAssessment> {
  const current = await getOrCreateParentAssessment(learnerId, tenantId);
  const completed = new Set(current.completedSections);
  completed.add(section);
  const next: ParentAssessment = {
    ...current,
    answers: {
      ...current.answers,
      [section]: data as ParentAssessment["answers"][typeof section],
    },
    completedSections: Array.from(completed),
    updatedAt: nowIso(),
  };
  return getPersistence().assessments.upsertParentAssessment(next);
}

/* ===== Teacher assessment DRAFT (Sprint C-07) =====
 * The autosave buffer for the teacher wizard. The system of record is
 * assessment-svc (`teacher_assessments`); these helpers persist the
 * in-progress draft so a teacher resumes after closing the tab. Keyed by
 * (learner, tenant, submitting teacher) so co-teachers keep separate
 * drafts. Mirrors the parent-assessment get-or-create + section-patch
 * pattern above. */

export async function findTeacherAssessmentDraft(
  learnerId: string,
  tenantId: string,
  submittedByUserId: string,
): Promise<TeacherAssessmentDraft | null> {
  return getPersistence().assessments.findTeacherAssessmentDraft(
    learnerId,
    tenantId,
    submittedByUserId,
  );
}

export async function getOrCreateTeacherAssessmentDraft(
  learnerId: string,
  tenantId: string,
  submittedByUserId: string,
): Promise<TeacherAssessmentDraft> {
  const existing = await findTeacherAssessmentDraft(learnerId, tenantId, submittedByUserId);
  if (existing) return existing;
  const now = nowIso();
  const draft: TeacherAssessmentDraft = {
    id: newId("tad"),
    learnerId,
    tenantId,
    submittedByUserId,
    answers: {},
    completedSections: [],
    startedAtMs: Date.now(),
    startedAt: now,
    updatedAt: now,
    submittedAt: null,
  };
  return getPersistence().assessments.upsertTeacherAssessmentDraft(draft);
}

export async function patchTeacherAssessmentSection(
  learnerId: string,
  tenantId: string,
  submittedByUserId: string,
  section: TeacherAssessmentSectionId,
  data: Record<string, unknown>,
): Promise<TeacherAssessmentDraft> {
  const current = await getOrCreateTeacherAssessmentDraft(learnerId, tenantId, submittedByUserId);
  const completed = new Set(current.completedSections);
  completed.add(section);
  const next: TeacherAssessmentDraft = {
    ...current,
    answers: { ...current.answers, [section]: data },
    completedSections: Array.from(completed),
    updatedAt: nowIso(),
  };
  return getPersistence().assessments.upsertTeacherAssessmentDraft(next);
}

/**
 * Stamp the draft submitted (idempotent buffer cleanup). The real record
 * is written to assessment-svc by the BFF; this only marks the local
 * draft so the wizard's resume logic shows the completed state and the
 * elapsed-time computation has a stable anchor.
 */
export async function markTeacherAssessmentDraftSubmitted(
  learnerId: string,
  tenantId: string,
  submittedByUserId: string,
): Promise<TeacherAssessmentDraft | null> {
  const current = await findTeacherAssessmentDraft(learnerId, tenantId, submittedByUserId);
  if (!current) return null;
  const next: TeacherAssessmentDraft = {
    ...current,
    submittedAt: nowIso(),
    updatedAt: nowIso(),
  };
  return getPersistence().assessments.upsertTeacherAssessmentDraft(next);
}

/* ===== Therapist assessment DRAFT (Sprint C-10) =====
 * The autosave buffer for the single-page therapist intake form. The system
 * of record is assessment-svc (`therapist_assessments`); these helpers persist
 * the in-progress draft so a clinician resumes after closing the tab. Keyed by
 * (learner, tenant, submitting therapist) so two therapists on the same
 * caseload keep separate drafts. Sibling of the teacher draft helpers above —
 * the therapist form is single-page, so the whole payload lives under the one
 * `"form"` section key. */

export async function findTherapistAssessmentDraft(
  learnerId: string,
  tenantId: string,
  submittedByUserId: string,
): Promise<TherapistAssessmentDraft | null> {
  return getPersistence().assessments.findTherapistAssessmentDraft(
    learnerId,
    tenantId,
    submittedByUserId,
  );
}

export async function getOrCreateTherapistAssessmentDraft(
  learnerId: string,
  tenantId: string,
  submittedByUserId: string,
): Promise<TherapistAssessmentDraft> {
  const existing = await findTherapistAssessmentDraft(learnerId, tenantId, submittedByUserId);
  if (existing) return existing;
  const now = nowIso();
  const draft: TherapistAssessmentDraft = {
    id: newId("thad"),
    learnerId,
    tenantId,
    submittedByUserId,
    answers: {},
    completedSections: [],
    startedAtMs: Date.now(),
    startedAt: now,
    updatedAt: now,
    submittedAt: null,
  };
  return getPersistence().assessments.upsertTherapistAssessmentDraft(draft);
}

/**
 * Persist the single-page therapist form payload (autosave). The whole form
 * lives under the `"form"` section so the draft round-trips on resume. Marks
 * `"form"` complete (the form has content) and stamps updatedAt.
 */
export async function patchTherapistAssessmentForm(
  learnerId: string,
  tenantId: string,
  submittedByUserId: string,
  data: Record<string, unknown>,
): Promise<TherapistAssessmentDraft> {
  const current = await getOrCreateTherapistAssessmentDraft(learnerId, tenantId, submittedByUserId);
  const next: TherapistAssessmentDraft = {
    ...current,
    answers: { ...current.answers, form: data },
    completedSections: ["form"],
    updatedAt: nowIso(),
  };
  return getPersistence().assessments.upsertTherapistAssessmentDraft(next);
}

/**
 * Stamp the therapist draft submitted (idempotent buffer cleanup). The real
 * record is written to assessment-svc by the BFF; this only marks the local
 * draft so the form's resume logic shows the completed state and the
 * elapsed-time computation has a stable anchor.
 */
export async function markTherapistAssessmentDraftSubmitted(
  learnerId: string,
  tenantId: string,
  submittedByUserId: string,
): Promise<TherapistAssessmentDraft | null> {
  const current = await findTherapistAssessmentDraft(learnerId, tenantId, submittedByUserId);
  if (!current) return null;
  const next: TherapistAssessmentDraft = {
    ...current,
    submittedAt: nowIso(),
    updatedAt: nowIso(),
  };
  return getPersistence().assessments.upsertTherapistAssessmentDraft(next);
}

export async function submitParentAssessment(
  learnerId: string,
  tenantId: string,
): Promise<ParentAssessment | null> {
  const current = await getOrCreateParentAssessment(learnerId, tenantId);
  const submitted: ParentAssessment = {
    ...current,
    submittedAt: nowIso(),
    updatedAt: nowIso(),
  };

  // The submittedAt upsert is the transaction of record: persist it FIRST,
  // isolate every later side-effect (Sprint 1). The trace makes the durable
  // write observable so a silent RLS rejection can't masquerade as success.
  const assessmentsMode = resolvePersistenceMode("assessments");
  const startedMs = Date.now();
  traceAssessmentSubmitAttempt({ learnerId, tenantId, mode: assessmentsMode });
  let result: ParentAssessment;
  try {
    result = await getPersistence().assessments.upsertParentAssessment(submitted);
  } catch (err) {
    traceAssessmentSubmitFailed({
      learnerId,
      tenantId,
      mode: assessmentsMode,
      durationMs: Date.now() - startedMs,
      reason: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  if (!result?.submittedAt) {
    // A write that "succeeds" but does not return a row with submittedAt set
    // (e.g. an RLS-rejected upsert that silently affects zero rows) is a
    // failed save, not a success. Surface it instead of returning a phantom.
    traceAssessmentSubmitFailed({
      learnerId,
      tenantId,
      mode: assessmentsMode,
      durationMs: Date.now() - startedMs,
      reason: "submitted_at_not_persisted",
    });
    throw new Error(
      `submitParentAssessment: durable write did not persist submittedAt for learner ${learnerId}`,
    );
  }
  traceAssessmentSubmitPersisted({
    learnerId,
    tenantId,
    mode: assessmentsMode,
    durationMs: Date.now() - startedMs,
  });

  // Auto-generate the pre-clone brain profile on submit so the parent sees
  // a brain in the UI immediately and `completeBaseline` has a profile to
  // upgrade to "cloned". Without this, the brain clone never lands unless
  // the parent first visits the brain-profile page manually.
  try {
    const existingProfile = await getBrainProfile(learnerId, tenantId);
    if (!existingProfile) {
      const learner = await getLearner(learnerId, tenantId);
      if (learner) {
        const iep = await getIEPForLearner(learnerId, tenantId);
        const subjects = await listSubjects();
        const collaboratorInsights = await listCollaboratorInsightsSafe(learnerId, tenantId);
        const candidate = buildBrainProfile({
          learner,
          assessment: result ?? submitted,
          iepExtraction: iep?.extraction ?? null,
          iepUploaded: Boolean(iep),
          subjects,
          baselineAttempts: 0,
          collaboratorInsights,
        });
        const v = brainProfileStateSchema.safeParse(candidate);
        if (v.success) {
          await upsertBrainProfile(learnerId, tenantId, v.data);
        } else {
          logger.warn({
            event: "parent_assessment.preclone_skipped",
            learnerId,
            tenantId,
            reason: "schema_validation_failed",
          });
        }
      }
    }
  } catch (err) {
    // Pre-clone generation is a best-effort side effect. Failing here must
    // not block the parent assessment submission.
    logger.warn({
      event: "parent_assessment.preclone_failed",
      learnerId,
      tenantId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return result;
}

// ===== IEP (Sprint 6) =====
// Routed through the persistence adapter (ADR 0007 step 9). The
// learner.iepDecision side-effect stays in repos.ts so the upsert /
// delete / extraction pipeline remains atomic with the learner row.
export async function getIEPForLearner(
  learnerId: string,
  tenantId: string,
): Promise<IEPDocument | null> {
  return getPersistence().compliance.getIEPForLearner(learnerId, tenantId);
}

export async function uploadIEPDocument(input: {
  learnerId: string;
  tenantId: string;
  fileName: string;
  mimeType: string;
  bytes: number;
}): Promise<IEPDocument> {
  const compliance = getPersistence().compliance;
  // Single IEP per learner — overwrite any prior pending doc.
  const existing = await compliance.getIEPForLearner(input.learnerId, input.tenantId);
  if (existing) await compliance.deleteIEP(input.learnerId, input.tenantId);
  const doc: IEPDocument = {
    id: newId("iep"),
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    fileName: input.fileName,
    mimeType: input.mimeType,
    bytes: input.bytes,
    uploadedAt: nowIso(),
    status: "pending",
    extraction: null,
    acceptedAccommodations: null,
    confirmedAt: null,
  };
  await compliance.upsertIEP(doc);
  // Mark learner as having decided "uploaded".
  const learner = await getLearner(input.learnerId, input.tenantId);
  if (learner) {
    db().learnerProfiles.set(input.learnerId, { ...learner, iepDecision: "uploaded" });
  }
  return doc;
}

export async function deleteIEPForLearner(learnerId: string, tenantId: string): Promise<boolean> {
  const removed = await getPersistence().compliance.deleteIEP(learnerId, tenantId);
  if (!removed) return false;
  const learner = await getLearner(learnerId, tenantId);
  if (learner) {
    db().learnerProfiles.set(learnerId, { ...learner, iepDecision: null });
  }
  return true;
}

export async function setIEPExtraction(
  learnerId: string,
  tenantId: string,
  extraction: IEPExtraction,
): Promise<IEPDocument | null> {
  const compliance = getPersistence().compliance;
  const existing = await compliance.getIEPForLearner(learnerId, tenantId);
  if (!existing) return null;
  const next: IEPDocument = { ...existing, extraction, status: "parsed" };
  return compliance.upsertIEP(next);
}

/**
 * Sprint 5: record the parent's explicit consent over the extracted
 * accommodations. Only the listed supports are applied downstream. We
 * also stamp `confirmedAt` so readiness / brain-profile generation can
 * trust the document was actively reviewed.
 */
export async function confirmIEPExtraction(
  learnerId: string,
  tenantId: string,
  acceptedAccommodations: string[],
): Promise<IEPDocument | null> {
  const existing = await getIEPForLearner(learnerId, tenantId);
  if (!existing) return null;
  // Defensive: only allow consent on labels that exist in the extraction.
  const allowed = new Set(existing.extraction?.accommodations ?? []);
  const accepted = acceptedAccommodations.filter((a) => allowed.has(a));
  const next: IEPDocument = {
    ...existing,
    acceptedAccommodations: accepted,
    confirmedAt: nowIso(),
  };
  return getPersistence().compliance.upsertIEP(next);
}

export async function recordIEPSkip(
  learnerId: string,
  tenantId: string,
): Promise<LearnerProfile | null> {
  const learner = await getLearner(learnerId, tenantId);
  if (!learner) return null;
  // Remove any prior uploaded doc — skip is an explicit decision.
  await getPersistence().compliance.deleteIEP(learnerId, tenantId);
  const next: LearnerProfile = { ...learner, iepDecision: "skipped" };
  db().learnerProfiles.set(learnerId, next);
  return next;
}

// ===== Brain profile (Sprint 7) =====
// Routed through the persistence adapter (ADR 0007 step 7). When
// AIVO_USE_BRAIN_SVC=true the service-client path in
// lib/services/brain-svc.ts bypasses the adapter entirely and talks
// to services/brain-svc — see ADR 0009.
export async function getBrainProfile(
  learnerId: string,
  tenantId: string,
): Promise<LearnerBrainProfile | null> {
  return getPersistence().brainProfiles.getForLearner(learnerId, tenantId);
}

export async function upsertBrainProfile(
  learnerId: string,
  tenantId: string,
  state: LearnerBrainProfileState,
): Promise<LearnerBrainProfile> {
  // Defense-in-depth: BFF guards already enforce tenant scope, but a future
  // caller forgetting the guard would otherwise be able to create a brain
  // profile under the wrong tenantId. Verify the learner actually belongs
  // here before mutating.
  const learner = await getLearner(learnerId, tenantId);
  if (!learner) {
    throw new Error(`upsertBrainProfile: learner ${learnerId} not found in tenant ${tenantId}`);
  }
  const existing = await getBrainProfile(learnerId, tenantId);
  const now = nowIso();
  if (existing) {
    const next: LearnerBrainProfile = {
      ...existing,
      state,
      updatedAt: now,
      // generation timestamp moves; approval + clone stage reset on regenerate.
      approvedByParent: false,
      approvalStatus: "pending_parent_review",
      cloneStage: "pre_clone",
      // C-06: a fresh generation rebuilds `state`, so the revision advances —
      // any prior approval no longer describes the live profile.
      revision: (existing.revision ?? 1) + 1,
      clonedAt: null,
      generatedAt: now,
    };
    const committed = await getPersistence().brainProfiles.upsert(next);
    // C-13: a regenerate from a profile the parent already reviewed/approved is
    // a structural-change origin — capture the delta off the prior reviewable
    // state. Pre-clone→pre-clone churn captures nothing (no review anchor).
    await captureBrainProfileChange({ before: existing, after: committed, source: "regenerate" });
    return committed;
  }
  const profile: LearnerBrainProfile = {
    id: newId("brp"),
    learnerId,
    tenantId,
    state,
    approvedByParent: false,
    approvalStatus: "pending_parent_review",
    cloneStage: "pre_clone",
    revision: 1,
    clonedAt: null,
    generatedAt: now,
    updatedAt: now,
  };
  return getPersistence().brainProfiles.upsert(profile);
}

/**
 * Clone the brain profile from the completed baseline — mirrors brain-svc's
 * `/api/brain/clone` step in production. Rebuilds the profile state with the
 * real per-domain mastery estimates + actual baseline attempt count, then
 * flips the lifecycle from `pre_clone` to `cloned`. Idempotent: calling on
 * an already-cloned profile re-runs the build (so a baseline replay refreshes
 * the snapshot) but never downgrades the stage.
 */
/**
 * Internal: validate a brain clone for `learnerId` against the given baseline
 * summary WITHOUT mutating the store. Returns the prepared next-state profile
 * record (caller is responsible for persisting it). Used as the pre-completion
 * gate in `completeBaseline` — by deferring all writes until after this
 * validation passes, a clone failure leaves no partial mutations behind.
 */
async function prepareBrainCloneFromSummary(
  learnerId: string,
  tenantId: string,
  summary: BaselineSummary,
): Promise<LearnerBrainProfile | null> {
  const learner = await getLearner(learnerId, tenantId);
  if (!learner) return null;
  // No early-return on a missing pre-clone profile: when none exists (legacy
  // learner, or a pre-clone that failed to persist) we build one straight
  // into the "cloned" stage below, so a completed baseline ALWAYS yields a
  // clone the parent can review. Returning null here was the bug that let
  // baseline completion silently produce no clone.
  const existing = await getBrainProfile(learnerId, tenantId);

  // Read-only: must not mutate the store on the preflight path, otherwise
  // a clone-prep failure would still leave a draft parent assessment behind.
  const assessment = await findParentAssessment(learnerId, tenantId);
  const iep = await getIEPForLearner(learnerId, tenantId);
  const subjects = await listSubjects();
  const collaboratorInsights = await listCollaboratorInsightsSafe(learnerId, tenantId);
  const candidate = buildBrainProfile({
    learner,
    assessment,
    iepExtraction: iep?.extraction ?? null,
    iepUploaded: Boolean(iep),
    subjects,
    baselineAttempts: summary.totalAnswered,
    baselineSummary: summary,
    collaboratorInsights,
  });
  const parsed = brainProfileStateSchema.safeParse(candidate);
  if (!parsed.success) {
    // Do not silently drop to no-clone: surface the failing paths so a schema
    // regression is diagnosable instead of presenting as a missing animation.
    logger.warn({
      event: "brain_clone.schema_invalid",
      learnerId,
      tenantId,
      issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
    return null;
  }

  const now = nowIso();
  if (!existing) {
    // No pre-clone profile yet (e.g. legacy parent who never visited the
    // brain-profile page and submitParentAssessment ran before the
    // auto-generate fix). Build one straight into "cloned" stage so the
    // baseline completion still produces a brain clone the parent can
    // approve.
    return {
      id: newId("brp"),
      learnerId,
      tenantId,
      state: parsed.data,
      approvedByParent: false,
      approvalStatus: "pending_parent_review",
      cloneStage: "cloned",
      revision: 1,
      clonedAt: now,
      generatedAt: now,
      updatedAt: now,
    };
  }
  return {
    ...existing,
    state: parsed.data,
    cloneStage: existing.cloneStage === "approved" ? "approved" : "cloned",
    // C-06: re-clone rebuilds `state` from a fresh baseline → revision advances.
    revision: (existing.revision ?? 1) + 1,
    clonedAt: existing.clonedAt ?? now,
    updatedAt: now,
  };
}

/** Internal: commit a prepared brain clone to the store.
 *
 *  C-13: capture the change off the profile's prior committed state. The brain
 *  store is untouched between `prepareBrainCloneFromSummary` and here, so the
 *  current row IS the BEFORE state. A first clone (no prior reviewable profile)
 *  fires SCREEN 0; a re-clone that shifts supports/level/tutors records a
 *  structural change and notifies. `source` defaults to a baseline re-clone. */
async function commitBrainClone(
  profile: LearnerBrainProfile,
  source: BrainProfileChangeSource = "baseline_reclone",
): Promise<LearnerBrainProfile> {
  const before = await getBrainProfile(profile.learnerId, profile.tenantId);
  const committed = await getPersistence().brainProfiles.upsert(profile);
  await captureBrainProfileChange({ before, after: committed, source });
  return committed;
}

/**
 * Lookup-path clone: rebuild the brain profile from the most recent completed
 * baseline. Idempotent. Used outside of `completeBaseline` (e.g. manual retry,
 * future scheduled re-clone). Inside `completeBaseline` we use the prepare +
 * commit primitives directly to keep the whole transition atomic.
 */
export async function cloneBrainFromBaseline(
  learnerId: string,
  tenantId: string,
): Promise<LearnerBrainProfile | null> {
  // Most-recent completed baseline for the learner — uses the
  // assessment store so this is also drizzle-ready.
  const active = await getPersistence().assessments.getActiveBaselineForLearner(
    learnerId,
    tenantId,
  );
  const latest = active && active.status === "complete" && active.summary ? active : null;
  if (!latest || !latest.summary) return null;
  const prepared = await prepareBrainCloneFromSummary(learnerId, tenantId, latest.summary);
  if (!prepared) return null;
  return commitBrainClone(prepared);
}

/**
 * Sprint C-05: stage the parent's review-screen corrections server-side so
 * they survive navigation (resume state lives in the profile record, never
 * in component state). Replaces any previously staged draft; an empty list
 * clears it (the confirm-all fast path). The corrections are NOT folded yet
 * — `approveBrainClone` folds them when the parent approves.
 *
 * Therapist-pinned supports are enforced here as well as at fold time: a
 * forged "turn it off" modification throws `BrainCorrectionLockedError`.
 * Returns null when there is nothing reviewable (no profile, still
 * `pre_clone`, or already `approved` — the review is closed).
 */
export async function stageBrainCorrections(
  learnerId: string,
  tenantId: string,
  modifications: ParentModification[],
): Promise<LearnerBrainProfile | null> {
  const existing = await getBrainProfile(learnerId, tenantId);
  if (!existing) return null;
  if (existing.cloneStage !== "cloned") return null;
  assertCorrectionsAllowed(existing.state, modifications);
  const state: LearnerBrainProfileState = { ...existing.state };
  if (modifications.length > 0) {
    state.parentCorrectionsDraft = { modifications, savedAt: nowIso() };
  } else {
    delete state.parentCorrectionsDraft;
  }
  const next: LearnerBrainProfile = { ...existing, state, updatedAt: nowIso() };
  return getPersistence().brainProfiles.upsert(next);
}

/**
 * Parent approval gate (Sprint 14 brain-clone watch). Transitions a cloned
 * brain profile to `approved` — or `amended` when the parent corrected any
 * inference first (Sprint C-05). Idempotent: re-approving an already-approved
 * profile returns it unchanged (a duplicate submit must never re-fold or
 * duplicate the modification record). Returns null when no clone exists or
 * it's still in `pre_clone` (baseline not yet finished).
 *
 * `options.modifications` (C-05) carries field-level corrections in the
 * brain-svc `parent_modifications` contract shape. When omitted, any
 * corrections the parent staged on the review screen
 * (`state.parentCorrectionsDraft`) are folded instead — this is the default
 * flow (stage on the review screen, return to the recap, approve), so the
 * recap's plain Approve button applies them without re-collecting anything.
 * Either way the corrections are folded into the live state by the Python
 * prefix rules (`lib/db/brain-corrections.ts`), recorded into
 * `state.xaiExplanation.parentModifications`, and the staged draft is cleared.
 * Any correction present ⇒ `approvalStatus: "amended"`. A forged unlock of a
 * therapist-pinned support throws `BrainCorrectionLockedError` — server-side
 * enforcement, not just UI. `options.amended` is the legacy boolean flag and
 * still forces "amended".
 */
export async function approveBrainClone(
  learnerId: string,
  tenantId: string,
  options: { amended?: boolean; modifications?: ParentModification[] } = {},
): Promise<LearnerBrainProfile | null> {
  const existing = await getBrainProfile(learnerId, tenantId);
  if (!existing) return null;
  if (existing.cloneStage === "pre_clone") return null;
  if (existing.cloneStage === "approved") return existing;
  // Explicit modifications win; otherwise fold whatever the parent staged on
  // the review screen. The staged draft is the resume-safe source of truth —
  // approving must apply it, never silently discard it.
  const modifications =
    options.modifications ?? existing.state.parentCorrectionsDraft?.modifications ?? [];
  let state = existing.state;
  if (modifications.length > 0) {
    // foldParentModifications appends the applied record AND clears the draft.
    state = foldParentModifications(existing.state, modifications, nowIso());
  } else if (existing.state.parentCorrectionsDraft) {
    // No corrections to apply (an empty staged draft) — close the review by
    // dropping the stale draft so the approved profile carries none.
    state = { ...existing.state };
    delete state.parentCorrectionsDraft;
  }
  const status: LearnerBrainProfile["approvalStatus"] =
    modifications.length > 0 || options.amended ? "amended" : "approved";
  const next: LearnerBrainProfile = {
    ...existing,
    state,
    approvedByParent: true,
    approvalStatus: status,
    cloneStage: "approved",
    // C-06: folding corrections mutates the live `state`, so the revision
    // advances; a plain approve (no fold) leaves the reviewed revision intact.
    revision: modifications.length > 0 ? (existing.revision ?? 1) + 1 : (existing.revision ?? 1),
    updatedAt: nowIso(),
  };
  return getPersistence().brainProfiles.upsert(next);
}

/**
 * Sprint C-06 — write one dedicated approval record (approve / amend /
 * decline). This is the audit evidence the ceremony produces: actor, action,
 * consent + RAI versions, the reviewed profile revision, folded modifications,
 * and a hashed request IP — kept out of the profile's display JSON so consent
 * is first-class, queryable. The caller (the approve server action) is
 * responsible for having enforced consent + RAI first; this just persists the
 * record. `id`/`createdAt` are filled in here when omitted.
 */
export async function recordBrainApproval(
  input: Omit<BrainProfileApproval, "id" | "createdAt"> &
    Partial<Pick<BrainProfileApproval, "id" | "createdAt">>,
): Promise<BrainProfileApproval> {
  const approval: BrainProfileApproval = {
    id: input.id ?? newId("bpa"),
    createdAt: input.createdAt ?? nowIso(),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    brainProfileId: input.brainProfileId,
    profileRevision: input.profileRevision,
    actorUserId: input.actorUserId,
    action: input.action,
    consentVersion: input.consentVersion,
    raiVersion: input.raiVersion,
    modifications: input.modifications,
    ipHash: input.ipHash,
  };
  return getPersistence().brainProfileApprovals.record(approval);
}

/** Sprint C-06 — the tenant-scoped approval history for a learner, newest-first. */
export async function listBrainApprovals(
  learnerId: string,
  tenantId: string,
): Promise<BrainProfileApproval[]> {
  return getPersistence().brainProfileApprovals.listForLearner(learnerId, tenantId);
}

// ===== Contributor acknowledgements (Sprint C-16) =====

const CONTRIBUTOR_NOTIFY_TARGET_ROLE: Record<ContributionRole, "teacher" | "caregiver" | "therapist"> = {
  teacher: "teacher",
  caregiver: "caregiver",
  therapist: "therapist",
};

/** Where a contributor's "Your contributions" surface lives, per role. The CTA
 *  in the acknowledgement note + the in-app notification deep-link here. */
function contributionsPathFor(role: ContributionRole, learnerId: string): string {
  switch (role) {
    case "teacher":
      return `/teacher/learners/${learnerId}`;
    case "caregiver":
      return `/caregiver/home`;
    case "therapist":
      return `/therapist/home`;
  }
}

/**
 * Sprint C-16 — the warm, role-aware in-app + email body for one contributor.
 * Privacy-safe by construction: names only the learner's first name + the
 * contributor's OWN folded item labels (never another contributor's content,
 * never the child's levels/diagnoses). Returned as a small struct so the same
 * copy backs both the in-app Notification row and the comms-svc email payload.
 */
export function buildContributionAckCopy(input: {
  role: ContributionRole;
  learnerFirstName: string;
  foldedItems: RoleAcknowledgementPayload["foldedItems"];
}): { title: string; body: string } {
  const { role, learnerFirstName, foldedItems } = input;
  // Lead with the contributor's most concrete folded item (a support label),
  // preferring an accommodation over a tutor since it is the more tangible
  // "this is what your note did". Gratitude without flattery; one specific fact.
  const lead =
    foldedItems.find((i) => i.kind === "accommodation") ?? foldedItems[0] ?? null;
  const roleWord =
    role === "therapist" ? "clinical note" : role === "teacher" ? "classroom note" : "observation";
  const title = `Your input shaped ${learnerFirstName}'s learning plan`;
  const body = lead
    ? `Thank you — your ${roleWord} helped keep ${lead.label} active for ${learnerFirstName}. It's now part of ${learnerFirstName}'s approved plan.`
    : `Thank you — your ${roleWord} is now part of ${learnerFirstName}'s approved plan.`;
  return { title, body };
}

/**
 * Sprint C-16 — on parent APPROVAL (the honest "your input is now in use"
 * trigger), derive per-contributor acknowledgements from the approved profile's
 * collaborator-sourced decisions and, for each contributor whose OWN input
 * folded, write an idempotent acknowledgement record + fire notifications.
 *
 *   - Idempotent per (contributor, learnerId, profileRevision, role): the store
 *     skips a duplicate natural key, so re-approving the same revision sends no
 *     duplicate. A later revision whose fold newly changed a contributor's
 *     contribution earns a fresh row (the unique key includes the revision).
 *   - A role whose input did NOT fold is ABSENT from the derivation → that
 *     contributor is acknowledged nothing and notified nothing (the negative
 *     case the sprint requires).
 *   - Notifications: the in-app Notification + per-channel preference gating go
 *     through `createNotification` (the contributor's own account, with a
 *     `targetRole` so the inbox routes them into the right role); the warm,
 *     role-aware EMAIL body is rendered by comms-svc's template route. Both are
 *     best-effort and never block the approval.
 *   - Each NEW acknowledgement also emits a `contribution.acknowledged` audit
 *     row (the retention metric's spine).
 *
 * A contributor is matched to their account by resolving the learner's care
 * team: the role's accepted member(s) supply the email + (when present) the
 * account id. A caregiver-sourced fold is acknowledged to every accepted
 * caregiver (shared role tag, 2 seats) — see the derivation module's note.
 *
 * Best-effort throughout: a failure here never breaks the approval (the brain
 * keeps teaching). Returns the records written (created + pre-existing) for the
 * caller's evidence/tests.
 */
export async function recordContributionAcknowledgements(input: {
  profile: LearnerBrainProfile;
  /** The reviewed revision the approval keyed off (C-06 pins this). */
  profileRevision: number;
  requestId?: string;
}): Promise<ContributionAcknowledgement[]> {
  const { profile, profileRevision } = input;
  const requestId = input.requestId ?? newId("req");
  const written: ContributionAcknowledgement[] = [];
  try {
    // Only approved/amended profiles acknowledge — folding alone never does.
    if (profile.cloneStage !== "approved") return written;

    const learner = await getLearner(profile.learnerId, profile.tenantId);
    const learnerFirstName =
      (learner?.firstName && learner.firstName.trim()) ||
      (learner?.preferredName && learner.preferredName.trim()) ||
      undefined;

    const payloads = deriveRoleAcknowledgements(profile.state, learnerFirstName);
    if (payloads.length === 0) return written; // nothing folded → nothing to do

    // Resolve the care team once so each role maps to its accepted member(s).
    const team = await getCareTeam(profile.learnerId, profile.tenantId);
    const acceptedByRole: Record<ContributionRole, { email: string; userId: string | null }[]> = {
      teacher: team.teachers
        .filter((m) => m.status === "ACCEPTED")
        .map((m) => ({ email: m.email, userId: m.memberUserId })),
      caregiver: team.caregivers
        .filter((m) => m.status === "ACCEPTED")
        .map((m) => ({ email: m.email, userId: m.memberUserId })),
      therapist: team.therapists
        .filter((m) => m.status === "ACCEPTED")
        .map((m) => ({ email: m.email, userId: m.memberUserId })),
    };

    for (const payload of payloads) {
      const members = acceptedByRole[payload.role];
      // A folded role with no accepted member on the team (e.g. the member was
      // removed after the insight landed) is skipped — there is no one to
      // notify, and over-claiming to a stranger would breach the privacy rule.
      if (!members || members.length === 0) continue;

      for (const member of members) {
        const email = member.email.trim().toLowerCase();
        const ack: ContributionAcknowledgement = {
          id: newId("cack"),
          tenantId: profile.tenantId,
          learnerId: profile.learnerId,
          brainProfileId: profile.id,
          profileRevision,
          role: payload.role,
          contributorUserId: member.userId,
          contributorEmail: email,
          learnerFirstName: payload.learnerFirstName,
          foldedItems: payload.foldedItems,
          acknowledgedAt: nowIso(),
          notifiedInApp: false,
          notifiedEmail: false,
          createdAt: nowIso(),
        };
        const { ack: stored, created } =
          await getPersistence().contributionAcknowledgements.record(ack);
        written.push(stored);
        // Idempotency: a pre-existing row (re-approval of the same revision)
        // never re-notifies and never re-emits the retention event.
        if (!created) continue;

        // Retention spine: one audit row per NEW acknowledgement.
        await recordAudit({
          userId: member.userId,
          tenantId: profile.tenantId,
          learnerId: profile.learnerId,
          action: contributionAction("acknowledged"),
          metadata: {
            contributorKey: email,
            role: payload.role,
            profileRevision,
            foldedItemCount: payload.foldedItems.length,
          },
          requestId,
        });

        // Notifications (best-effort, never block approval).
        await notifyContributionAcknowledged(stored).catch(() => {});
      }
    }
  } catch (err) {
    logger.warn({
      event: "contribution_acknowledgement.capture_failed",
      learnerId: profile.learnerId,
      tenantId: profile.tenantId,
      message: err instanceof Error ? err.message : String(err),
    });
  }
  return written;
}

/**
 * Sprint C-16 — fire the in-app + email acknowledgement for ONE recorded
 * acknowledgement. In-app + per-channel preference gating ride
 * `createNotification` keyed to the contributor's account (account-holding
 * contributors only — an email-only invitee gets just the email). The warm,
 * role-aware email body is rendered by comms-svc's template route. Stamps the
 * record's delivery flags. Best-effort.
 */
async function notifyContributionAcknowledged(
  ack: ContributionAcknowledgement,
): Promise<void> {
  const { title, body } = buildContributionAckCopy({
    role: ack.role,
    learnerFirstName: ack.learnerFirstName,
    foldedItems: ack.foldedItems,
  });
  const href = contributionsPathFor(ack.role, ack.learnerId);
  let notifiedInApp = false;
  let notifiedEmail = false;

  // In-app notification — only for an account-holding contributor (a row keyed
  // to a userId). `createNotification` applies the contributor's per-channel
  // preferences (opt-out honored) and stamps the targetRole so the inbox routes
  // them into the right role before navigating.
  if (ack.contributorUserId) {
    try {
      await createNotification({
        tenantId: ack.tenantId,
        userId: ack.contributorUserId,
        type: "contribution_acknowledged",
        title,
        body,
        href,
        learnerId: ack.learnerId,
        targetRole: CONTRIBUTOR_NOTIFY_TARGET_ROLE[ack.role],
      });
      notifiedInApp = true;
    } catch {
      /* best-effort */
    }
  }

  // Warm role-aware email via comms-svc.
  const appUrl = clientEnv.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  const ok = await dispatchContributionAckEmail({
    to: ack.contributorEmail,
    role: ack.role,
    learnerFirstName: ack.learnerFirstName,
    foldedItems: ack.foldedItems,
    contributionsUrl: `${appUrl}${href}`,
    unsubscribeUrl: `${appUrl}/notifications`,
  });
  notifiedEmail = ok;

  if (notifiedInApp || notifiedEmail) {
    await getPersistence()
      .contributionAcknowledgements.markNotified(ack.id, { notifiedInApp, notifiedEmail })
      .catch(() => {});
  }
}

/** Sprint C-16 — a contributor's OWN acknowledgements (by userId or email),
 *  optionally scoped to one learner. Newest-first. The summary card + the
 *  contributions endpoint read this — it returns only the caller's own items. */
export async function listContributorAcknowledgements(opts: {
  tenantId: string;
  contributorUserId: string | null;
  contributorEmail: string;
  learnerId?: string;
}): Promise<ContributionAcknowledgement[]> {
  return getPersistence().contributionAcknowledgements.listForContributor(opts);
}

/** Sprint C-16 — every acknowledgement for a learner (the admin/retention read).
 *  Newest-first. */
export async function listLearnerContributionAcknowledgements(
  learnerId: string,
  tenantId: string,
): Promise<ContributionAcknowledgement[]> {
  return getPersistence().contributionAcknowledgements.listForLearner(learnerId, tenantId);
}

/** Sprint C-16 — every acknowledgement in a tenant (the retention read path).
 *  Newest-first. */
export async function listTenantContributionAcknowledgements(
  tenantId: string,
): Promise<ContributionAcknowledgement[]> {
  return getPersistence().contributionAcknowledgements.listForTenant(tenantId);
}

/**
 * Sprint C-16 — the DoD retention metric (repeat-contribution rate) for a
 * tenant. The computation rides the same durable, queryable read-paths C-14's
 * funnel uses: the acknowledgement records supply the `acknowledged` events and
 * the audit log supplies the `contribution.submitted` events. The pure reducer
 * (`computeContributionRetention`) then computes the share of acknowledged
 * contributors who contributed again within `windowDays` (default 60).
 *
 * No dashboard (out of scope) — a computable rate read by the admin/analytics
 * surface. `auditLimit` bounds how many recent audit rows we scan for
 * submissions (default 5000 — generous for a tenant's contribution cadence).
 */
export async function computeContributorRetentionForTenant(opts: {
  tenantId: string;
  windowDays?: number;
  auditLimit?: number;
}): Promise<ContributionRetention> {
  const { tenantId, windowDays = 60, auditLimit = 5000 } = opts;
  // `acknowledged` events from the acknowledgement records (the spine).
  const acks = await getPersistence().contributionAcknowledgements.listForTenant(tenantId);
  const ackEvents: ContributionEvent[] = acks.map((a) => ({
    name: "acknowledged" as const,
    contributorKey: a.contributorEmail.trim().toLowerCase(),
    role: a.role,
    occurredAt: a.acknowledgedAt,
  }));
  // `submitted` events from the audit log (`contribution.submitted` rows).
  const auditRows = await getPersistence().audit.recentForTenant(tenantId, auditLimit);
  const submittedEvents = contributionEventsFromAuditLogs(
    auditRows.map((r) => ({
      action: r.action,
      occurredAt: r.occurredAt,
      metadata: r.metadata ?? null,
    })),
  ).filter((e) => e.name === "submitted");

  return computeContributionRetention([...ackEvents, ...submittedEvents], windowDays);
}

// ===== Brain profile change records (Sprint C-13) =====

/**
 * Sprint C-13 — persist one change record. Append-only. The caller has already
 * detected + classified the delta (`detectBrainProfileChange`); this just
 * stamps id/createdAt and stores it. `requiresAck` is the contract-derived
 * structural flag — never set ad-hoc here.
 */
export async function recordBrainProfileChange(
  input: Omit<LearnerBrainProfileChange, "id" | "createdAt" | "ackedAt" | "reminderSentAt"> &
    Partial<Pick<LearnerBrainProfileChange, "id" | "createdAt" | "ackedAt" | "reminderSentAt">>,
): Promise<LearnerBrainProfileChange> {
  const change: LearnerBrainProfileChange = {
    id: input.id ?? newId("bpc"),
    createdAt: input.createdAt ?? nowIso(),
    ackedAt: input.ackedAt ?? null,
    reminderSentAt: input.reminderSentAt ?? null,
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    brainProfileId: input.brainProfileId,
    revision: input.revision,
    kind: input.kind,
    fields: input.fields,
    summary: input.summary,
    source: input.source,
    requiresAck: input.requiresAck,
  };
  return getPersistence().brainProfileChanges.record(change);
}

/** Sprint C-13 — the tenant-scoped change history for a learner, newest-first. */
export async function listBrainProfileChanges(
  learnerId: string,
  tenantId: string,
): Promise<LearnerBrainProfileChange[]> {
  return getPersistence().brainProfileChanges.listForLearner(learnerId, tenantId);
}

/** Sprint C-13 — un-acked structural changes for a learner (drives the
 *  persistent in-app badge after the N-day window lapses). Newest-first. */
export async function listPendingStructuralChanges(
  learnerId: string,
  tenantId: string,
): Promise<LearnerBrainProfileChange[]> {
  return getPersistence().brainProfileChanges.listPendingStructural(learnerId, tenantId);
}

/**
 * Sprint C-13 — acknowledge a structural change (the parent has seen the
 * delta). Idempotent: re-acking returns the row unchanged. Returns null when
 * `changeId` isn't a pending structural change for this learner (so the caller
 * can 404). The audit/disclosure trail is written by the calling server action
 * per C-12 conventions, not here.
 */
export async function ackBrainProfileChange(
  changeId: string,
  learnerId: string,
  tenantId: string,
): Promise<LearnerBrainProfileChange | null> {
  return getPersistence().brainProfileChanges.ack(changeId, learnerId, tenantId, nowIso());
}

/**
 * Sprint C-13 — the change-capture orchestration that runs at every mutation
 * path (see the Checkpoint's enumerated list). Given the profile state BEFORE
 * a mutation and the committed profile AFTER, it:
 *
 *   1. On the FIRST transition into `cloned` (no prior cloned/approved state) —
 *      fires the SCREEN 0 "ready for review" notification, deduped once per
 *      clone event. No change record (there is no prior state to diff).
 *   2. On any subsequent change from a cloned/approved baseline — detects +
 *      classifies the delta, writes a change record, and (structural only)
 *      notifies the parent with the plain-language summary + review CTA.
 *
 * Pre-clone regenerate churn (the BEFORE profile was missing or still
 * `pre_clone`, and the result is not the first clone) is intentionally NOT
 * captured: there is no approved profile to re-acknowledge and the parent has
 * seen nothing yet. Best-effort throughout — a capture failure never breaks the
 * mutation that triggered it (the brain must keep working).
 */
async function captureBrainProfileChange(input: {
  before: LearnerBrainProfile | null;
  after: LearnerBrainProfile;
  source: BrainProfileChangeSource;
}): Promise<void> {
  const { before, after, source } = input;
  try {
    const hadReviewable =
      before != null && (before.cloneStage === "cloned" || before.cloneStage === "approved");
    const becameCloned =
      after.cloneStage === "cloned" || after.cloneStage === "approved";

    // 1) First clone → SCREEN 0. Deduped: only when there was no reviewable
    //    profile before (a true first transition into cloned).
    if (!hadReviewable && becameCloned && after.cloneStage === "cloned") {
      await notifyBrainProfileReady(after);
      return;
    }

    // 2) Subsequent change from a reviewable baseline → detect + record.
    if (!hadReviewable || !before) return;
    const learner = await getLearner(after.learnerId, after.tenantId);
    const learnerName = learner?.displayName ?? "your learner";
    const delta = detectBrainProfileChange({
      before: before.state,
      after: after.state,
      source,
      learnerName,
    });
    if (!delta) return;

    await recordBrainProfileChange({
      tenantId: after.tenantId,
      learnerId: after.learnerId,
      brainProfileId: after.id,
      revision: after.revision,
      kind: delta.kind,
      fields: delta.fields,
      summary: delta.summary,
      source,
      requiresAck: delta.requiresAck,
    });

    // Structural changes notify the parent (mastery flows freely — no notice).
    if (delta.requiresAck) {
      await notifyBrainProfileChanged(after, delta.summary);
    }
  } catch (err) {
    logger.warn({
      event: "brain_profile_change.capture_failed",
      learnerId: after.learnerId,
      tenantId: after.tenantId,
      source,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Sprint C-13 — SCREEN 0: notify the primary parent that the profile is ready
 * for first review. In-app + email (the `brain_profile_ready` type's default
 * preference enables both); the parent's saved preferences are honored by
 * `createNotification`'s per-channel gating. Best-effort.
 */
async function notifyBrainProfileReady(profile: LearnerBrainProfile): Promise<void> {
  const parentId = await getPersistence().learners.findPrimaryParent(
    profile.learnerId,
    profile.tenantId,
  );
  if (!parentId) return;
  const learner = await getLearner(profile.learnerId, profile.tenantId);
  const name = learner?.displayName ?? "your learner";
  await createNotification({
    tenantId: profile.tenantId,
    userId: parentId,
    type: "brain_profile_ready",
    title: `${name}'s learning profile is ready`,
    body: `${name} finished their Discovery Adventure. We've drafted ${name}'s learning profile — it's waiting for you to review it.`,
    href: `/parent/learners/${profile.learnerId}/brain-clone-watch`,
    learnerId: profile.learnerId,
  });
}

/**
 * Sprint C-13 — notify the primary parent that the profile MEANINGFULLY (i.e.
 * structurally) changed since they approved it. In-app + email, with the
 * plain-language delta summary and a link to the change timeline. Best-effort.
 */
async function notifyBrainProfileChanged(
  profile: LearnerBrainProfile,
  summary: string,
): Promise<void> {
  const parentId = await getPersistence().learners.findPrimaryParent(
    profile.learnerId,
    profile.tenantId,
  );
  if (!parentId) return;
  const learner = await getLearner(profile.learnerId, profile.tenantId);
  const name = learner?.displayName ?? "your learner";
  await createNotification({
    tenantId: profile.tenantId,
    userId: parentId,
    type: "brain_profile_changed",
    title: `We adjusted ${name}'s supports — take a look`,
    body: summary,
    href: `/parent/learners/${profile.learnerId}/brain-timeline`,
    learnerId: profile.learnerId,
  });
}

/**
 * Sprint C-12 (ADR 0042) — record a FERPA cross-role read of a child's brain
 * profile on a web-v2 surface. Append-only. The web counterpart of the
 * services' `CHILD_PROFILE_DISCLOSED` audit event; the same disclosure tuple.
 * `id`/`disclosedAt` are filled in here when omitted. Best-effort at the call
 * site (a read must not fail because the disclosure write did).
 */
export async function recordChildProfileDisclosure(
  input: Omit<ChildProfileDisclosure, "id" | "disclosedAt"> &
    Partial<Pick<ChildProfileDisclosure, "id" | "disclosedAt">>,
): Promise<ChildProfileDisclosure> {
  const entry: ChildProfileDisclosure = {
    id: input.id ?? newId("cpd"),
    disclosedAt: input.disclosedAt ?? nowIso(),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    readerUserId: input.readerUserId,
    readerRole: input.readerRole,
    surface: input.surface,
    dataClass: input.dataClass,
  };
  return getPersistence().compliance.appendChildProfileDisclosure(entry);
}

/**
 * Sprint C-12 (ADR 0042) — the per-learner disclosure history, newest-first,
 * optionally bounded by an inclusive ISO time window. The compliance/admin
 * query surface for web-v2-side reads.
 */
export async function listChildProfileDisclosures(
  learnerId: string,
  tenantId: string,
  opts?: { fromIso?: string; toIso?: string },
): Promise<ChildProfileDisclosure[]> {
  return getPersistence().compliance.listChildProfileDisclosuresForLearner(
    learnerId,
    tenantId,
    opts,
  );
}

// ===== Baseline (Sprint 8) =====

export async function getActiveBaselineForLearner(
  learnerId: string,
  tenantId: string,
): Promise<BaselineAssessment | null> {
  return getPersistence().assessments.getActiveBaselineForLearner(learnerId, tenantId);
}

export async function getBaselineById(
  baselineId: string,
  tenantId: string,
): Promise<BaselineAssessment | null> {
  return getPersistence().assessments.getBaselineById(baselineId, tenantId);
}

export async function listBaselineQuestions(baselineId: string): Promise<BaselineQuestion[]> {
  return getPersistence().assessments.listBaselineQuestions(baselineId);
}

export async function listBaselineAttempts(
  baselineId: string,
  tenantId: string,
): Promise<BaselineAttempt[]> {
  return getPersistence().assessments.listBaselineAttempts(baselineId, tenantId);
}

/**
 * Create a baseline assessment + question bank for a learner. Requires that
 * the learner has a generated brain profile (Sprint 7 output) so the question
 * picks reflect comfort levels and accommodations.
 */
/**
 * Sprint B2 — async, LLM-first baseline creation.
 *
 * When `AIVO_FEATURE_BASELINE_LLM` is enabled and the parent has a
 * submitted assessment, this fetches questions from the assessment-svc
 * `/api/ai/generate-baseline` proxy. Any failure (flag off, network
 * timeout, validation, too-few questions, or no subject mapping) falls
 * back to the deterministic BANK in `lib/learner/baseline.ts` and emits
 * a structured `baseline.generation_fallback_used` log so the rollout
 * dashboard can track fallback rates.
 *
 * Generation provenance (source, model, token counts, fallback reason)
 * is persisted on `BaselineAssessment.generationMetadata` so the parent
 * UI can render a "Personalized by AI" badge and audit can trace every
 * baseline back to either an LLM call or the BANK.
 */
export async function createBaseline(input: {
  learnerId: string;
  tenantId: string;
  subjectIds?: string[];
}): Promise<{ baseline: BaselineAssessment; questions: BaselineQuestion[] } | null> {
  const store = db();
  const learner = store.learnerProfiles.get(input.learnerId);
  if (!learner || learner.tenantId !== input.tenantId) return null;

  const allSubjects = Array.from(store.subjects.values());
  const wantedSlugs = input.subjectIds?.length ? null : new Set(defaultBaselineSubjectSlugs());
  const subjects =
    input.subjectIds && input.subjectIds.length > 0
      ? allSubjects.filter((s) => input.subjectIds!.includes(s.id))
      : allSubjects.filter((s) => wantedSlugs!.has(s.slug));
  if (subjects.length === 0) return null;

  const skills = Array.from(store.skills.values()).filter((sk) =>
    subjects.some((s) => s.id === sk.subjectId),
  );

  const baseline: BaselineAssessment = {
    id: newId("bas"),
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    subjectIds: subjects.map((s) => s.id),
    status: "not_started",
    startedAt: null,
    completedAt: null,
    createdAt: nowIso(),
    summary: null,
  };

  const brainProfile = await getBrainProfile(input.learnerId, input.tenantId);
  const parentAssessment = await findParentAssessment(input.learnerId, input.tenantId);

  let questions: BaselineQuestion[] = [];
  // Definite-assignment: every code path below the discovery/LLM/BANK
  // ladder assigns this, but TS can't follow the `discoverySucceeded`
  // invariant across the chained `if / else if` branches.
  let metadata!: BaselineGenerationMetadata;

  const accommodationTags = accommodationTagsForBaseline(brainProfile);
  const llmFlag = baselineLlmEnabled();
  const canCallLlm = llmFlag && parentAssessment != null && parentAssessment.submittedAt != null;
  const discoveryFlag = baselineDiscoveryEnabled();
  const canCallDiscovery = discoveryFlag && canCallLlm;

  console.error(
    `[BASELINE_DIAG] start baselineId=${baseline.id} learnerId=${input.learnerId} llmFlag=${llmFlag} discoveryFlag=${discoveryFlag} canCallLlm=${canCallLlm} canCallDiscovery=${canCallDiscovery} hasParentAssessment=${parentAssessment != null} submittedAt=${parentAssessment?.submittedAt ?? "null"} hasBrainProfile=${brainProfile != null} subjects=${subjects.map((s) => s.slug).join(",")} skillsCount=${skills.length}`,
  );

  // ── Instant tier: pre-generated bank ──────────────────────────────────
  // Select from the offline-generated question bank (lib/learner/baseline-
  // bank.ts) — NO LLM on the request path — matched to the learner's grade
  // band + functioning level. Dynamic: the pick is randomised so repeated
  // baselines vary. Fail-open: when the bank lacks coverage for the learner's
  // cell the selector returns nothing and we fall through to the
  // discovery → LLM → BANK ladder below. This is what turns the baseline from
  // a ~130s blocking LLM render (which timed out at the ingress) into a
  // sub-millisecond pick.
  let bankSucceeded = false;
  if (baselineBankEnabled() && bankHasItems()) {
    const functioningLevel =
      brainProfile?.state.functioningLevel ?? learner.functioningLevel ?? null;
    // Fold in the daily-grown DB bank (web_baseline_bank) on top of the
    // committed seed file. Best-effort: a read failure (or memory mode) just
    // means we select from the seed file alone.
    let dbBankItems: BaselineBankItem[] = [];
    try {
      dbBankItems = await getPersistence().standards.listBaselineBankItems();
    } catch (err) {
      console.error(
        `[BASELINE_DIAG] bank_db_load_failed baselineId=${baseline.id} err=${err instanceof Error ? err.message : String(err)}`,
      );
      dbBankItems = [];
    }
    const bankQuestions = selectBaselineFromBank({
      baselineId: baseline.id,
      gradeBand: learner.gradeBand,
      functioningLevel,
      subjects,
      skills,
      accommodationTags,
      extraBankItems: dbBankItems,
    });
    const coveredSubjects = new Set(bankQuestions.map((q) => q.subjectId));
    if (bankQuestions.length > 0 && coveredSubjects.size >= subjects.length) {
      questions = bankQuestions;
      // Bank questions are LLM-generated offline and matched to the
      // learner's cohort (grade band × functioning level × accommodation
      // tags) — but NOT fused to this child's intake context, so the
      // provenance is `cohort_bank`, never `child_specific` (Wave A, G2).
      // `model` records the bank provenance for the audit trail. Serving
      // the bank here is the designed instant first tier, not a
      // degradation — no alert.
      metadata = {
        source: "ai",
        personalization: "cohort_bank",
        model: bankModel(),
        generatedAt: nowIso(),
      };
      bankSucceeded = true;
      console.error(
        `[BASELINE_DIAG] bank_hit baselineId=${baseline.id} questions=${bankQuestions.length} subjects=${coveredSubjects.size}/${subjects.length} gradeBand=${learner.gradeBand ?? "?"} level=${functioningLevel ?? "?"} dbItems=${dbBankItems.length}`,
      );
    } else {
      console.error(
        `[BASELINE_DIAG] bank_miss baselineId=${baseline.id} got=${bankQuestions.length} covered=${coveredSubjects.size}/${subjects.length} dbItems=${dbBankItems.length}`,
      );
    }
  }

  // Phase 0 — when the adaptive baseline is enabled, the BANK fallback uses
  // a wider, difficulty-spread pool so the runner's adaptive selector has
  // room to move (see `generateAdaptiveBaselinePool`). Off → identical
  // fixed-form behaviour as before.
  const bankGenerator = baselineAdaptiveEnabled()
    ? generateAdaptiveBaselinePool
    : generateBaselineQuestions;

  // Phase B — Discovery Adventure: attempt per-chapter generation
  // first so the parent gets the emoji-rich picture-prompt experience
  // ported from the legacy aivo-ai-learning client. Each chapter is
  // independent; partial successes are kept and the per-chapter
  // failure reasons surface on `generationMetadata.chapterFailures`.
  let discoverySucceeded = false;
  if (!bankSucceeded && canCallDiscovery) {
    const settled = await Promise.allSettled(
      ADVENTURE_CHAPTERS.map((chapter) =>
        generateDiscoveryChapter({ learnerId: input.learnerId, chapter }),
      ),
    );
    const collected: BaselineQuestion[] = [];
    const chaptersUsed: string[] = [];
    const chapterFailures: { chapterId: string; reason: string }[] = [];
    let modelUsed: string | undefined;
    let startOrder = 0;
    for (let i = 0; i < ADVENTURE_CHAPTERS.length; i++) {
      const chapter = ADVENTURE_CHAPTERS[i]!;
      const r = settled[i]!;
      if (r.status === "fulfilled" && r.value.ok) {
        const { questions: mapped, nextOrder } = mapDiscoveryActivitiesToBaselineQuestions({
          baselineId: baseline.id,
          chapter,
          activities: r.value.response.activities,
          subjects,
          skills,
          accommodationTags,
          startOrder,
        });
        if (mapped.length > 0) {
          modelUsed ??= r.value.response.model;
          collected.push(...mapped);
          startOrder = nextOrder;
          chaptersUsed.push(chapter.id);
        } else {
          chapterFailures.push({
            chapterId: chapter.id,
            reason: "no_subject_mapping",
          });
        }
      } else if (r.status === "fulfilled" && !r.value.ok) {
        chapterFailures.push({ chapterId: chapter.id, reason: r.value.reason });
      } else {
        chapterFailures.push({ chapterId: chapter.id, reason: "promise_rejected" });
      }
    }
    if (collected.length > 0) {
      questions = collected;
      metadata = {
        source: "ai",
        personalization: "child_specific",
        model: modelUsed ?? "discovery-adventure",
        generatedAt: nowIso(),
        chaptersUsed,
        ...(chapterFailures.length ? { chapterFailures } : {}),
      };
      discoverySucceeded = true;
      if (chapterFailures.length > 0) {
        logger.info(
          {
            event: "baseline.discovery_partial_success",
            learnerId: input.learnerId,
            tenantId: input.tenantId,
            baselineId: baseline.id,
            chaptersUsed,
            chapterFailures,
          },
          "baseline: discovery adventure produced partial chapter coverage",
        );
      }
    } else {
      console.error(
        `[BASELINE_DIAG] discovery_total_failure baselineId=${baseline.id} failures=${JSON.stringify(chapterFailures)}`,
      );
      logger.info(
        {
          event: "baseline.discovery_total_failure",
          learnerId: input.learnerId,
          tenantId: input.tenantId,
          baselineId: baseline.id,
          chapterFailures,
        },
        "baseline: discovery adventure produced no questions, falling back to flat LLM/BANK",
      );
    }
    if (discoverySucceeded) {
      console.error(
        `[BASELINE_DIAG] discovery_succeeded baselineId=${baseline.id} questions=${questions.length} chapters=${chaptersUsed.join(",")}`,
      );
    }
  }

  if (!bankSucceeded && !discoverySucceeded && canCallLlm) {
    const llmResult = await generateBaselineQuestionsViaLLM({
      parent_assessment: parentAssessment!.answers as unknown as Record<string, unknown>,
      functioning_level: brainProfile?.state.functioningLevel ?? "STANDARD",
      // Hand the assessment-svc proxy the learner id so it can fold in
      // the caregiver perspectives, teacher assessment, IEP, interests,
      // and district context that live in the assessment-svc DB (web-v2's
      // store doesn't hold them). Without this the flat-LLM tier would
      // personalize from the parent assessment alone.
      learner_id: input.learnerId,
    });

    console.error(
      `[BASELINE_DIAG] llm_call_result baselineId=${baseline.id} ok=${llmResult.ok} ${llmResult.ok ? `questions=${llmResult.response.questions.length} model=${llmResult.response.model}` : `reason=${llmResult.reason} message=${(llmResult as { message?: string }).message ?? ""}`}`,
    );
    if (llmResult.ok) {
      const mapped = mapLlmQuestionsToBaselineQuestions({
        baselineId: baseline.id,
        llmResponse: llmResult.response,
        subjects,
        skills,
        accommodationTags,
      });

      console.error(
        `[BASELINE_DIAG] llm_mapped baselineId=${baseline.id} mappedCount=${mapped.length} llmSubjects=${[...new Set(llmResult.response.questions.map((q) => q.subject))].join(",")} subjectSlugs=${subjects.map((s) => s.slug).join(",")}`,
      );
      if (mapped.length > 0) {
        questions = mapped;
        metadata = {
          source: "ai",
          personalization: "child_specific",
          model: llmResult.response.model,
          promptTokens: llmResult.response.prompt_tokens,
          completionTokens: llmResult.response.completion_tokens,
          generatedAt: nowIso(),
        };
      } else {
        // LLM call succeeded but no questions mapped to the requested
        // subjects — fall back so the parent never sees an empty
        // baseline.
        questions = bankGenerator({
          baselineId: baseline.id,
          learner,
          brainProfile,
          subjects,
          skills,
        });
        metadata = {
          source: "fallback",
          personalization: "generic",
          fallbackReason: "no_subject_mapping",
          generatedAt: nowIso(),
        };
        logger.info(
          {
            event: "baseline.generation_fallback_used",
            learnerId: input.learnerId,
            tenantId: input.tenantId,
            baselineId: baseline.id,
            reason: "no_subject_mapping",
          },
          "baseline: LLM result had no mappable subjects, used BANK fallback",
        );
        emitDegradation("baseline_generic_fallback", {
          reason: "no_subject_mapping",
          learnerId: input.learnerId,
          tenantId: input.tenantId,
          baselineId: baseline.id,
          message: "LLM baseline succeeded but no question mapped to a known subject",
        });
      }
    } else {
      questions = bankGenerator({
        baselineId: baseline.id,
        learner,
        brainProfile,
        subjects,
        skills,
      });
      metadata = {
        source: "fallback",
        personalization: "generic",
        fallbackReason: llmResult.reason,
        generatedAt: nowIso(),
      };
      logger.info(
        {
          event: "baseline.generation_fallback_used",
          learnerId: input.learnerId,
          tenantId: input.tenantId,
          baselineId: baseline.id,
          reason: llmResult.reason,
          message: llmResult.message,
        },
        "baseline: LLM generation failed, used BANK fallback",
      );
      // The LLM tier was enabled, eligible, reached — and failed. A 401/403
      // here is the silent-misconfig class (missing/rotated service token):
      // emitDegradation escalates those to critical.
      emitDegradation("baseline_generic_fallback", {
        reason: llmResult.reason,
        status: llmResult.status,
        learnerId: input.learnerId,
        tenantId: input.tenantId,
        baselineId: baseline.id,
        message: llmResult.message,
      });
    }
  } else if (!bankSucceeded && !discoverySucceeded) {
    questions = bankGenerator({
      baselineId: baseline.id,
      learner,
      brainProfile,
      subjects,
      skills,
    });
    // Expected steady states (flag explicitly off / parent assessment not
    // yet submitted) — honest generic provenance, but NOT a degradation
    // alert: these are by-design paths, not failures.
    metadata = {
      source: "fallback",
      personalization: "generic",
      fallbackReason: llmFlag ? "no_submitted_parent_assessment" : "flag_off",
      generatedAt: nowIso(),
    };
    if (llmFlag) {
      // Only log when the flag was on — "flag off" is the steady-state
      // production behaviour pre-rollout, not noise worth alerting on.
      logger.info(
        {
          event: "baseline.generation_fallback_used",
          learnerId: input.learnerId,
          tenantId: input.tenantId,
          baselineId: baseline.id,
          reason: "no_submitted_parent_assessment",
        },
        "baseline: no submitted parent assessment, used BANK fallback",
      );
    }
  }

  // S26: when a skill has an active AssessmentBlueprint, cap that skill's
  // question count to the blueprint's total item budget. The bank can be
  // bigger than the blueprint wants; the blueprint is the source of truth
  // for "how many items to assess this skill with." Skills with no
  // blueprint pass through untouched (back-compat for skills not yet
  // seeded).
  const perSkillBudget = new Map<string, number>();
  for (const sk of skills) {
    const bp = await getActiveAssessmentBlueprint(sk.id);
    if (bp) {
      const total = bp.items.reduce((acc, it) => acc + it.count, 0);
      if (total > 0) perSkillBudget.set(sk.id, total);
    }
  }
  if (perSkillBudget.size > 0) {
    const seen = new Map<string, number>();
    questions = questions.filter((q) => {
      const cap = perSkillBudget.get(q.skillId);
      if (cap === undefined) return true;
      const used = seen.get(q.skillId) ?? 0;
      if (used >= cap) return false;
      seen.set(q.skillId, used + 1);
      return true;
    });
  }

  const persistedBaseline = await getPersistence().assessments.upsertBaseline({
    ...baseline,
    generationMetadata: metadata,
  });
  baseline.generationMetadata = metadata;
  await getPersistence().assessments.appendBaselineQuestions(questions);
  return { baseline: persistedBaseline, questions };
}

/**
 * Sprint B2 — derive accommodation tags from the brain profile in a
 * shape that mirrors the BANK generator's `accommodationTagsFor`
 * (without exporting the BANK helper, which is internal to the
 * deterministic path). Kept here so the LLM-mapped questions carry the
 * same accommodation hints as the fallback questions, keeping the
 * downstream player render identical.
 */
function accommodationTagsForBaseline(brainProfile: LearnerBrainProfile | null): string[] {
  if (!brainProfile) return [];
  const s = brainProfile.state;
  const tags = new Set<string>();
  if (s.accessibilityPreferences?.audioFirst) tags.add("audio_first");
  if (s.accessibilityPreferences?.largeText) tags.add("large_text");
  if (s.accessibilityPreferences?.highContrast) tags.add("high_contrast");
  if (s.accessibilityPreferences?.reducedMotion) tags.add("reduced_motion");
  if (s.accessibilityPreferences?.captionsAlwaysOn) tags.add("captions");
  const summary = s.accommodationSummary ?? "";
  if (/extended.time/i.test(summary) || s.supportDefaults?.extendedTime) {
    tags.add("extended_time");
  }
  if (/break/i.test(summary) || s.supportDefaults?.sensoryBreaks) {
    tags.add("break_offered");
  }
  return Array.from(tags);
}

export async function startBaseline(
  baselineId: string,
  tenantId: string,
): Promise<BaselineAssessment | null> {
  const store = getPersistence().assessments;
  const b = await store.getBaselineById(baselineId, tenantId);
  if (!b) return null;
  if (b.status === "complete") return b;
  const next: BaselineAssessment = {
    ...b,
    status: "in_progress",
    startedAt: b.startedAt ?? nowIso(),
  };
  return store.upsertBaseline(next);
}

export async function recordBaselineAttempt(input: {
  baselineId: string;
  questionId: string;
  learnerId: string;
  tenantId: string;
  response: string;
  skipped?: boolean;
  /** Client-measured time-on-item in ms; stored when finite and ≥ 0. */
  latencyMs?: number;
}): Promise<BaselineAttempt | null> {
  const store = getPersistence().assessments;
  const baseline = await store.getBaselineById(input.baselineId, input.tenantId);
  if (!baseline) return null;
  if (baseline.learnerId !== input.learnerId) return null;
  if (baseline.status === "complete") return null;
  // Question lookup still hits the legacy Map directly via `listBaselineQuestions`
  // — single-row lookup by id without a full scan is cheap and keeps the
  // adapter surface narrow. Drizzle impl can add a `getQuestionById`.
  const questions = await store.listBaselineQuestions(input.baselineId);
  const q = questions.find((x) => x.id === input.questionId);
  if (!q) return null;

  const skipped = Boolean(input.skipped);
  const trimmed = (input.response ?? "").trim();
  const isCorrect = skipped
    ? false
    : q.expectedAnswer
      ? trimmed.toLowerCase() === q.expectedAnswer.trim().toLowerCase()
      : false;
  const latencyMs =
    typeof input.latencyMs === "number" && Number.isFinite(input.latencyMs) && input.latencyMs >= 0
      ? Math.round(input.latencyMs)
      : undefined;
  const attempt: BaselineAttempt = {
    id: newId("bat"),
    baselineId: input.baselineId,
    questionId: input.questionId,
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    response: skipped ? "" : trimmed,
    isCorrect,
    skipped,
    ...(latencyMs !== undefined ? { latencyMs } : {}),
    respondedAt: nowIso(),
  };
  await store.recordBaselineAttempt(attempt, {
    questionId: input.questionId,
    learnerId: input.learnerId,
  });

  // Promote to in_progress if it was still not_started.
  if (baseline.status === "not_started") {
    await store.upsertBaseline({
      ...baseline,
      status: "in_progress",
      startedAt: baseline.startedAt ?? nowIso(),
    });
  }
  return attempt;
}

/**
 * Complete the baseline: compute summary, mastery rows, learning path, review
 * schedule. Idempotent — calling twice returns the existing summary.
 */
export async function completeBaseline(
  baselineId: string,
  tenantId: string,
): Promise<{
  baseline: BaselineAssessment;
  summary: BaselineSummary;
  masteryMap: MasteryMap;
  skillMasteries: SkillMastery[];
  learningPath: LearningPath;
  reviewSchedules: ReviewSchedule[];
  /** Post-baseline clone of the brain profile; null if no pre-clone existed. */
  clonedBrainProfile: LearnerBrainProfile | null;
} | null> {
  // Seed the dev/test memory store before any adapter reads (no-op in
  // postgres mode); the store handle itself is intentionally unused — every
  // read/write below goes through the persistence adapter (ADR 0007).
  db();
  const baseline = await getPersistence().assessments.getBaselineById(baselineId, tenantId);
  if (!baseline) return null;
  // Read the learner through the persistence adapter, not the in-memory
  // `getStore()` Map. In postgres mode (production) the Map is empty, so the
  // legacy `store.learnerProfiles.get()` returned null here and aborted the
  // whole completion — meaning the brain clone never ran and the baseline was
  // never finalized. See ADR 0007.
  const learner = await getLearner(baseline.learnerId, tenantId);
  if (!learner) return null;

  // Idempotent short-circuit: a completed baseline returns the existing
  // snapshot (same summary, mastery map, learning path, review schedules) so
  // callers replaying the request get stable IDs and timestamps. Read through
  // the persistence adapter — in postgres mode the in-memory Maps are empty,
  // so a direct store read here would wrongly rebuild on every replay.
  if (baseline.status === "complete" && baseline.summary) {
    const curriculumStore = getPersistence().curriculum;
    const { map: existingMap, skillMasteries: existingMasteries } =
      await curriculumStore.getMasteryMapForLearner(baseline.learnerId, tenantId);
    const existingPath = await curriculumStore.getLearningPath(baseline.learnerId, tenantId);
    if (existingMap && existingPath) {
      const existingReviews = await curriculumStore.getReviewSchedules(
        baseline.learnerId,
        tenantId,
      );
      return {
        baseline,
        summary: baseline.summary,
        masteryMap: existingMap,
        skillMasteries: existingMasteries,
        learningPath: existingPath,
        reviewSchedules: existingReviews,
        clonedBrainProfile: await getBrainProfile(baseline.learnerId, tenantId),
      };
    }
    // Fall through if any derived artifact is missing — we'll rebuild.
  }

  const questions = await listBaselineQuestions(baselineId);
  const attempts = await listBaselineAttempts(baselineId, tenantId);
  // Subjects + skills are reference data; read them through the persistence
  // adapter so they resolve in postgres mode (the in-memory `store.subjects` /
  // `store.skills` Maps are empty there).
  const subjectIdSet = new Set(baseline.subjectIds);
  const subjects = (await listSubjects()).filter((s) => subjectIdSet.has(s.id));
  const skills = (await listSkills()).filter((sk) => subjectIdSet.has(sk.subjectId));

  const summary = buildBaselineSummary({
    questions,
    attempts,
    subjects,
    skills,
    learnerName: learner.displayName,
  });

  const skillMasteries = computeSkillMasteryFromBaseline({
    learnerId: baseline.learnerId,
    tenantId,
    questions,
    attempts,
    skills,
  });

  // Compute the mastery map snapshot (existing row carried over, otherwise a
  // fresh id) without yet writing it.
  const { map: priorMasteryMap } = await getPersistence().curriculum.getMasteryMapForLearner(
    baseline.learnerId,
    tenantId,
  );
  let masteryMap: MasteryMap | null = priorMasteryMap;
  masteryMap = masteryMap
    ? { ...masteryMap, updatedAt: nowIso() }
    : {
        id: newId("mmap"),
        learnerId: baseline.learnerId,
        tenantId,
        generatedAt: nowIso(),
        updatedAt: nowIso(),
      };

  const learningPath = generateLearningPath({
    learnerId: baseline.learnerId,
    tenantId,
    basedOnMasteryMapId: masteryMap.id,
    skillMasteries,
    skills,
    recommendedStartSkillId: summary.recommendedStartSkillId,
    gradeBand: learner.gradeBand ?? null,
  });

  const reviewSchedules = generateReviewSchedules({
    learnerId: baseline.learnerId,
    tenantId,
    skillMasteries,
  });

  // Prepare the brain-profile clone BEFORE any store mutations. This mirrors
  // brain-svc `/api/brain/clone` in production: clone success is a precondition
  // of finalizing the baseline. If validation fails (e.g. schema regression or
  // missing pre-clone profile) we bail out atomically — no skill-mastery,
  // mastery-map, learning-path, review-schedule, or status mutations land in
  // the store, so the parent can simply retry without observable partial state.
  const preparedClone = await prepareBrainCloneFromSummary(baseline.learnerId, tenantId, summary);
  if (!preparedClone) return null;

  // --- Commit (atomic from this point: validation has already passed) ---

  // All derived artifacts land through the persistence adapter so they
  // survive in postgres mode (production) — writing them to the in-memory
  // Map store would silently lose the learner's mastery/path on restart.
  const curriculum = getPersistence().curriculum;

  // Replace ALL prior mastery rows in the subjects this baseline covered (not
  // just the skills it evaluated), so a sparser re-run cannot leave stale
  // data behind from a previous, denser baseline.
  await curriculum.replaceSkillMasteriesForSubjects(
    baseline.learnerId,
    tenantId,
    baseline.subjectIds,
    skillMasteries,
  );
  await curriculum.upsertMasteryMap(masteryMap);
  await curriculum.replaceLearningPath(baseline.learnerId, tenantId, learningPath);
  await curriculum.replaceReviewSchedules(baseline.learnerId, tenantId, reviewSchedules);

  const clonedBrainProfile = await commitBrainClone(preparedClone);

  const completed: BaselineAssessment = {
    ...baseline,
    status: "complete",
    completedAt: baseline.completedAt ?? nowIso(),
    summary,
  };
  await getPersistence().assessments.upsertBaseline(completed);

  // EPIC 5 — capture per-item psychometric telemetry on finalize so the
  // recalibration job has live data to refine item difficulty. Adaptive
  // path only; idempotent (the main finalize path runs once per baseline,
  // but guard anyway so a replay never double-writes).
  let adaptiveFinalTheta: number | null = null;
  if (baselineAdaptiveEnabled()) {
    const existing = await getPersistence().assessments.listBaselineTelemetry({
      tenantId,
      learnerId: completed.learnerId,
    });
    const already = existing.some((l) => l.baselineId === completed.id);
    if (!already) {
      // Use the same calibration the runner used during the run so the
      // replayed θ trajectory (thetaBefore) matches what selection saw.
      const calibration = await getBaselineCalibrationMap({ tenantId });
      const telemetry = buildRunTelemetry({
        baseline: { id: completed.id, learnerId: completed.learnerId, tenantId },
        questions,
        attempts,
        learner,
        calibration,
      });
      if (telemetry.length > 0) {
        adaptiveFinalTheta = telemetry[telemetry.length - 1]!.thetaAfter;
        await getPersistence().assessments.appendBaselineTelemetry(telemetry);
        logger.info(
          {
            event: "baseline.telemetry_captured",
            learnerId: completed.learnerId,
            tenantId,
            baselineId: completed.id,
            items: telemetry.length,
          },
          "baseline: captured per-item adaptive telemetry on finalize",
        );
      }
    }
  }

  // Adaptive-learning E2E Sprint 3: append one trajectory point per covered
  // subject so the parent progress page can chart movement over time.
  // Resilient by contract — a snapshot failure must never fail completion.
  try {
    const enrolledBand = normalizeGradeBand(learner.gradeBand);
    const snapshotRows = buildMasterySnapshotRows({
      learnerId: baseline.learnerId,
      tenantId,
      skillMasteries,
      subjectIds: baseline.subjectIds,
      gradeBand: learner.gradeBand ?? null,
      deliveryLevel:
        adaptiveFinalTheta !== null && enrolledBand
          ? deliveryLevelFromTheta(adaptiveFinalTheta, enrolledBand)
          : null,
      trigger: "baseline",
    });
    for (const row of snapshotRows) {
      await getPersistence().curriculum.appendMasterySnapshot(row);
    }
  } catch (snapErr) {
    logger.warn(
      {
        event: "mastery_snapshot.append_failed",
        learnerId: baseline.learnerId,
        err: snapErr instanceof Error ? snapErr.message : String(snapErr),
      },
      "baseline: mastery snapshot append failed (non-fatal)",
    );
  }

  return {
    baseline: completed,
    summary,
    masteryMap,
    skillMasteries,
    learningPath,
    reviewSchedules,
    clonedBrainProfile,
  };
}

/**
 * Read the raw per-item telemetry logs for a tenant (admin / batch job).
 * Optionally narrow to a single learner.
 */
export async function listBaselineTelemetry(input: {
  tenantId: string;
  learnerId?: string;
}): Promise<BaselineItemResponseLog[]> {
  return getPersistence().assessments.listBaselineTelemetry(input);
}

/**
 * Aggregate the tenant's telemetry into per-item psychometrics +
 * recalibration suggestions (EPIC 2 loop / EPIC 5 admin view).
 */
export async function getBaselineRecalibration(input: {
  tenantId: string;
  minExposure?: number;
}): Promise<ItemPsychometrics[]> {
  const logs = await listBaselineTelemetry({ tenantId: input.tenantId });
  return aggregateItemPsychometrics(logs, { minExposure: input.minExposure });
}

/**
 * Recalibration across a set of tenants (platform-admin view). Aggregates
 * the combined telemetry so an item-key that appears under multiple
 * tenants is calibrated from all of its observations.
 */
export async function getBaselineRecalibrationForTenants(input: {
  tenantIds: string[];
  minExposure?: number;
}): Promise<ItemPsychometrics[]> {
  const perTenant = await Promise.all(
    input.tenantIds.map((tenantId) => listBaselineTelemetry({ tenantId })),
  );
  return aggregateItemPsychometrics(perTenant.flat(), { minExposure: input.minExposure });
}

/**
 * Confidence-gated calibration overrides for a tenant — item-key → refined
 * θ for items with enough live data. Consumed by `selectNextAdaptiveQuestion`
 * so the adaptive baseline serves items at their *observed* difficulty,
 * not just the seed band. Returns an empty map until items clear the
 * exposure floor, so early on selection behaves exactly as before.
 */
export async function getBaselineCalibrationMap(input: {
  tenantId: string;
  minExposure?: number;
}): Promise<CalibrationMap> {
  const logs = await listBaselineTelemetry({ tenantId: input.tenantId });
  return recalibrationMap(logs, { minExposure: input.minExposure });
}

/**
 * Persist the assessment-svc streaming session id on a baseline so the
 * runner can resume the same server-side session across renders.
 */
export async function setBaselineAdaptiveSessionId(
  baselineId: string,
  tenantId: string,
  sessionId: string,
): Promise<void> {
  const baseline = await getPersistence().assessments.getBaselineById(baselineId, tenantId);
  if (!baseline || baseline.adaptiveSessionId === sessionId) return;
  await getPersistence().assessments.upsertBaseline({ ...baseline, adaptiveSessionId: sessionId });
}

// ===== Mastery + Learning Path =====
export async function getMasteryMap(
  learnerId: string,
  tenantId: string,
): Promise<{
  map: MasteryMap | null;
  skillMasteries: SkillMastery[];
}> {
  return getPersistence().curriculum.getMasteryMapForLearner(learnerId, tenantId);
}

export async function getLearningPath(
  learnerId: string,
  tenantId: string,
): Promise<LearningPath | null> {
  return getPersistence().curriculum.getLearningPath(learnerId, tenantId);
}

/**
 * Re-generate the learning path from the current MasteryMap. Used when the
 * parent or a tutor wants a fresh path after lesson activity.
 */
export async function regenerateLearningPath(
  learnerId: string,
  tenantId: string,
): Promise<LearningPath | null> {
  const { map, skillMasteries } = await getMasteryMap(learnerId, tenantId);
  if (!map || skillMasteries.length === 0) return null;
  const skills = await listSkills();
  const learner = await getLearner(learnerId, tenantId);
  // Recommended first skill: head of the prerequisite-aware frontier
  // (Sprint 3) — NOT the raw lowest score, which can point at a skill whose
  // prerequisites the learner hasn't met yet.
  const selection = selectNextSkills({
    skills,
    skillMasteries,
    gradeBand: learner?.gradeBand ?? null,
  });
  const recommended = selection.frontier[0] ?? null;
  const next = generateLearningPath({
    learnerId,
    tenantId,
    basedOnMasteryMapId: map.id,
    skillMasteries,
    skills,
    recommendedStartSkillId: recommended,
    gradeBand: learner?.gradeBand ?? null,
  });
  return getPersistence().curriculum.replaceLearningPath(learnerId, tenantId, next);
}

export async function listMasterySnapshots(
  learnerId: string,
  tenantId: string,
  opts?: { subjectId?: string; sinceIso?: string },
): Promise<MasterySnapshot[]> {
  return getPersistence().curriculum.listMasterySnapshots(learnerId, tenantId, opts);
}

export type SubjectDetail = {
  subject: Subject;
  skills: (Skill & {
    mastery: SkillMastery | null;
  })[];
  currentLevel: string;
  nextSkillId: string | null;
  recommendedTutorPersona: string;
  pathNodesForSubject: LearningPath["nodes"];
};

export async function getSubjectDetail(
  learnerId: string,
  tenantId: string,
  subjectId: string,
): Promise<SubjectDetail | null> {
  // Subjects/skills are reference data — read through the persistence adapter
  // so subject detail (and next-skill selection) works in postgres mode.
  const subject = await getPersistence().curriculum.getSubjectById(subjectId);
  if (!subject) return null;

  const skills = await getPersistence().curriculum.listSkills(subjectId);
  const { skillMasteries } = await getMasteryMap(learnerId, tenantId);
  const masteryBySkillId = new Map(skillMasteries.map((m) => [m.skillId, m]));
  const annotated = skills.map((s) => ({
    ...s,
    mastery: masteryBySkillId.get(s.id) ?? null,
  }));

  // Current level: highest level any skill in this subject reached.
  const levelOrder: SkillMastery["level"][] = [
    "not_started",
    "emerging",
    "approaching",
    "on_grade_level",
    "stretching",
  ];
  let currentLevel: SkillMastery["level"] = "not_started";
  for (const a of annotated) {
    if (!a.mastery) continue;
    if (levelOrder.indexOf(a.mastery.level) > levelOrder.indexOf(currentLevel)) {
      currentLevel = a.mastery.level;
    }
  }

  // Next skill: head of the prerequisite-aware frontier (Sprint 3) — an
  // unlocked, unmastered skill in DAG order, never one whose prerequisites
  // are unmet. Falls back to the first skill when everything is mastered.
  const selection = selectNextSkills({ skills, skillMasteries });
  const nextSkill = selection.frontier.length
    ? (annotated.find((s) => s.id === selection.frontier[0]) ?? null)
    : (annotated[0] ?? null);

  const path = await getLearningPath(learnerId, tenantId);
  const pathNodesForSubject = path?.nodes.filter((n) => n.subjectId === subjectId) ?? [];

  const tutorByYubject: Record<string, string> = {
    reading: "Nimbus the Calm Explorer",
    math: "Zara the Number Friend",
    writing: "Penn the Story Builder",
    science: "Dr. Sprout the Curious",
    social: "Lumi the Kindness Coach",
    life: "Sage the Routine Guide",
    art: "Hue the Color Pal",
  };

  return {
    subject,
    skills: annotated,
    currentLevel,
    nextSkillId: nextSkill?.id ?? null,
    recommendedTutorPersona: tutorByYubject[subject.slug] ?? "Nimbus the Calm Explorer",
    pathNodesForSubject,
  };
}

// ===== Audit =====
// Routed through the persistence adapter (ADR 0007 step 2). The
// memory implementation writes to the existing append-only array;
// the Drizzle implementation lands once `packages/db` exports an
// audit_logs table. `recordAudit` synthesises the row synchronously
// so callers can use the returned id without awaiting the store.
export async function recordAudit(input: {
  userId: string | null;
  tenantId: string | null;
  learnerId?: string | null;
  action: string;
  metadata?: Record<string, unknown>;
  requestId: string;
}): Promise<AuditLog> {
  const log: AuditLog = {
    id: newId("aud"),
    userId: input.userId,
    tenantId: input.tenantId,
    learnerId: input.learnerId ?? null,
    action: input.action,
    metadata: input.metadata ?? {},
    requestId: input.requestId,
    occurredAt: nowIso(),
  };
  return getPersistence().audit.append(log);
}

export async function recentAuditLogs(tenantId: string, limit = 50): Promise<AuditLog[]> {
  return getPersistence().audit.recentForTenant(tenantId, limit);
}

// ===== Lesson Runs (Sprints 10–11) =====
import type {
  GeneratedLessonPlan,
  LessonAccommodationSnapshot,
  LessonContextSnapshot,
  LessonInteraction,
  LessonMasterySnapshot,
  LessonRun,
  LessonRunSource,
  LessonStepKind,
  QuestChapter,
  QuestProgress,
  QuestWorld,
  HomeworkHelpMessage,
  HomeworkHelpSession,
  CalmSessionRecord,
  TeacherAssignment,
  CurriculumUpload,
  CurriculumFocus,
} from "@/lib/db/types";
import {
  generateLessonPlanWithFallback,
  LESSON_PLAN_SCHEMA_VERSION,
  type TutorProvider,
} from "@/lib/ai/tutor";
import { getTutorProviderChain, taskForSubject } from "@/lib/ai/provider-chain";
import { getAuthoredLessonItems } from "@/lib/learner/authored-content";
import { awardLessonEngagement } from "@/lib/learner/engagement-award";

function buildAccommodationSnapshotFrom(
  state: LearnerBrainProfileState,
): LessonAccommodationSnapshot {
  const tags: string[] = [];
  if (state.supportDefaults.extendedTime) tags.push("extended_time");
  if (state.supportDefaults.readAloud) tags.push("read_aloud");
  if (state.supportDefaults.speechToText) tags.push("speech_to_text");
  if (state.supportDefaults.visualSchedules) tags.push("visual_schedules");
  if (state.supportDefaults.sensoryBreaks) tags.push("sensory_breaks");
  if (state.accessibilityPreferences.captionsAlwaysOn) tags.push("captions");
  if (state.accessibilityPreferences.largeText) tags.push("large_text");
  if (state.accessibilityPreferences.reducedMotion) tags.push("reduced_motion");
  if (state.accessibilityPreferences.highContrast) tags.push("high_contrast");
  if (state.accessibilityPreferences.audioFirst) tags.push("audio_first");
  return {
    tags,
    supportDefaults: { ...state.supportDefaults },
    accessibility: { ...state.accessibilityPreferences },
  };
}

async function buildMasterySnapshot(input: {
  learnerId: string;
  tenantId: string;
  subjectId: string;
  skillId: string;
}): Promise<LessonMasterySnapshot> {
  const { skillMasteries } = await getMasteryMap(input.learnerId, input.tenantId);
  const own = skillMasteries.find((m) => m.skillId === input.skillId);
  const subjectContext = skillMasteries
    .filter((m) => m.subjectId === input.subjectId && m.skillId !== input.skillId)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5)
    .map((m) => ({ skillId: m.skillId, score: m.score, level: m.level }));
  return {
    skillId: input.skillId,
    subjectId: input.subjectId,
    score: own?.score ?? 0,
    level: own?.level ?? "not_started",
    confidence: own?.confidence ?? 0.4,
    subjectContext,
  };
}

function buildContextSnapshot(
  learner: LearnerProfile,
  state: LearnerBrainProfileState,
): LessonContextSnapshot {
  return {
    displayName: learner.displayName,
    ageRange: learner.ageRange,
    gradeBand: learner.gradeBand,
    primaryLanguage: learner.primaryLanguage,
    preferredModalities: state.preferredModalities,
    tutorStyle: state.tutorPersonaRecommendation.style,
  };
}

export type CreateLessonRunInput = {
  learnerId: string;
  tenantId: string;
  subjectId: string;
  skillId: string;
  source: LessonRunSource;
  sourceRefId?: string | null;
};

export type CreateLessonRunResult =
  | {
      ok: true;
      lessonRun: LessonRun;
      plan: GeneratedLessonPlan;
    }
  | {
      ok: false;
      code:
        | "learner_not_found"
        | "subject_not_found"
        | "skill_not_found"
        | "brain_profile_missing"
        | "brain_not_approved"
        | "generation_failed";
      message: string;
      lessonRun?: LessonRun;
    };

/**
 * Create a LessonRun + generate its plan synchronously via the configured tutor provider.
 * In production this becomes async: the BFF returns a `generating` run and
 * a background worker calls back. The contract (LessonRun.lessonPlanId set
 * when status === "ready") is identical.
 */
export async function createLessonRun(
  input: CreateLessonRunInput,
  provider?: TutorProvider,
): Promise<CreateLessonRunResult> {
  const learner = await getLearner(input.learnerId, input.tenantId);
  if (!learner) {
    return { ok: false, code: "learner_not_found", message: "Learner not in tenant" };
  }
  // Subjects/skills are reference data — read through the persistence adapter
  // so lesson creation resolves them in postgres mode (Map store is empty there).
  const subject = await getPersistence().curriculum.getSubjectById(input.subjectId);
  if (!subject) {
    return { ok: false, code: "subject_not_found", message: "Subject not found" };
  }
  const skill = await getPersistence().curriculum.getSkillById(input.skillId);
  if (!skill || skill.subjectId !== input.subjectId) {
    return { ok: false, code: "skill_not_found", message: "Skill not in subject" };
  }
  const brain = await getBrainProfile(input.learnerId, input.tenantId);
  if (!brain) {
    return {
      ok: false,
      code: "brain_profile_missing",
      message: "Brain profile required before lesson generation",
    };
  }
  // Sprint C-01 teach gate: nothing teaches from the brain before parent
  // approval. The check lives HERE — not in routing — so every caller
  // (today/start, quests, teacher assignments, creator pre-generation, any
  // future path) inherits it instead of re-implementing it.
  if (brain.cloneStage !== "approved") {
    return {
      ok: false,
      code: "brain_not_approved",
      message: "Brain profile awaiting parent approval before lesson generation",
    };
  }

  const masterySnapshot = await buildMasterySnapshot({
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    subjectId: input.subjectId,
    skillId: input.skillId,
  });
  // Phase 1: sync the lesson to what the learner is doing in school this week,
  // if a parent/teacher uploaded a curriculum for this subject. Best-effort —
  // generation proceeds normally when there's no active focus.
  const curriculumFocus = await getActiveCurriculumFocus(
    input.learnerId,
    input.tenantId,
    subject.slug,
  );
  const accommodationSnapshot = buildAccommodationSnapshotFrom(brain.state);
  const contextSnapshot = buildContextSnapshot(learner, brain.state);
  const tutorPersona =
    (
      {
        reading: "Nimbus the Calm Explorer",
        math: "Zara the Number Friend",
        writing: "Penn the Story Builder",
        science: "Dr. Sprout the Curious",
        social: "Lumi the Kindness Coach",
        life: "Sage the Routine Guide",
        art: "Hue the Color Pal",
      } as Record<string, string>
    )[subject.slug] ?? "Nimbus the Calm Explorer";

  // Remediation Sprint 05: resolve REAL authored pack content for this
  // (subject, skill grade band). When present it becomes the lesson's
  // practice items (and the AI provider's source material); the domain
  // templates remain the fallback.
  const authoredItems = getAuthoredLessonItems({
    subjectSlug: subject.slug,
    gradeBand: skill.gradeBand,
  });

  const now = nowIso();
  const run: LessonRun = {
    id: newId("lr"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    subjectId: input.subjectId,
    skillId: input.skillId,
    source: input.source,
    sourceRefId: input.sourceRefId ?? null,
    tutorPersona,
    learnerContextSnapshot: contextSnapshot,
    masterySnapshot,
    accommodationSnapshot,
    brainStateSnapshot: brain.state,
    lessonPlanId: null,
    status: "generating",
    retryCount: 0,
    failureReason: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await getPersistence().lessonRuns.upsertRun(run);

  try {
    const { plan, telemetry } = await generateLessonPlanWithFallback(
      provider ? [provider] : getTutorProviderChain(taskForSubject(subject)),
      {
        learnerName: learner.displayName,
        brainState: brain.state,
        subject,
        skill,
        // S26: pass curriculum constraints (active version + objective template)
        // so the generator scopes the plan to the canonical scope of the skill.
        skillVersion: await getCurrentSkillVersion(skill.id),
        objectiveTemplate: await getActiveLessonObjectiveTemplate(skill.id),
        mastery: masterySnapshot,
        accommodations: accommodationSnapshot,
        curriculumFocus,
        authoredItems,
        source: input.source,
      },
    );

    const planRecord: GeneratedLessonPlan = {
      id: newId("plan"),
      lessonRunId: run.id,
      tenantId: input.tenantId,
      ...plan,
      guidedPractice: plan.guidedPractice.map((g) => ({ ...g, id: newId("gp") })),
      checksForUnderstanding: plan.checksForUnderstanding.map((c) => ({
        ...c,
        id: newId("chk"),
      })),
      generatedAt: nowIso(),
      generation: {
        ...telemetry,
        contentSource:
          authoredItems.length > 0 ? ("authored_pack" as const) : ("template" as const),
      },
    };
    await getPersistence().lessonRuns.upsertPlan(planRecord);

    const ready: LessonRun = {
      ...run,
      status: "ready",
      lessonPlanId: planRecord.id,
      updatedAt: nowIso(),
    };
    await getPersistence().lessonRuns.upsertRun(ready);
    return { ok: true, lessonRun: ready, plan: planRecord };
  } catch (e) {
    const failed: LessonRun = {
      ...run,
      status: "failed",
      failureReason: e instanceof Error ? e.message : String(e),
      updatedAt: nowIso(),
    };
    await getPersistence().lessonRuns.upsertRun(failed);
    return {
      ok: false,
      code: "generation_failed",
      message: failed.failureReason ?? "Generation failed",
      lessonRun: failed,
    };
  }
}

export async function getLessonRun(
  lessonRunId: string,
  tenantId: string,
): Promise<{ lessonRun: LessonRun; plan: GeneratedLessonPlan | null } | null> {
  const store = getPersistence().lessonRuns;
  const run = await store.getRunById(lessonRunId, tenantId);
  if (!run) return null;
  const plan = run.lessonPlanId ? await store.getPlanById(run.lessonPlanId, tenantId) : null;
  return { lessonRun: run, plan };
}

export async function listLessonRunsForLearner(
  learnerId: string,
  tenantId: string,
  opts?: { limit?: number; status?: LessonRun["status"] },
): Promise<LessonRun[]> {
  return getPersistence().lessonRuns.listForLearner(learnerId, tenantId, opts);
}

export async function startLessonRun(
  lessonRunId: string,
  tenantId: string,
): Promise<LessonRun | null> {
  const store = getPersistence().lessonRuns;
  const run = await store.getRunById(lessonRunId, tenantId);
  if (!run) return null;
  if (run.status === "completed" || run.status === "abandoned") return run;
  // Idempotent: only set startedAt the first time.
  const next: LessonRun = {
    ...run,
    status: "in_progress",
    startedAt: run.startedAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  await store.upsertRun(next);
  // Promote learner readiness once they're actively learning.
  await refreshLearnerReadiness(run.learnerId, tenantId);
  return next;
}

export async function recordLessonStep(input: {
  lessonRunId: string;
  tenantId: string;
  learnerId: string;
  stepKind: LessonStepKind;
  stepRefId?: string | null;
  response?: string | null;
  isCorrect?: boolean | null;
  skipped?: boolean;
}): Promise<LessonInteraction | null> {
  const store = getPersistence().lessonRuns;
  const run = await store.getRunById(input.lessonRunId, input.tenantId);
  if (!run) return null;
  if (run.learnerId !== input.learnerId) return null;
  const interaction: LessonInteraction = {
    id: newId("li"),
    lessonRunId: run.id,
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    stepKind: input.stepKind,
    stepRefId: input.stepRefId ?? null,
    response: input.response ?? null,
    isCorrect: input.isCorrect ?? null,
    skipped: input.skipped ?? false,
    occurredAt: nowIso(),
  };
  await store.appendInteraction(interaction);
  // Keep run in_progress on first interaction.
  if (run.status === "ready") {
    await store.upsertRun({
      ...run,
      status: "in_progress",
      startedAt: run.startedAt ?? nowIso(),
      updatedAt: nowIso(),
    });
  } else {
    await store.upsertRun({ ...run, updatedAt: nowIso() });
  }
  return interaction;
}

export async function listLessonInteractions(
  lessonRunId: string,
  tenantId: string,
): Promise<LessonInteraction[]> {
  return getPersistence().lessonRuns.listInteractions(lessonRunId, tenantId);
}

/**
 * Sprint 14 (post-review fix): derive an authoritative `LessonOutcome` from
 * server-recorded `LessonInteraction` rows. The completion BFF uses this so
 * mastery + parent summaries cannot be poisoned by a client supplying
 * fabricated check counts. `abandoned` is the only outcome field accepted
 * from the client (it's a UX signal not represented in interactions).
 *
 * Rules:
 * - `checksTotal/Correct`: one count per unique `stepRefId` on
 *   `answer_submitted` interactions tagged to a check item. Latest answer per
 *   check wins (so a learner can retry without inflating the total).
 * - `hintsUsed`: number of `hint_used` interactions across the run.
 * - `scaffoldsUsed`: number of `scaffold_used` interactions across the run.
 * - `secondsActive`: wall-clock between the first and last interaction
 *   (clamped to >= 0), falling back to (completedAt - startedAt) when no
 *   interactions exist.
 */
export function deriveOutcomeFromInteractions(run: LessonRun, abandoned: boolean): LessonOutcome {
  const store = db();
  const interactions = store.lessonInteractions
    .filter((i) => i.lessonRunId === run.id && i.tenantId === run.tenantId)
    .sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));

  // Build the set of check-step refIds the player rendered, so we count
  // checks_for_understanding rather than guided-practice attempts.
  const checkRefIds = new Set<string>();
  for (const i of interactions) {
    if (i.stepKind === "check_for_understanding" && i.stepRefId) {
      checkRefIds.add(i.stepRefId);
    }
  }
  // Latest answer per check ref wins.
  const latestAnswerByCheck = new Map<string, boolean>();
  for (const i of interactions) {
    if (
      i.stepKind === "answer_submitted" &&
      i.stepRefId &&
      checkRefIds.has(i.stepRefId) &&
      i.isCorrect !== null
    ) {
      latestAnswerByCheck.set(i.stepRefId, Boolean(i.isCorrect));
    }
  }
  const checksTotal = latestAnswerByCheck.size;
  let checksCorrect = 0;
  for (const correct of latestAnswerByCheck.values()) {
    if (correct) checksCorrect += 1;
  }

  const hintsUsed = interactions.filter((i) => i.stepKind === "hint_used").length;
  const scaffoldsUsed = interactions.filter((i) => i.stepKind === "scaffold_used").length;

  let secondsActive = 0;
  if (interactions.length >= 2) {
    const first = new Date(interactions[0].occurredAt).getTime();
    const last = new Date(interactions[interactions.length - 1].occurredAt).getTime();
    secondsActive = Math.max(0, Math.round((last - first) / 1000));
  } else if (run.startedAt) {
    const start = new Date(run.startedAt).getTime();
    const end = new Date(run.completedAt ?? nowIso()).getTime();
    secondsActive = Math.max(0, Math.round((end - start) / 1000));
  }
  // Defensive clamp matching the validator's bounds.
  secondsActive = Math.min(secondsActive, 60 * 60 * 4);

  return {
    checksTotal: Math.min(checksTotal, 50),
    checksCorrect: Math.min(checksCorrect, checksTotal, 50),
    hintsUsed: Math.min(hintsUsed, 100),
    scaffoldsUsed: Math.min(scaffoldsUsed, 100),
    secondsActive,
    abandoned,
  };
}

/**
 * Apply a LessonOutcome to the learner's SkillMastery for the run's skill.
 * Score moves toward 1.0 on correctness and back toward 0.5 on poor performance,
 * with a small penalty per hint/scaffold so we don't over-credit scaffolded work.
 * Returns the before/after mastery snapshot for the parent summary.
 */
type MasteryDelta = {
  before: number;
  after: number;
  levelBefore: SkillMasteryLevel;
  levelAfter: SkillMasteryLevel;
  confidenceAfter: number;
};

async function applyOutcomeToMastery(run: LessonRun, outcome: LessonOutcome): Promise<MasteryDelta> {
  // Read + write through the persistence adapter: in postgres mode
  // (production) the in-memory Map store is empty, so direct store access
  // here would both miss the baseline-derived row AND lose the update.
  const curriculum = getPersistence().curriculum;
  const { map, skillMasteries } = await curriculum.getMasteryMapForLearner(
    run.learnerId,
    run.tenantId,
  );
  const existing =
    skillMasteries.find(
      (m) =>
        m.learnerId === run.learnerId && m.tenantId === run.tenantId && m.skillId === run.skillId,
    ) ?? null;
  const beforeScore = existing?.score ?? run.masterySnapshot.score;
  const beforeLevel: SkillMasteryLevel = existing?.level ?? run.masterySnapshot.level;

  // Canonical EWMA — shared with learning-svc via @aivo/scoring (Sprint 7).
  const accuracy = outcome.checksTotal > 0 ? outcome.checksCorrect / outcome.checksTotal : 0.5;
  const target = masteryTargetFromOutcome(outcome, beforeScore);
  const afterScore = moveMasteryScore(beforeScore, target);
  const afterLevel = levelFromScore(afterScore);
  const now = nowIso();

  const confidenceAfter = existing ? Math.min(1, existing.confidence + 0.05) : 0.6;
  await curriculum.upsertSkillMastery({
    learnerId: run.learnerId,
    tenantId: run.tenantId,
    skillId: run.skillId,
    subjectId: existing?.subjectId ?? run.subjectId,
    score: afterScore,
    level: afterLevel,
    confidence: confidenceAfter,
    needsReview: outcome.abandoned || accuracy < 0.5,
    lastEvaluatedAt: now,
  });
  // Bump the MasteryMap.updatedAt so the parent dashboard reflects freshness.
  if (map) {
    await curriculum.upsertMasteryMap({ ...map, updatedAt: now });
  }
  return {
    before: beforeScore,
    after: afterScore,
    levelBefore: beforeLevel,
    levelAfter: afterLevel,
    confidenceAfter,
  };
}

async function buildParentLessonSummary(
  run: LessonRun,
  outcome: LessonOutcome,
  delta: MasteryDelta,
): Promise<ParentLessonSummary> {
  // Reference data + learner read through the persistence adapter so the
  // summary keeps real names in postgres mode (the Map store is empty there;
  // the old direct reads silently degraded to "this subject"/"Your child").
  const curriculum = getPersistence().curriculum;
  const subject = await curriculum.getSubjectById(run.subjectId);
  const skill = await curriculum.getSkillById(run.skillId);
  const learner = await getLearner(run.learnerId, run.tenantId);
  const subjectName = subject?.name ?? "this subject";
  const skillName = skill?.name ?? "this skill";
  const name = learner?.preferredName || learner?.firstName || "Your child";
  const accuracy = outcome.checksTotal > 0 ? outcome.checksCorrect / outcome.checksTotal : null;

  const headline = outcome.abandoned
    ? `${name} stepped away from ${skillName} in ${subjectName} — we'll bring it back soon.`
    : accuracy === null
      ? `${name} explored ${skillName} in ${subjectName} today.`
      : accuracy >= 0.8
        ? `${name} did great with ${skillName} in ${subjectName}.`
        : accuracy >= 0.5
          ? `${name} practiced ${skillName} in ${subjectName} with a little help.`
          : `${name} worked hard on ${skillName} in ${subjectName} — we'll come back to it.`;

  const wentWell =
    accuracy !== null && accuracy >= 0.7
      ? `Strong answers on ${outcome.checksCorrect} of ${outcome.checksTotal} checks.`
      : outcome.hintsUsed === 0 && outcome.scaffoldsUsed === 0
        ? `${name} worked independently through every step.`
        : `${name} stayed engaged and finished the lesson.`;

  const neededHelp =
    outcome.hintsUsed + outcome.scaffoldsUsed > 0
      ? `Used ${outcome.hintsUsed} hint${outcome.hintsUsed === 1 ? "" : "s"}` +
        (outcome.scaffoldsUsed > 0
          ? ` and ${outcome.scaffoldsUsed} scaffold${outcome.scaffoldsUsed === 1 ? "" : "s"}`
          : "") +
        "."
      : accuracy !== null && accuracy < 0.5
        ? `Some checks were tricky — a short review tomorrow may help.`
        : null;

  const supportsUsed: string[] = [];
  if (run.accommodationSnapshot.supportDefaults.extendedTime) supportsUsed.push("extended time");
  if (run.accommodationSnapshot.supportDefaults.readAloud) supportsUsed.push("read-aloud");
  if (run.accommodationSnapshot.supportDefaults.visualSchedules)
    supportsUsed.push("visual schedule");
  if (run.accommodationSnapshot.supportDefaults.sensoryBreaks)
    supportsUsed.push("sensory break option");

  const recommendedNext =
    delta.after >= 0.8
      ? `Try a short stretch on ${skillName} next.`
      : delta.after >= 0.5
        ? `One more practice on ${skillName} will lock it in.`
        : `Plan a short ${skillName} review in the next day or two.`;

  return {
    id: newId("pls"),
    lessonRunId: run.id,
    learnerId: run.learnerId,
    tenantId: run.tenantId,
    subjectId: run.subjectId,
    skillId: run.skillId,
    headline,
    highlights: {
      whatWorkedOn: `${skillName} in ${subjectName}`,
      wentWell,
      neededHelp,
      supportsUsed,
      recommendedNext,
    },
    masteryDelta: delta,
    createdAt: nowIso(),
  };
}

export async function completeLessonRun(
  lessonRunId: string,
  tenantId: string,
  outcome?: LessonOutcome,
): Promise<LessonRun | null> {
  const runStore = getPersistence().lessonRuns;
  const run = await runStore.getRunById(lessonRunId, tenantId);
  if (!run) return null;
  // Idempotent: a second call returns the existing completed run without
  // re-applying mastery or re-emitting a parent summary.
  if (run.status === "completed") return run;
  const effectiveOutcome: LessonOutcome = outcome ?? {
    checksTotal: 0,
    checksCorrect: 0,
    hintsUsed: 0,
    scaffoldsUsed: 0,
    secondsActive: 0,
    abandoned: false,
  };
  const next: LessonRun = {
    ...run,
    status: "completed",
    completedAt: run.completedAt ?? nowIso(),
    startedAt: run.startedAt ?? nowIso(),
    updatedAt: nowIso(),
  };
  await runStore.upsertRun(next);
  const delta = await applyOutcomeToMastery(next, effectiveOutcome);
  // Remediation Sprint 12: completion AWARDS engagement (XP/streak) — the
  // early already-completed return above makes this exactly-once per run.
  // Resilient: an engagement write failure never fails the completion.
  try {
    await awardLessonEngagement({
      learnerId: next.learnerId,
      tenantId: next.tenantId,
      outcome: effectiveOutcome,
      completedAt: next.completedAt ?? nowIso(),
    });
  } catch (engagementErr) {
    logger.warn(
      {
        event: "engagement_award.failed",
        learnerId: next.learnerId,
        err: engagementErr instanceof Error ? engagementErr.message : String(engagementErr),
      },
      "lesson completed but engagement award failed",
    );
  }
  // Sprint 3: a level change re-plans the learning path and records a
  // trajectory point. Resilient — failures log and never fail completion.
  if (delta.levelAfter !== delta.levelBefore) {
    try {
      await regenerateLearningPath(next.learnerId, tenantId);
      const { skillMasteries: refreshed } = await getMasteryMap(next.learnerId, tenantId);
      const learnerRow = await getLearner(next.learnerId, tenantId);
      const snapshotRows = buildMasterySnapshotRows({
        learnerId: next.learnerId,
        tenantId,
        skillMasteries: refreshed,
        subjectIds: [next.subjectId],
        gradeBand: learnerRow?.gradeBand ?? null,
        deliveryLevel: null,
        trigger: "lesson",
      });
      for (const row of snapshotRows) {
        await getPersistence().curriculum.appendMasterySnapshot(row);
      }
    } catch (snapErr) {
      logger.warn(
        {
          event: "mastery_snapshot.append_failed",
          learnerId: next.learnerId,
          err: snapErr instanceof Error ? snapErr.message : String(snapErr),
        },
        "lesson: path regen / mastery snapshot failed (non-fatal)",
      );
    }
  }
  // Sprint 4: feed the recommendation loop (upward delivery-level +
  // rebaseline rules) with this skill's mastery movement. Fire-and-forget.
  {
    const { map, skillMasteries: currentMasteries } = await getMasteryMap(
      next.learnerId,
      tenantId,
    );
    const learnerRow = await getLearner(next.learnerId, tenantId);
    // Current-state peers (>= 0.65 in this subject, excluding the moved
    // skill) ride along as snapshot evidence so the upward rule can see
    // sustained mastery from single-skill lessons.
    const subjectPeers = currentMasteries
      .filter(
        (m) => m.subjectId === next.subjectId && m.skillId !== next.skillId && m.score >= 0.65,
      )
      .map((m) => ({
        skillId: m.skillId,
        subjectId: m.subjectId,
        score: m.score,
        level: m.level,
        confidence: m.confidence,
      }));
    // Wave C (G1): tag the movement with the canonical subject key so the
    // recommendation loop scopes upward candidates + applies per subject.
    const movementSubject = await getPersistence().curriculum.getSubjectById(next.subjectId);
    const movementSubjectKey =
      canonicalSubjectKey(movementSubject?.slug ?? null) ?? undefined;
    void emitLessonMasterySignal({
      tenantId,
      learnerId: next.learnerId,
      movement: {
        skillId: next.skillId,
        subjectId: next.subjectId,
        subjectKey: movementSubjectKey,
        before: delta.before,
        after: delta.after,
        levelBefore: delta.levelBefore,
        levelAfter: delta.levelAfter,
        confidence: delta.confidenceAfter,
      },
      subjectPeers,
      currentProfile: {
        gradeBand: learnerRow?.gradeBand ?? undefined,
        baselineCompletedAt: map?.generatedAt ?? undefined,
      },
    }).catch(() => {});
  }
  const summary = await buildParentLessonSummary(next, effectiveOutcome, delta);
  await runStore.upsertParentSummary(summary);
  await refreshLearnerReadiness(run.learnerId, tenantId);
  // Sprint 16: bump QuestProgress when the run was launched from a quest
  // chapter. Progress is binary per chapter today — we just record the
  // completed chapter so prerequisite gating works for boss unlock.
  if (next.source === "quest" && next.sourceRefId) {
    await upsertQuestProgressFromCompletion(next);
  }
  return next;
}

// ===== Quest worlds + progress (ADR 0007 step 10) =====

export async function listQuestWorlds(): Promise<QuestWorld[]> {
  return getPersistence().quests.listWorlds();
}

export async function getQuestWorld(worldId: string): Promise<QuestWorld | null> {
  return getPersistence().quests.getWorldById(worldId);
}

export async function listQuestChapters(worldId: string): Promise<QuestChapter[]> {
  return getPersistence().quests.listChaptersForWorld(worldId);
}

export async function listQuestProgressForLearner(
  learnerId: string,
  tenantId: string,
  worldId?: string,
): Promise<QuestProgress[]> {
  return getPersistence().quests.listProgressForLearner(learnerId, tenantId, worldId);
}

export async function getQuestProgress(
  learnerId: string,
  tenantId: string,
  chapterId: string,
): Promise<QuestProgress | null> {
  return getPersistence().quests.getProgressForChapter(learnerId, tenantId, chapterId);
}

/**
 * Chapter is unlocked when every prerequisite chapter has progress === 1.
 * Non-boss chapters with empty `prerequisiteChapterIds` are always unlocked.
 */
export async function isQuestChapterUnlocked(
  learnerId: string,
  tenantId: string,
  chapter: QuestChapter,
): Promise<boolean> {
  if (chapter.prerequisiteChapterIds.length === 0) return true;
  const progress = await listQuestProgressForLearner(learnerId, tenantId);
  const completedChapterIds = new Set(
    progress.filter((p) => p.progress >= 1).map((p) => p.chapterId),
  );
  return chapter.prerequisiteChapterIds.every((id) => completedChapterIds.has(id));
}

/**
 * Start (or resume) a quest chapter. Creates a real LessonRun bound to
 * `chapter.skillIds[0]` so quest progress is only ever advanced by a
 * completed personalized lesson — no fake "Complete Activity" button exists.
 */
export async function startQuestChapter(input: {
  learnerId: string;
  tenantId: string;
  worldId: string;
  chapterId: string;
}): Promise<
  | { ok: true; lessonRunId: string }
  | {
      ok: false;
      code: "chapter_not_found" | "locked" | "brain_not_approved" | "lesson_failed";
      message: string;
    }
> {
  const store = db();
  const chapter = await getPersistence().quests.getChapterById(input.chapterId);
  if (!chapter || chapter.questWorldId !== input.worldId) {
    return { ok: false, code: "chapter_not_found", message: "Quest chapter not found" };
  }
  if (!(await isQuestChapterUnlocked(input.learnerId, input.tenantId, chapter))) {
    return {
      ok: false,
      code: "locked",
      message: "Finish the earlier chapters to unlock this one",
    };
  }
  // Resume an existing in-progress quest run for this chapter (idempotent).
  for (const run of store.lessonRuns.values()) {
    if (
      run.tenantId === input.tenantId &&
      run.learnerId === input.learnerId &&
      run.source === "quest" &&
      run.sourceRefId === chapter.id &&
      (run.status === "ready" || run.status === "in_progress" || run.status === "generating")
    ) {
      return { ok: true, lessonRunId: run.id };
    }
  }
  const skillId = chapter.skillIds[0];
  if (!skillId) {
    return {
      ok: false,
      code: "chapter_not_found",
      message: "Quest chapter has no skill mapping",
    };
  }
  const result = await createLessonRun({
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    subjectId: chapter.subjectId,
    skillId,
    source: "quest",
    sourceRefId: chapter.id,
  });
  if (!result.ok) {
    // Surface the teach gate distinctly so quest callers can render the
    // calm waiting state instead of a generic failure.
    return {
      ok: false,
      code: result.code === "brain_not_approved" ? "brain_not_approved" : "lesson_failed",
      message: result.message ?? "Could not start quest lesson",
    };
  }
  return { ok: true, lessonRunId: result.lessonRun.id };
}

async function upsertQuestProgressFromCompletion(run: LessonRun): Promise<void> {
  if (!run.sourceRefId) return;
  const quests = getPersistence().quests;
  const chapter = await quests.getChapterById(run.sourceRefId);
  if (!chapter) return;
  const existing = await quests.getProgressForChapter(run.learnerId, run.tenantId, chapter.id);
  if (existing) {
    await quests.upsertProgress({
      ...existing,
      progress: 1,
      updatedAt: nowIso(),
    });
    return;
  }
  await quests.upsertProgress({
    id: newId("qp"),
    learnerId: run.learnerId,
    tenantId: run.tenantId,
    questWorldId: chapter.questWorldId,
    chapterId: chapter.id,
    progress: 1,
    updatedAt: nowIso(),
  });
}

export function listParentLessonSummaries(
  learnerId: string,
  tenantId: string,
  opts?: { limit?: number },
): ParentLessonSummary[] {
  const store = db();
  const all = Array.from(store.parentLessonSummaries.values())
    .filter((s) => s.learnerId === learnerId && s.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return opts?.limit ? all.slice(0, opts.limit) : all;
}

export async function getParentLessonSummaryForRun(
  lessonRunId: string,
  tenantId: string,
): Promise<ParentLessonSummary | null> {
  return getPersistence().lessonRuns.getParentSummaryForRun(lessonRunId, tenantId);
}

/**
 * Wave E (S11): attach the agent tutor's quality-gated note to a run's
 * parent summary. No-op when the run has no summary yet (the note is an
 * enrichment of the deterministic summary, never a replacement for it).
 */
export async function attachTutorNoteToParentSummary(
  lessonRunId: string,
  tenantId: string,
  note: string,
): Promise<boolean> {
  const summary = await getPersistence().lessonRuns.getParentSummaryForRun(
    lessonRunId,
    tenantId,
  );
  if (!summary) return false;
  await getPersistence().lessonRuns.upsertParentSummary({
    ...summary,
    tutorNote: note.slice(0, 700),
  });
  return true;
}

/**
 * Retry a failed LessonRun: regenerate the plan with the same snapshots
 * (so accommodations and mastery context remain stable across attempts).
 * Caps at LESSON_PLAN_MAX_ATTEMPTS network attempts via the AI adapter,
 * but the LessonRun.retryCount is unbounded so the player can show a
 * "try again" affordance as many times as the user needs.
 */
export async function retryLessonRun(
  lessonRunId: string,
  tenantId: string,
  provider?: TutorProvider,
): Promise<{
  ok: boolean;
  code?: "not_retryable" | "generation_failed";
  lessonRun: LessonRun;
  plan: GeneratedLessonPlan | null;
}> {
  const store = db();
  const runStore = getPersistence().lessonRuns;
  const run = await runStore.getRunById(lessonRunId, tenantId);
  if (!run) {
    throw new Error("LessonRun not found");
  }
  if (run.status !== "failed" && run.status !== "generating") {
    // Not retryable from this state — surface a precondition error to caller.
    const plan = run.lessonPlanId ? await runStore.getPlanById(run.lessonPlanId, tenantId) : null;
    return { ok: false, code: "not_retryable", lessonRun: run, plan };
  }
  const subject = store.subjects.get(run.subjectId);
  if (!subject) throw new Error("subject missing");
  const skill = store.skills.get(run.skillId);
  if (!skill) throw new Error("skill missing");

  try {
    const retryAuthoredItems = getAuthoredLessonItems({
      subjectSlug: subject.slug,
      gradeBand: skill.gradeBand,
    });
    const { plan, telemetry } = await generateLessonPlanWithFallback(
      provider ? [provider] : getTutorProviderChain(taskForSubject(subject)),
      {
        learnerName: run.learnerContextSnapshot.displayName,
        // Use the frozen snapshot, NOT a fresh brain-profile read, so retry
        // produces a plan consistent with the original run's context.
        brainState: run.brainStateSnapshot,
        subject,
        skill,
        // S26: keep retries scoped to the same curriculum constraints the
        // initial generation read. Retry reads the *current* version, not the
        // snapshot — a republished v2 should pull the retry forward.
        skillVersion: await getCurrentSkillVersion(skill.id),
        objectiveTemplate: await getActiveLessonObjectiveTemplate(skill.id),
        mastery: run.masterySnapshot,
        accommodations: run.accommodationSnapshot,
        authoredItems: retryAuthoredItems,
        source: run.source,
      },
    );
    const planRecord: GeneratedLessonPlan = {
      id: newId("plan"),
      lessonRunId: run.id,
      tenantId,
      ...plan,
      guidedPractice: plan.guidedPractice.map((g) => ({ ...g, id: newId("gp") })),
      checksForUnderstanding: plan.checksForUnderstanding.map((c) => ({
        ...c,
        id: newId("chk"),
      })),
      generatedAt: nowIso(),
      generation: {
        ...telemetry,
        schemaVersion: LESSON_PLAN_SCHEMA_VERSION,
        contentSource:
          retryAuthoredItems.length > 0 ? ("authored_pack" as const) : ("template" as const),
      },
    };
    await runStore.upsertPlan(planRecord);
    const ready: LessonRun = {
      ...run,
      status: "ready",
      lessonPlanId: planRecord.id,
      retryCount: run.retryCount + 1,
      failureReason: null,
      updatedAt: nowIso(),
    };
    await runStore.upsertRun(ready);
    return { ok: true, lessonRun: ready, plan: planRecord };
  } catch (e) {
    const failed: LessonRun = {
      ...run,
      status: "failed",
      retryCount: run.retryCount + 1,
      failureReason: e instanceof Error ? e.message : String(e),
      updatedAt: nowIso(),
    };
    await runStore.upsertRun(failed);
    return { ok: false, lessonRun: failed, plan: null };
  }
}

// ===== Sprint 15: Accessibility preferences =====
//
// Routed through the persistence adapter (ADR 0007). Preferences live on the
// learner document, so they persist durably (Postgres jsonb in production,
// in-memory in dev/test) and are shared across every device a learner signs in
// from — replacing the previous per-process in-memory Map.

/** Returns the stored preferences or a defaults object when none persisted. */
export async function getAccessibilityPrefs(
  learnerId: ID,
  tenantId: ID,
): Promise<AccessibilityPreferences> {
  const stored = await getPersistence().learners.getAccessibility(learnerId, tenantId);
  if (stored) return stored;
  return {
    learnerId,
    tenantId,
    ...ACCESSIBILITY_DEFAULTS,
    updatedAt: nowIso(),
  };
}

/**
 * Partial update — fields not present in `patch` are preserved. Returns the
 * persisted record. Creates the record on first write.
 */
export async function updateAccessibilityPrefs(
  learnerId: ID,
  tenantId: ID,
  patch: Partial<Omit<AccessibilityPreferences, "learnerId" | "tenantId" | "updatedAt">>,
): Promise<AccessibilityPreferences> {
  const current = await getAccessibilityPrefs(learnerId, tenantId);
  const next: AccessibilityPreferences = {
    ...current,
    ...patch,
    learnerId,
    tenantId,
    updatedAt: nowIso(),
  };
  await getPersistence().learners.setAccessibility(learnerId, tenantId, next);
  return next;
}

/** Restore defaults, clearing any stored row. Returns the defaults record. */
export async function resetAccessibilityPrefs(
  learnerId: ID,
  tenantId: ID,
): Promise<AccessibilityPreferences> {
  await getPersistence().learners.setAccessibility(learnerId, tenantId, null);
  return getAccessibilityPrefs(learnerId, tenantId);
}

// ===== Sprint 17: Homework Helper =====

export async function createHomeworkSession(input: {
  learnerId: string;
  tenantId: string;
  topic: string;
  subjectId: string | null;
  attachment?: HomeworkHelpSession["attachment"];
}): Promise<HomeworkHelpSession> {
  const session: HomeworkHelpSession = {
    id: newId("hw"),
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    topic: input.topic,
    subjectId: input.subjectId,
    attachment: input.attachment ?? null,
    messages: [],
    insight: null,
    followUpRunId: null,
    startedAt: nowIso(),
    endedAt: null,
  };
  return await getPersistence().engagement.upsertHomeworkSession(session);
}

export async function getHomeworkSession(
  sessionId: string,
  tenantId: string,
): Promise<HomeworkHelpSession | null> {
  const s = await getPersistence().engagement.getHomeworkSession(sessionId);
  if (!s || s.tenantId !== tenantId) return null;
  return s;
}

export async function listHomeworkSessionsForLearner(
  learnerId: string,
  tenantId: string,
  opts?: { limit?: number },
): Promise<HomeworkHelpSession[]> {
  const all = (await getPersistence().engagement.listHomeworkSessions())
    .filter((s) => s.learnerId === learnerId && s.tenantId === tenantId)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return opts?.limit ? all.slice(0, opts.limit) : all;
}

export async function appendHomeworkMessage(
  sessionId: string,
  tenantId: string,
  message: Omit<HomeworkHelpMessage, "id" | "occurredAt">,
): Promise<HomeworkHelpSession | null> {
  const engagement = getPersistence().engagement;
  const existing = await engagement.getHomeworkSession(sessionId);
  if (!existing || existing.tenantId !== tenantId) return null;
  if (existing.endedAt) return existing; // completed sessions are append-only no-ops
  const next: HomeworkHelpSession = {
    ...existing,
    messages: [
      ...existing.messages,
      {
        id: newId("hwm"),
        occurredAt: nowIso(),
        ...message,
      },
    ],
  };
  return await engagement.upsertHomeworkSession(next);
}

export async function completeHomeworkSession(
  sessionId: string,
  tenantId: string,
  insight: string,
  followUpRunId: string | null = null,
): Promise<HomeworkHelpSession | null> {
  const engagement = getPersistence().engagement;
  const existing = await engagement.getHomeworkSession(sessionId);
  if (!existing || existing.tenantId !== tenantId) return null;
  if (existing.endedAt) return existing; // idempotent
  const next: HomeworkHelpSession = {
    ...existing,
    insight,
    followUpRunId,
    endedAt: nowIso(),
  };
  return await engagement.upsertHomeworkSession(next);
}

// ===== Calm Corner =====
// Map-backed, process-local persistence mirroring the Homework Helper
// convention (createHomeworkSession et al.). A `postgres` adapter is a
// future follow-up; these records hold counts only — never free-text or
// PII — and are tenant- and learner-scoped on every read/write.

const CALM_DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight (ms) for an ISO timestamp — the basis for calendar-day keys. */
function calmUtcMidnight(iso: string): number {
  const d = new Date(iso);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** Stable YYYY-MM-DD key for a UTC-midnight millisecond value. */
function calmDayKey(midnightMs: number): string {
  return new Date(midnightMs).toISOString().slice(0, 10);
}

export async function recordCalmSession(input: {
  tenantId: string;
  learnerId: string;
  activityId: string;
  activityKind: string;
  completed: boolean;
  secondsSpent: number | null;
}): Promise<CalmSessionRecord> {
  const record: CalmSessionRecord = {
    id: newId("calm"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    activityId: input.activityId,
    activityKind: input.activityKind,
    completed: input.completed,
    secondsSpent: input.secondsSpent,
    occurredAt: nowIso(),
  };
  return await getPersistence().engagement.appendCalmSession(record);
}

/** Most-recent-first, tenant- and learner-scoped. */
export async function listCalmSessionsForLearner(
  learnerId: string,
  tenantId: string,
  opts?: { limit?: number; sinceIso?: string },
): Promise<CalmSessionRecord[]> {
  const since = opts?.sinceIso;
  const all = (await getPersistence().engagement.listCalmSessions())
    .filter(
      (s) =>
        s.learnerId === learnerId &&
        s.tenantId === tenantId &&
        (since ? s.occurredAt >= since : true),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  return opts?.limit ? all.slice(0, opts.limit) : all;
}

/**
 * Count consecutive UTC calendar days — ending today or yesterday — that
 * each contain at least one *completed* calm session. Learner-local time
 * is out of scope; `todayIso` is injectable for deterministic tests.
 */
export async function getCalmStreak(
  learnerId: string,
  tenantId: string,
  opts?: { todayIso?: string },
): Promise<{ currentStreakDays: number; lastSessionAt: string | null }> {
  const completed = (await listCalmSessionsForLearner(learnerId, tenantId)).filter(
    (s) => s.completed,
  );
  const lastSessionAt = completed.length > 0 ? completed[0].occurredAt : null;
  if (completed.length === 0) {
    return { currentStreakDays: 0, lastSessionAt };
  }

  const days = new Set(completed.map((s) => calmDayKey(calmUtcMidnight(s.occurredAt))));
  const todayMidnight = calmUtcMidnight(opts?.todayIso ?? nowIso());

  let anchor: number;
  if (days.has(calmDayKey(todayMidnight))) {
    anchor = todayMidnight;
  } else if (days.has(calmDayKey(todayMidnight - CALM_DAY_MS))) {
    anchor = todayMidnight - CALM_DAY_MS;
  } else {
    return { currentStreakDays: 0, lastSessionAt };
  }

  let count = 0;
  for (let cursor = anchor; days.has(calmDayKey(cursor)); cursor -= CALM_DAY_MS) {
    count += 1;
  }
  return { currentStreakDays: count, lastSessionAt };
}

/**
 * Calm, non-clinical parent rollup: counts only. Never returns raw
 * records or any free-text. `topActivityId` is the most-used activity in
 * the window (ties broken by first appearance in the catalog order the
 * records were written in).
 */
export async function summarizeCalmForParent(
  learnerId: string,
  tenantId: string,
  opts?: { sinceIso?: string },
): Promise<{
  totalMoments: number;
  completedMoments: number;
  topActivityId: string | null;
  lastSessionAt: string | null;
}> {
  const sessions = await listCalmSessionsForLearner(learnerId, tenantId, {
    sinceIso: opts?.sinceIso,
  });

  const counts = new Map<string, number>();
  for (const s of sessions) {
    counts.set(s.activityId, (counts.get(s.activityId) ?? 0) + 1);
  }

  let topActivityId: string | null = null;
  let topCount = 0;
  for (const [activityId, count] of counts) {
    if (count > topCount) {
      topActivityId = activityId;
      topCount = count;
    }
  }

  return {
    totalMoments: sessions.length,
    completedMoments: sessions.filter((s) => s.completed).length,
    topActivityId,
    lastSessionAt: sessions.length > 0 ? sessions[0].occurredAt : null,
  };
}

// ===== Sprint 18: Teacher assignments =====

export async function listTeacherAssignments(
  teacherId: string,
  tenantId: string,
  opts?: { status?: "active" | "archived" },
): Promise<TeacherAssignment[]> {
  return getPersistence().admin.listTeacherAssignments(teacherId, tenantId, opts);
}

export async function getTeacherAssignment(
  assignmentId: string,
  teacherId: string,
  tenantId: string,
): Promise<TeacherAssignment | null> {
  return getPersistence().admin.getTeacherAssignmentById(assignmentId, teacherId, tenantId);
}

export async function createTeacherAssignment(input: {
  teacherId: string;
  tenantId: string;
  title: string;
  instructions: string;
  subjectId: string;
  skillIds: string[];
  learnerIds: string[];
  classId?: string | null;
  dueAt?: string | null;
}): Promise<TeacherAssignment> {
  const store = db();
  // Defense-in-depth: drop learner IDs not in this tenant. The BFF layer
  // also filters before calling this, but we double-check here so a
  // misbehaving caller cannot cross-tenant-leak an assignment.
  const learnerIds = input.learnerIds.filter((id) => {
    const l = store.learnerProfiles.get(id);
    return Boolean(l && l.tenantId === input.tenantId);
  });
  const now = nowIso();
  const assignment: TeacherAssignment = {
    id: newId("ta"),
    teacherId: input.teacherId,
    tenantId: input.tenantId,
    classId: input.classId ?? null,
    title: input.title,
    instructions: input.instructions,
    subjectId: input.subjectId,
    skillIds: input.skillIds,
    learnerIds,
    status: "active",
    dueAt: input.dueAt ?? null,
    createdAt: now,
    updatedAt: now,
  };
  return getPersistence().admin.upsertTeacherAssignment(assignment);
}

export async function updateTeacherAssignment(
  assignmentId: string,
  teacherId: string,
  tenantId: string,
  patch: Partial<
    Pick<
      TeacherAssignment,
      "title" | "instructions" | "skillIds" | "learnerIds" | "dueAt" | "status"
    >
  >,
): Promise<TeacherAssignment | null> {
  const store = db();
  const existing = await getTeacherAssignment(assignmentId, teacherId, tenantId);
  if (!existing) return null;
  let learnerIds = existing.learnerIds;
  if (patch.learnerIds) {
    learnerIds = patch.learnerIds.filter((id) => {
      const l = store.learnerProfiles.get(id);
      return Boolean(l && l.tenantId === tenantId);
    });
  }
  const next: TeacherAssignment = {
    ...existing,
    ...patch,
    learnerIds,
    updatedAt: nowIso(),
  };
  return getPersistence().admin.upsertTeacherAssignment(next);
}

export async function deleteTeacherAssignment(
  assignmentId: string,
  teacherId: string,
  tenantId: string,
): Promise<boolean> {
  return getPersistence().admin.deleteTeacherAssignment(assignmentId, teacherId, tenantId);
}

/**
 * Active assignments for a learner across all teachers in their tenant.
 * Used by `pickTodaysMission` to surface teacher-assigned work as a
 * higher priority than the default learning path.
 */
export async function listActiveAssignmentsForLearner(
  learnerId: string,
  tenantId: string,
): Promise<TeacherAssignment[]> {
  // No teacher-scoping here — we need every assignment in the tenant
  // that targets this learner. We iterate the per-teacher buckets via
  // a tenant-wide scan in the memory adapter; the Drizzle impl will
  // replace this with a single `WHERE tenant_id = ? AND ?  =
  // ANY(learner_ids) AND status = 'active'` query.
  const all = Array.from(db().teacherAssignments.values())
    .filter(
      (a) => a.tenantId === tenantId && a.status === "active" && a.learnerIds.includes(learnerId),
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return all;
}

// ===== Phase 1: weekly curriculum sync =====
//
// LIVE data path: when INTERNAL_SERVICE_TOKEN is configured (REQUIRED in
// production), these functions proxy to tutor-svc, the owner of the shared
// `curriculum_uploads` Postgres table — so web-v2 and tutor-svc share one
// source of truth. In dev/test without the token they fall back to the
// in-memory store. `assertLiveConfigured()` makes production fail closed
// rather than silently using the in-memory store.

/**
 * List curriculum uploads for a learner (newest first), optionally filtered
 * by subject slug and/or status. Tenant-scoped (tenant resolved by tutor-svc
 * in live mode).
 */
export async function listCurriculumUploadsForLearner(
  learnerId: string,
  tenantId: string,
  opts?: { subject?: string; status?: CurriculumUpload["status"] },
): Promise<CurriculumUpload[]> {
  assertLiveConfigured();
  if (isLiveCurriculum()) {
    return tutorListCurriculum(learnerId, opts);
  }
  return Array.from(db().curriculumUploads.values())
    .filter(
      (u) =>
        u.learnerId === learnerId &&
        u.tenantId === tenantId &&
        (!opts?.subject || u.subject === opts.subject) &&
        (!opts?.status || u.status === opts.status),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Persist a new curriculum upload. Archives any prior ACTIVE upload for the
 * same (learner, subject) whose week window does not extend past the new
 * plan's start, mirroring tutor-svc's archival rule so the active focus is
 * unambiguous. In live mode tutor-svc performs the archival + insert.
 */
export async function createCurriculumUpload(input: {
  tenantId: string;
  learnerId: string;
  uploadedBy: string;
  uploaderRole: CurriculumUpload["uploaderRole"];
  subject: string;
  title: string;
  sourceType: CurriculumUpload["sourceType"];
  fileName?: string | null;
  rawText?: string;
  parsedFocus: CurriculumFocus;
  weekStart?: string | null;
  weekEnd?: string | null;
  notes?: string | null;
}): Promise<CurriculumUpload> {
  assertLiveConfigured();
  const weekStart = input.weekStart ?? input.parsedFocus.weekStart ?? null;
  const weekEnd = input.weekEnd ?? input.parsedFocus.weekEnd ?? null;

  if (isLiveCurriculum()) {
    return tutorCreateCurriculum({
      learnerId: input.learnerId,
      subject: input.subject,
      title: input.title,
      rawText: (input.rawText ?? "").slice(0, 32000),
      sourceType: input.sourceType,
      fileName: input.fileName ?? null,
      parsedFocus: { ...input.parsedFocus, weekStart, weekEnd },
      weekStart,
      weekEnd,
      notes: input.notes ?? null,
    });
  }

  const store = db();
  const now = nowIso();
  const newStartMs = weekStart ? new Date(weekStart).getTime() : -Infinity;

  // Archive prior ACTIVE uploads for the same (learner, subject) that have
  // already ended before this plan starts. A still-current plan and a
  // future-dated plan can coexist; getActiveCurriculumFocus disambiguates.
  for (const u of store.curriculumUploads.values()) {
    if (
      u.learnerId === input.learnerId &&
      u.tenantId === input.tenantId &&
      u.subject === input.subject &&
      u.status === "active"
    ) {
      const endMs = u.weekEnd ? new Date(u.weekEnd).getTime() + 24 * 3600 * 1000 : Infinity;
      const newIsFuture = weekStart ? newStartMs > Date.now() : false;
      if (!newIsFuture || endMs <= newStartMs) {
        store.curriculumUploads.set(u.id, { ...u, status: "archived", updatedAt: now });
      }
    }
  }

  const upload: CurriculumUpload = {
    id: newId("cu"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    uploadedBy: input.uploadedBy,
    uploaderRole: input.uploaderRole,
    subject: input.subject,
    title: input.title,
    sourceType: input.sourceType,
    fileName: input.fileName ?? null,
    rawText: (input.rawText ?? "").slice(0, 32000),
    parsedFocus: { ...input.parsedFocus, weekStart, weekEnd },
    weekStart,
    weekEnd,
    status: "active",
    notes: input.notes ?? null,
    createdAt: now,
    updatedAt: now,
  };
  store.curriculumUploads.set(upload.id, upload);
  return upload;
}

/** Delete an upload by id, tenant-scoped. Returns true if removed. */
export async function deleteCurriculumUpload(uploadId: string, tenantId: string): Promise<boolean> {
  assertLiveConfigured();
  if (isLiveCurriculum()) {
    return tutorDeleteCurriculum(uploadId);
  }
  const store = db();
  const existing = store.curriculumUploads.get(uploadId);
  if (!existing || existing.tenantId !== tenantId) return false;
  return store.curriculumUploads.delete(uploadId);
}

// ── Whole-term syllabus repos (Sprint 6, G7) ────────────────────────────

/** List a learner's saved term syllabi (newest first), tenant-scoped. */
export async function listTermSyllabiForLearner(
  learnerId: string,
  tenantId: string,
  opts: { subject?: string } = {},
): Promise<TermSyllabus[]> {
  const store = db();
  return Array.from(store.termSyllabi.values())
    .filter(
      (s) =>
        s.learnerId === learnerId &&
        s.tenantId === tenantId &&
        (!opts.subject || s.subject === opts.subject),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Get one term syllabus by id, tenant-scoped. */
export async function getTermSyllabus(
  syllabusId: string,
  tenantId: string,
): Promise<TermSyllabus | null> {
  const store = db();
  const row = store.termSyllabi.get(syllabusId);
  return row && row.tenantId === tenantId ? row : null;
}

/** Persist a parsed term syllabus + its ordered units. */
export async function createTermSyllabus(input: {
  tenantId: ID;
  learnerId: ID;
  uploadedBy: ID;
  uploaderRole: string;
  subject: string;
  title?: string | null;
  termCount: number;
  sourceType?: string;
  fileName?: string | null;
  rawText?: string | null;
  units: Array<Omit<TermSyllabusUnit, "id" | "syllabusId" | "createdAt">>;
  notes?: string | null;
}): Promise<TermSyllabus> {
  const store = db();
  const now = nowIso();
  const id = newId("tsy");
  const units: TermSyllabusUnit[] = input.units.map((u) => ({
    id: newId("tsu"),
    syllabusId: id,
    createdAt: now,
    ...u,
  }));
  const syllabus: TermSyllabus = {
    id,
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    uploadedBy: input.uploadedBy,
    uploaderRole: input.uploaderRole,
    subject: input.subject,
    title: input.title ?? null,
    termCount: input.termCount,
    sourceType: input.sourceType ?? "text",
    fileName: input.fileName ?? null,
    rawText: input.rawText ? input.rawText.slice(0, 200000) : null,
    status: "SAVED",
    notes: input.notes ?? null,
    units,
    createdAt: now,
    updatedAt: now,
  };
  store.termSyllabi.set(id, syllabus);
  return syllabus;
}

/** Delete a term syllabus by id, tenant-scoped. Returns true if removed. */
export async function deleteTermSyllabus(
  syllabusId: string,
  tenantId: string,
): Promise<boolean> {
  const store = db();
  const existing = store.termSyllabi.get(syllabusId);
  if (!existing || existing.tenantId !== tenantId) return false;
  return store.termSyllabi.delete(syllabusId);
}

/**
 * The manual "this week at school" focus (Phase 1): a parent/teacher upload. In
 * live mode tutor-svc resolves it (most recent ACTIVE upload whose week window
 * contains today; subject-specific wins over "other"); otherwise the in-memory
 * dev store is consulted. Best-effort — a tutor-svc outage degrades to null.
 */
async function getManualCurriculumFocus(
  learnerId: string,
  tenantId: string,
  subject?: string,
): Promise<CurriculumFocus | null> {
  if (isLiveCurriculum()) {
    return tutorActiveFocusSafe(learnerId, subject);
  }
  const now = Date.now();
  const active = Array.from(db().curriculumUploads.values())
    .filter(
      (u) =>
        u.learnerId === learnerId &&
        u.tenantId === tenantId &&
        u.status === "active" &&
        (!subject || u.subject === subject || u.subject === "other"),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const inWindow = active.filter((u) => {
    const startMs = u.weekStart ? new Date(u.weekStart).getTime() : -Infinity;
    const endMs = u.weekEnd ? new Date(u.weekEnd).getTime() + 24 * 3600 * 1000 : Infinity;
    return startMs <= now && now <= endMs;
  });

  // Prefer subject-specific over "other" when both are candidates.
  const pick = (rows: CurriculumUpload[]): CurriculumUpload | undefined => {
    if (!subject) return rows[0];
    return rows.find((u) => u.subject === subject) ?? rows[0];
  };

  const row = pick(inWindow) ?? pick(active.filter((u) => !u.weekStart && !u.weekEnd));
  return row ? row.parsedFocus : null;
}

/**
 * The curriculum focus the tutor should teach to right now for a (learner,
 * subject). Priority:
 *   1. A parent/teacher manual upload (Phase 1) — the explicit "this is what
 *      we're doing in class this week" signal wins.
 *   2. The automated calendar pacing plan (Phase 2) — brain-svc's current
 *      instructional week from the district scope-&-sequence.
 * Both reads are best-effort: a service outage degrades to no-sync rather than
 * blocking lesson generation. Returns null when there's nothing to sync to.
 */
export async function getActiveCurriculumFocus(
  learnerId: string,
  tenantId: string,
  subject?: string,
): Promise<CurriculumFocus | null> {
  const manual = await getManualCurriculumFocus(learnerId, tenantId, subject);
  if (manual) return manual;

  // Pacing is per-subject; only fall back when a subject is in scope.
  if (subject) {
    const paced = await brainPacingFocusSafe(learnerId, subject);
    if (paced) return paced;
  }
  return null;
}

/**
 * Teacher-visible learner roster. In Sprint 18 every learner in the tenant
 * is considered visible to teachers in that tenant (school-scoped roster
 * lands in Sprint 19 admin work). Mirrors what `getLearner` would expose
 * but excludes any private fields a teacher shouldn't see (raw IEP text is
 * never on the LearnerProfile anyway — it lives behind AccommodationSummary).
 */
export async function listLearnersForTeacher(
  teacherId: string,
  tenantId: string,
): Promise<LearnerProfile[]> {
  return getPersistence().learners.listForTeacher(teacherId, tenantId);
}

/**
 * True if `teacherUserId` has access to `learnerId` via a shared classroom in
 * the given tenant. Use this in teacher pages before reading a learner's data.
 */
export async function teacherCanAccessLearner(
  teacherUserId: string,
  learnerId: string,
  tenantId: string,
): Promise<boolean> {
  return getPersistence().learners.teacherCanAccess(teacherUserId, learnerId, tenantId);
}

// ===== Sprints 19–21: Admin / Ops repos =====
import type {
  AiGenerationJob,
  BillingAccount,
  SupportTicket,
  Tenant,
  TenantMembership,
  User,
} from "@/lib/db/types";
import type { Role } from "@/lib/auth/types";

/**
 * Resolve which tenants a session can see. RBAC contract:
 *  - platform_admin → every tenant
 *  - district_admin → own tenant + every descendant (schools, families under them)
 *  - school_admin   → own tenant + every descendant (families under the school)
 *  - parent/teacher → own tenant only
 *  - learner        → own tenant only
 * Returns a deterministic, name-sorted list.
 */
export function scopeTenantsForSession(role: Role, tenantId: string): Tenant[] {
  const all = Array.from(db().tenants.values());
  let visible: Tenant[];
  if (
    role === "platform_admin" ||
    role === "support" ||
    role === "marketing" ||
    role === "sales" ||
    role === "devops" ||
    role === "engineering"
  ) {
    visible = all;
  } else if (role === "district_admin" || role === "school_admin") {
    const seen = new Set<string>([tenantId]);
    let added = true;
    while (added) {
      added = false;
      for (const t of all) {
        if (t.parentTenantId && seen.has(t.parentTenantId) && !seen.has(t.id)) {
          seen.add(t.id);
          added = true;
        }
      }
    }
    visible = all.filter((t) => seen.has(t.id));
  } else {
    visible = all.filter((t) => t.id === tenantId);
  }
  return visible.slice().sort((a, b) => a.name.localeCompare(b.name));
}

export function getTenantById(id: string): Tenant | null {
  return db().tenants.get(id) ?? null;
}

export function updateTenant(id: string, patch: Partial<Pick<Tenant, "name">>): Tenant | null {
  const t = db().tenants.get(id);
  if (!t) return null;
  const next: Tenant = { ...t, ...patch };
  db().tenants.set(id, next);
  return next;
}

export function createTenant(input: {
  name: string;
  type: Tenant["type"];
  parentTenantId: string | null;
}): Tenant {
  const id = newId("ten");
  const tenant: Tenant = {
    id,
    name: input.name,
    type: input.type,
    parentTenantId: input.parentTenantId,
    createdAt: nowIso(),
  };
  db().tenants.set(id, tenant);
  return tenant;
}

/** Users + their role/tenant for a set of tenants. */
export type UserSummary = {
  user: User;
  tenantId: string;
  role: Role;
  joinedAt: string;
};
export async function listUsersForTenants(tenantIds: string[]): Promise<UserSummary[]> {
  return getPersistence().identity.listUsersForTenants(tenantIds);
}

export async function updateUserDisplayName(
  userId: string,
  displayName: string,
): Promise<User | null> {
  return getPersistence().identity.updateUserDisplayName(userId, displayName);
}

/** Audit logs scoped to a tenant set. Routed through the persistence adapter. */
export async function listAuditLogsForTenants(
  tenantIds: string[],
  limit = 100,
): Promise<AuditLog[]> {
  return getPersistence().audit.recentForTenants(tenantIds, limit);
}

/** AI generation jobs scoped to a tenant set, newest first. */
export async function listAiGenerationJobs(
  tenantIds: string[],
  limit = 100,
): Promise<AiGenerationJob[]> {
  const ids = new Set(tenantIds);
  return (await getPersistence().support.listAiGenerationJobs())
    .filter((j) => ids.has(j.tenantId))
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
    .slice(0, limit);
}

/** Append a telemetry record. S20: every AI call gets logged. */
export async function recordAiGenerationJob(input: {
  tenantId: string;
  kind: AiGenerationJob["kind"];
  status: AiGenerationJob["status"];
  inputRef: string;
  outputRef?: string | null;
  completedAt?: string | null;
}): Promise<AiGenerationJob> {
  const id = newId("aij");
  const job: AiGenerationJob = {
    id,
    tenantId: input.tenantId,
    kind: input.kind,
    status: input.status,
    inputRef: input.inputRef,
    outputRef: input.outputRef ?? null,
    startedAt: nowIso(),
    completedAt: input.completedAt ?? null,
  };
  return await getPersistence().support.appendAiGenerationJob(job);
}

/** Aggregate health derived from generation jobs + lesson runs. */
export type SystemHealth = {
  generationSuccessRate: number; // 0..1, complete / (complete+failed)
  generationFailureCount: number;
  generationQueuedCount: number;
  lessonRunsTotal: number;
  lessonRunsCompleted: number;
  tenantsTotal: number;
  usersTotal: number;
};
export async function computeSystemHealth(tenantIds: string[]): Promise<SystemHealth> {
  const ids = new Set(tenantIds);
  const jobs = (await getPersistence().support.listAiGenerationJobs()).filter((j) =>
    ids.has(j.tenantId),
  );
  const complete = jobs.filter((j) => j.status === "complete").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const queued = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
  const denom = complete + failed;
  const runs = Array.from(db().lessonRuns.values()).filter((r) => ids.has(r.tenantId));
  const runsCompleted = runs.filter((r) => r.status === "completed").length;
  const memberTenants = new Set<string>();
  for (const m of db().memberships) {
    if (ids.has(m.tenantId)) memberTenants.add(m.userId);
  }
  return {
    generationSuccessRate: denom === 0 ? 1 : complete / denom,
    generationFailureCount: failed,
    generationQueuedCount: queued,
    lessonRunsTotal: runs.length,
    lessonRunsCompleted: runsCompleted,
    tenantsTotal: tenantIds.length,
    usersTotal: memberTenants.size,
  };
}

/** Billing — one BillingAccount per tenant; latest wins if dupes exist. */
export async function getBillingForTenant(tenantId: string): Promise<BillingAccount | null> {
  return await getPersistence().billing.getAccountForTenant(tenantId);
}

export async function listBillingForTenants(tenantIds: string[]): Promise<BillingAccount[]> {
  return await getPersistence().billing.listAccountsForTenants(tenantIds);
}

/** Support tickets. */
export async function listSupportTickets(tenantIds: string[]): Promise<SupportTicket[]> {
  const ids = new Set(tenantIds);
  return (await getPersistence().support.listSupportTickets())
    .filter((t) => ids.has(t.tenantId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function createSupportTicket(input: {
  userId: string;
  tenantId: string;
  subject: string;
  body: string;
}): Promise<SupportTicket> {
  const id = newId("tkt");
  const ticket: SupportTicket = {
    id,
    userId: input.userId,
    tenantId: input.tenantId,
    subject: input.subject,
    body: input.body,
    status: "open",
    createdAt: nowIso(),
  };
  return await getPersistence().support.upsertSupportTicket(ticket);
}

export async function updateSupportTicketStatus(
  id: string,
  status: SupportTicket["status"],
  scope: { tenantIds: string[] },
): Promise<SupportTicket | null> {
  const support = getPersistence().support;
  const t = await support.getSupportTicket(id);
  if (!t) return null;
  if (!scope.tenantIds.includes(t.tenantId)) return null;
  return await support.upsertSupportTicket({ ...t, status });
}

// ===== Sprint 24: Consent + Terms + Age gate =====
import type {
  ConsentRecord,
  ConsentType,
  ConsentVersion,
  TermsAcceptance,
  AgeGateRecord,
} from "@/lib/db/types";

export async function listConsentVersions(): Promise<ConsentVersion[]> {
  const all = await getPersistence().compliance.listConsentVersions();
  return all.sort((a, b) => a.consentType.localeCompare(b.consentType));
}

export async function getActiveConsentVersion(type: ConsentType): Promise<ConsentVersion | null> {
  const all = (await getPersistence().compliance.listConsentVersions()).filter(
    (v) => v.consentType === type,
  );
  if (!all.length) return null;
  return all.sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))[0]!;
}

export async function listConsentsForUser(
  parentUserId: string,
  tenantId: string,
): Promise<ConsentRecord[]> {
  return getPersistence().compliance.listConsentsForUser(parentUserId, tenantId);
}

export async function listConsentsForLearner(
  parentUserId: string,
  learnerId: string,
  tenantId: string,
): Promise<ConsentRecord[]> {
  return getPersistence().compliance.listConsentsForLearner(parentUserId, learnerId, tenantId);
}

export async function getActiveConsentForUser(
  parentUserId: string,
  type: ConsentType,
  tenantId: string,
  learnerId: string | null = null,
): Promise<ConsentRecord | null> {
  return getPersistence().compliance.getActiveConsentForUser(
    parentUserId,
    type,
    tenantId,
    learnerId,
  );
}

export async function recordConsent(input: {
  tenantId: string;
  parentUserId: string;
  learnerId: string | null;
  consentType: ConsentType;
  ipHash?: string | null;
  userAgent?: string | null;
}): Promise<ConsentRecord> {
  const version = await getActiveConsentVersion(input.consentType);
  // Auto-revoke any prior active records in the same scope so revoke is a
  // single-step operation. Without this, duplicate accepts pile up and a
  // single revoke leaves an older active row that nullifies the revocation.
  const now = nowIso();
  const compliance = getPersistence().compliance;
  const existing = await compliance.listConsentsForUser(input.parentUserId, input.tenantId);
  for (const r of existing) {
    if (
      r.consentType === input.consentType &&
      (r.learnerId ?? null) === (input.learnerId ?? null) &&
      r.revokedAt === null
    ) {
      await compliance.upsertConsent({ ...r, revokedAt: now });
    }
  }
  const rec: ConsentRecord = {
    id: newId("crec"),
    tenantId: input.tenantId,
    parentUserId: input.parentUserId,
    learnerId: input.learnerId,
    consentType: input.consentType,
    version: version?.version ?? "unversioned",
    acceptedAt: now,
    revokedAt: null,
    ipHash: input.ipHash ?? null,
    userAgent: input.userAgent ?? null,
  };
  return compliance.upsertConsent(rec);
}

export async function revokeConsent(input: {
  tenantId: string;
  parentUserId: string;
  learnerId: string | null;
  consentType: ConsentType;
}): Promise<ConsentRecord | null> {
  // Revoke every active row for this scope, not just the latest, so a single
  // revoke deterministically disables the consent even if duplicates exist.
  const now = nowIso();
  const compliance = getPersistence().compliance;
  const records = await compliance.listConsentsForUser(input.parentUserId, input.tenantId);
  let last: ConsentRecord | null = null;
  for (const r of records) {
    if (
      r.consentType === input.consentType &&
      (r.learnerId ?? null) === (input.learnerId ?? null) &&
      r.revokedAt === null
    ) {
      const updated: ConsentRecord = { ...r, revokedAt: now };
      last = await compliance.upsertConsent(updated);
    }
  }
  return last;
}

export async function recordTermsAcceptance(input: {
  tenantId: string;
  userId: string;
  termsVersion: string;
}): Promise<TermsAcceptance> {
  const t: TermsAcceptance = {
    id: newId("tac"),
    tenantId: input.tenantId,
    userId: input.userId,
    termsVersion: input.termsVersion,
    acceptedAt: nowIso(),
  };
  return await getPersistence().compliance.appendTermsAcceptance(t);
}

export async function getAgeGateForLearner(
  learnerId: string,
  tenantId: string,
): Promise<AgeGateRecord | null> {
  return getPersistence().compliance.getAgeGateForLearner(learnerId, tenantId);
}

const UNDER_13_AGE_RANGES = new Set(["3-5", "5-7", "7-9", "9-11", "11-13"]);

export async function recordAgeGate(input: {
  tenantId: string;
  learnerId: string;
  recordedByUserId: string;
  ageRange: string | null;
}): Promise<AgeGateRecord> {
  const rec: AgeGateRecord = {
    id: newId("agr"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    recordedByUserId: input.recordedByUserId,
    ageRange: input.ageRange,
    requiresParentConsent: input.ageRange ? UNDER_13_AGE_RANGES.has(input.ageRange) : true,
    recordedAt: nowIso(),
  };
  return getPersistence().compliance.upsertAgeGate(rec);
}

// ────────────────────────────────────────────────────────────────────────────
// Sprint 25 — privacy / compliance / DSAR.
// ────────────────────────────────────────────────────────────────────────────
import type {
  DataInventoryItem,
  DataRetentionPolicy,
  DisclosureLog,
  DisclosureRecipientType,
  DataExportRequest,
  DataDeletionRequest,
  IEPDocumentAccessLog,
  PolicyVersion,
  SubprocessorRecord,
  PrivacyRequestStatus,
} from "@/lib/db/types";

export async function listDataInventory(): Promise<DataInventoryItem[]> {
  return (await getPersistence().compliance.listDataInventory()).sort((a, b) =>
    a.key.localeCompare(b.key),
  );
}

export async function listRetentionPolicies(): Promise<DataRetentionPolicy[]> {
  return (await getPersistence().compliance.listRetentionPolicies()).sort((a, b) =>
    a.classification.localeCompare(b.classification),
  );
}

export async function getRetentionPolicy(id: string): Promise<DataRetentionPolicy | null> {
  return await getPersistence().compliance.getRetentionPolicy(id);
}

export async function updateRetentionPolicy(
  id: string,
  patch: { retentionDays?: number; archiveDays?: number; description?: string },
  updatedByUserId: string,
): Promise<DataRetentionPolicy | null> {
  const compliance = getPersistence().compliance;
  const existing = await compliance.getRetentionPolicy(id);
  if (!existing) return null;
  const next: DataRetentionPolicy = {
    ...existing,
    retentionDays:
      patch.retentionDays !== undefined && patch.retentionDays >= 0
        ? Math.floor(patch.retentionDays)
        : existing.retentionDays,
    archiveDays:
      patch.archiveDays !== undefined && patch.archiveDays >= 0
        ? Math.floor(patch.archiveDays)
        : existing.archiveDays,
    description: patch.description ?? existing.description,
    updatedAt: nowIso(),
    updatedByUserId,
  };
  return await compliance.upsertRetentionPolicy(next);
}

export async function listDisclosures(tenantId: string): Promise<DisclosureLog[]> {
  return await getPersistence().compliance.listDisclosures(tenantId);
}

export async function recordDisclosure(input: {
  tenantId: string;
  learnerId: string | null;
  recipientType: DisclosureRecipientType;
  recipientName: string;
  reason: string;
  ferpaBasis: string;
  disclosedByUserId: string;
}): Promise<DisclosureLog> {
  const rec: DisclosureLog = {
    id: newId("disc"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    recipientType: input.recipientType,
    recipientName: input.recipientName.trim(),
    reason: input.reason.trim(),
    ferpaBasis: input.ferpaBasis.trim(),
    disclosedAt: nowIso(),
    disclosedByUserId: input.disclosedByUserId,
  };
  return await getPersistence().compliance.appendDisclosure(rec);
}

export async function createDataExportRequest(input: {
  tenantId: string;
  parentUserId: string;
  learnerId: string | null;
  notes?: string | null;
}): Promise<DataExportRequest> {
  const rec: DataExportRequest = {
    id: newId("dxp"),
    tenantId: input.tenantId,
    parentUserId: input.parentUserId,
    learnerId: input.learnerId,
    status: "pending",
    requestedAt: nowIso(),
    completedAt: null,
    exportUrl: null,
    notes: input.notes ?? null,
  };
  return await getPersistence().compliance.upsertExportRequest(rec);
}

export async function getDataExportRequest(
  id: string,
  tenantId: string,
): Promise<DataExportRequest | null> {
  const r = await getPersistence().compliance.getExportRequestById(id);
  if (!r || r.tenantId !== tenantId) return null;
  return r;
}

/** Cross-tenant lookup, intended for platform_admin DSAR queue review only. */
export async function getDataExportRequestById(id: string): Promise<DataExportRequest | null> {
  return await getPersistence().compliance.getExportRequestById(id);
}

export async function listDataExportRequestsForUser(
  parentUserId: string,
  tenantId: string,
): Promise<DataExportRequest[]> {
  return (await getPersistence().compliance.listExportRequests())
    .filter((r) => r.tenantId === tenantId && r.parentUserId === parentUserId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function listAllDataExportRequests(): Promise<DataExportRequest[]> {
  return (await getPersistence().compliance.listExportRequests()).sort((a, b) =>
    b.requestedAt.localeCompare(a.requestedAt),
  );
}

export async function updateDataExportRequestStatus(
  id: string,
  status: PrivacyRequestStatus,
  exportUrl: string | null = null,
): Promise<DataExportRequest | null> {
  const compliance = getPersistence().compliance;
  const r = await compliance.getExportRequestById(id);
  if (!r) return null;
  const completed = status === "completed" || status === "denied";
  const next: DataExportRequest = {
    ...r,
    status,
    completedAt: completed ? nowIso() : r.completedAt,
    exportUrl: exportUrl ?? r.exportUrl,
  };
  return await compliance.upsertExportRequest(next);
}

export async function createDataDeletionRequest(input: {
  tenantId: string;
  parentUserId: string;
  learnerId: string | null;
  scope: "account" | "learner" | "iep_only";
  notes?: string | null;
}): Promise<DataDeletionRequest> {
  const rec: DataDeletionRequest = {
    id: newId("ddr"),
    tenantId: input.tenantId,
    parentUserId: input.parentUserId,
    learnerId: input.learnerId,
    status: "pending",
    requestedAt: nowIso(),
    completedAt: null,
    scope: input.scope,
    notes: input.notes ?? null,
  };
  return await getPersistence().compliance.upsertDeletionRequest(rec);
}

export async function getDataDeletionRequest(
  id: string,
  tenantId: string,
): Promise<DataDeletionRequest | null> {
  const r = await getPersistence().compliance.getDeletionRequestById(id);
  if (!r || r.tenantId !== tenantId) return null;
  return r;
}

/** Cross-tenant lookup, intended for platform_admin DSAR queue review only. */
export async function getDataDeletionRequestById(id: string): Promise<DataDeletionRequest | null> {
  return await getPersistence().compliance.getDeletionRequestById(id);
}

export async function listDataDeletionRequestsForUser(
  parentUserId: string,
  tenantId: string,
): Promise<DataDeletionRequest[]> {
  return (await getPersistence().compliance.listDeletionRequests())
    .filter((r) => r.tenantId === tenantId && r.parentUserId === parentUserId)
    .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
}

export async function listAllDataDeletionRequests(): Promise<DataDeletionRequest[]> {
  return (await getPersistence().compliance.listDeletionRequests()).sort((a, b) =>
    b.requestedAt.localeCompare(a.requestedAt),
  );
}

export async function logIepAccess(input: {
  tenantId: string;
  learnerId: string;
  documentId: string;
  accessedByUserId: string;
  purpose: IEPDocumentAccessLog["purpose"];
}): Promise<IEPDocumentAccessLog> {
  const rec: IEPDocumentAccessLog = {
    id: newId("iepacc"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    documentId: input.documentId,
    accessedByUserId: input.accessedByUserId,
    accessedAt: nowIso(),
    purpose: input.purpose,
  };
  return await getPersistence().compliance.appendIepAccessLog(rec);
}

export async function listIepAccessForLearner(
  learnerId: string,
  tenantId: string,
): Promise<IEPDocumentAccessLog[]> {
  return await getPersistence().compliance.listIepAccessForLearner(learnerId, tenantId);
}

export async function listPolicyVersions(): Promise<PolicyVersion[]> {
  return getPersistence().compliance.listPolicyVersions();
}

export async function listSubprocessors(): Promise<SubprocessorRecord[]> {
  const all = await getPersistence().compliance.listSubprocessors();
  return all.slice().sort((a, b) => a.name.localeCompare(b.name));
}

// ===== Sprint 26: Curriculum / Standards / Skill Graph =====
//
// Read-side helpers mirror the existing listSubjects/listSkills style and
// are tenant-agnostic (curriculum is a platform-global catalog, not a
// per-tenant artifact). Write-side helpers are wrapped in normal create/
// update functions that mint ids via newId() so BFFs stay thin.

export async function listStandardsFrameworks(): Promise<StandardsFramework[]> {
  return (await getPersistence().standards.listFrameworks()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

export async function getStandardsFramework(id: string): Promise<StandardsFramework | null> {
  return await getPersistence().standards.getFramework(id);
}

export async function getStandardsFrameworkBySlug(
  slug: StandardsFrameworkSlug,
): Promise<StandardsFramework | null> {
  for (const f of await getPersistence().standards.listFrameworks()) {
    if (f.slug === slug) return f;
  }
  return null;
}

export async function createStandardsFramework(input: {
  slug: StandardsFrameworkSlug;
  name: string;
  issuer: string;
  description: string;
  homepageUrl: string | null;
}): Promise<StandardsFramework> {
  const rec: StandardsFramework = {
    id: newId("frw"),
    status: "active",
    ...input,
  };
  return await getPersistence().standards.upsertFramework(rec);
}

export async function listStandardDocuments(frameworkId?: string): Promise<StandardDocument[]> {
  const all = await getPersistence().standards.listStandardDocuments();
  return (frameworkId ? all.filter((d) => d.frameworkId === frameworkId) : all).sort((a, b) =>
    a.title.localeCompare(b.title),
  );
}

export async function listStandards(filter?: {
  frameworkId?: string;
  documentId?: string;
}): Promise<Standard[]> {
  let all = await getPersistence().standards.listStandards();
  if (filter?.frameworkId) all = all.filter((s) => s.frameworkId === filter.frameworkId);
  if (filter?.documentId) all = all.filter((s) => s.documentId === filter.documentId);
  return all.sort((a, b) => a.code.localeCompare(b.code));
}

export async function getStandard(id: string): Promise<Standard | null> {
  return await getPersistence().standards.getStandard(id);
}

export async function listDomains(subjectId?: string): Promise<Domain[]> {
  const all = await getPersistence().standards.listDomains();
  return (subjectId ? all.filter((d) => d.subjectId === subjectId) : all).sort(
    (a, b) => a.orderIndex - b.orderIndex || a.name.localeCompare(b.name),
  );
}

export function createSubject(input: {
  slug: string;
  name: string;
  description: string;
  iconKey: string;
}): Subject {
  const rec: Subject = { id: newId("sub"), ...input };
  db().subjects.set(rec.id, rec);
  return rec;
}

export async function getSkill(id: string): Promise<Skill | null> {
  return getPersistence().curriculum.getSkillById(id);
}

export async function createSkill(input: {
  subjectId: string;
  slug: string;
  name: string;
  gradeBand: string;
  prerequisites?: string[];
}): Promise<Skill> {
  const curriculum = getPersistence().curriculum;
  if (!(await curriculum.getSubjectById(input.subjectId))) {
    throw new Error(`subjectId not found: ${input.subjectId}`);
  }
  const rec: Skill = {
    id: newId("skl"),
    subjectId: input.subjectId,
    slug: input.slug,
    name: input.name,
    gradeBand: input.gradeBand,
    prerequisites: input.prerequisites ?? [],
  };
  await curriculum.upsertSkill(rec);
  // Auto-create a v1 SkillVersion so AI gen always finds a current version.
  const svId = newId("skv");
  await getPersistence().standards.upsertSkillVersion({
    id: svId,
    skillId: rec.id,
    version: "1.0",
    effectiveAt: nowIso(),
    objectiveSummary: `Demonstrate ${rec.name.toLowerCase()} at grade band ${rec.gradeBand}.`,
    isCurrent: true,
  });
  return rec;
}

export async function updateSkill(
  id: string,
  patch: { name?: string; gradeBand?: string; prerequisites?: string[] },
): Promise<Skill | null> {
  const curriculum = getPersistence().curriculum;
  const existing = await curriculum.getSkillById(id);
  if (!existing) return null;
  const skill: Skill = { ...existing };
  if (patch.name !== undefined) skill.name = patch.name;
  if (patch.gradeBand !== undefined) skill.gradeBand = patch.gradeBand;
  if (patch.prerequisites !== undefined) {
    const checked: string[] = [];
    for (const p of patch.prerequisites) {
      if (await curriculum.getSkillById(p)) checked.push(p);
    }
    skill.prerequisites = checked;
  }
  return await curriculum.upsertSkill(skill);
}

// ----- Skill prerequisite graph -----
export async function listSkillPrerequisites(skillId?: string): Promise<SkillPrerequisite[]> {
  const all = await getPersistence().standards.listSkillPrerequisites();
  return skillId ? all.filter((p) => p.skillId === skillId) : all;
}

export async function addSkillPrerequisite(input: {
  skillId: string;
  prerequisiteSkillId: string;
  strength: "hard" | "soft";
  notes?: string | null;
}): Promise<SkillPrerequisite | null> {
  const curriculum = getPersistence().curriculum;
  const standards = getPersistence().standards;
  const skillRec = await curriculum.getSkillById(input.skillId);
  if (!skillRec || !(await curriculum.getSkillById(input.prerequisiteSkillId))) {
    return null;
  }
  if (input.skillId === input.prerequisiteSkillId) return null;
  // Refuse to create a cycle. Walk the SkillPrerequisite *rows* upward from
  // the proposed prereq — they are the source of truth. (Skill.prerequisites
  // is a denormalized fast-read view that the API mirrors on insert, so it
  // can drift if an import or backfill writes one but not the other; the
  // SkillPrerequisite table is what addSkillPrerequisite itself owns.)
  // Also refuse duplicate edges so the graph stays a clean DAG.
  const allEdges = await standards.listSkillPrerequisites();
  const prereqsBySkill = new Map<string, string[]>();
  for (const edge of allEdges) {
    if (edge.skillId === input.skillId && edge.prerequisiteSkillId === input.prerequisiteSkillId) {
      return null; // duplicate edge
    }
    const list = prereqsBySkill.get(edge.skillId) ?? [];
    list.push(edge.prerequisiteSkillId);
    prereqsBySkill.set(edge.skillId, list);
  }
  const visited = new Set<string>();
  const stack: string[] = [input.prerequisiteSkillId];
  while (stack.length) {
    const cur = stack.pop()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    if (cur === input.skillId) return null; // cycle
    const ups = prereqsBySkill.get(cur) ?? [];
    stack.push(...ups);
  }
  const rec: SkillPrerequisite = {
    id: newId("skp"),
    skillId: input.skillId,
    prerequisiteSkillId: input.prerequisiteSkillId,
    strength: input.strength,
    notes: input.notes ?? null,
    createdAt: nowIso(),
  };
  await standards.upsertSkillPrerequisite(rec);
  // Mirror the denormalized fast-read view on the skill.
  if (!skillRec.prerequisites.includes(input.prerequisiteSkillId)) {
    await curriculum.upsertSkill({
      ...skillRec,
      prerequisites: [...skillRec.prerequisites, input.prerequisiteSkillId],
    });
  }
  return rec;
}

// ----- Skill versions -----
export async function listSkillVersions(skillId?: string): Promise<SkillVersion[]> {
  const all = await getPersistence().standards.listSkillVersions();
  return (skillId ? all.filter((v) => v.skillId === skillId) : all).sort((a, b) =>
    b.effectiveAt.localeCompare(a.effectiveAt),
  );
}

export async function getCurrentSkillVersion(skillId: string): Promise<SkillVersion | null> {
  for (const v of await getPersistence().standards.listSkillVersions()) {
    if (v.skillId === skillId && v.isCurrent) return v;
  }
  return null;
}

export async function createSkillVersion(input: {
  skillId: string;
  version: string;
  objectiveSummary: string;
}): Promise<SkillVersion | null> {
  const standards = getPersistence().standards;
  if (!(await getPersistence().curriculum.getSkillById(input.skillId))) return null;
  // Mark prior versions non-current (persist each flip).
  for (const v of await standards.listSkillVersions()) {
    if (v.skillId === input.skillId && v.isCurrent) {
      await standards.upsertSkillVersion({ ...v, isCurrent: false });
    }
  }
  const rec: SkillVersion = {
    id: newId("skv"),
    skillId: input.skillId,
    version: input.version,
    effectiveAt: nowIso(),
    objectiveSummary: input.objectiveSummary,
    isCurrent: true,
  };
  return await standards.upsertSkillVersion(rec);
}

// ----- Curriculum maps -----
export async function listCurriculumMaps(skillId?: string): Promise<CurriculumMap[]> {
  const all = await getPersistence().standards.listCurriculumMaps();
  return skillId ? all.filter((m) => m.skillId === skillId) : all;
}

export async function addCurriculumMap(input: {
  skillId: string;
  domainId: string;
  standardId: string;
  alignment: "primary" | "supports" | "introduces";
}): Promise<CurriculumMap | null> {
  const standards = getPersistence().standards;
  const [skill, domains, std] = await Promise.all([
    getPersistence().curriculum.getSkillById(input.skillId),
    standards.listDomains(),
    standards.getStandard(input.standardId),
  ]);
  if (!skill || !domains.some((d) => d.id === input.domainId) || !std) {
    return null;
  }
  const rec: CurriculumMap = { id: newId("cmp"), ...input };
  return await standards.upsertCurriculumMap(rec);
}

// ----- Lesson objective templates -----
export async function listLessonObjectiveTemplates(
  skillId?: string,
): Promise<LessonObjectiveTemplate[]> {
  const all = await getPersistence().standards.listLessonObjectiveTemplates();
  return skillId ? all.filter((t) => t.skillId === skillId) : all;
}

export async function getActiveLessonObjectiveTemplate(
  skillId: string,
): Promise<LessonObjectiveTemplate | null> {
  for (const t of await getPersistence().standards.listLessonObjectiveTemplates()) {
    if (t.skillId === skillId && t.status === "active") return t;
  }
  return null;
}

// ----- Assessment blueprints -----
export async function listAssessmentBlueprints(skillId?: string): Promise<AssessmentBlueprint[]> {
  const all = await getPersistence().standards.listAssessmentBlueprints();
  return skillId ? all.filter((b) => b.skillId === skillId) : all;
}

export async function getActiveAssessmentBlueprint(
  skillId: string,
): Promise<AssessmentBlueprint | null> {
  for (const b of await getPersistence().standards.listAssessmentBlueprints()) {
    if (b.skillId === skillId && b.status === "active") return b;
  }
  return null;
}

// ----- Curriculum import jobs -----
export async function listCurriculumImportJobs(): Promise<CurriculumImportJob[]> {
  return (await getPersistence().standards.listImportJobs()).sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
}

export async function getCurriculumImportJob(id: string): Promise<CurriculumImportJob | null> {
  return await getPersistence().standards.getImportJob(id);
}

/**
 * Mock import: synchronously records a "succeeded" job. The real importer
 * will replace this with a queued/running -> succeeded lifecycle, but the
 * BFF + UI contract stays the same. Counts are based on the framework's
 * current state, so the admin sees a non-zero result.
 */
export async function startCurriculumImportJob(input: {
  frameworkSlug: StandardsFrameworkSlug;
  source: string;
  requestedByUserId: string;
}): Promise<CurriculumImportJob> {
  const standards = getPersistence().standards;
  const framework = await getStandardsFrameworkBySlug(input.frameworkSlug);
  const frameworkId = framework?.id;
  const docCount = frameworkId
    ? (await standards.listStandardDocuments()).filter((d) => d.frameworkId === frameworkId).length
    : 0;
  const stdCount = frameworkId
    ? (await standards.listStandards()).filter((s) => s.frameworkId === frameworkId).length
    : 0;
  const rec: CurriculumImportJob = {
    id: newId("cij"),
    frameworkSlug: input.frameworkSlug,
    source: input.source,
    status: framework ? "succeeded" : "failed",
    startedAt: nowIso(),
    completedAt: nowIso(),
    imported: { frameworks: framework ? 1 : 0, documents: docCount, standards: stdCount },
    error: framework ? null : `Unknown framework slug: ${input.frameworkSlug}`,
    requestedByUserId: input.requestedByUserId,
  };
  return await standards.upsertImportJob(rec);
}

// ===== Sprint 27: AI Safety + Moderation =====

import {
  classify as _classify,
  sanitizeHomeworkInput as _sanitize,
  validateLessonPlan as _validatePlan,
  validateTutorResponse as _validateTutor,
  blockedFallbackFor as _blockedFallback,
  DEFAULT_SAFETY_POLICY,
} from "@/lib/ai/safety";
import type {
  BlockedGeneration,
  HomeworkInputAudit,
  HumanReviewCase,
  HumanReviewCaseStatus,
  ModerationEvent,
  SafetyClassification,
  SafetyPolicyVersion,
  SafetySubjectKind,
  TutorResponseAudit,
} from "@/lib/db/types";

export const SAFETY_CLASSIFY = _classify;
export const SAFETY_SANITIZE = _sanitize;
export const SAFETY_VALIDATE_PLAN = _validatePlan;
export const SAFETY_VALIDATE_TUTOR = _validateTutor;
export const SAFETY_BLOCKED_FALLBACK = _blockedFallback;

/** Returns the current active SafetyPolicyVersion (or the default if unseeded). */
export async function getActiveSafetyPolicy(): Promise<SafetyPolicyVersion> {
  for (const p of await getPersistence().safety.listSafetyPolicyVersions()) {
    if (p.status === "active") return p;
  }
  return DEFAULT_SAFETY_POLICY;
}

export async function listSafetyPolicyVersions(): Promise<SafetyPolicyVersion[]> {
  return (await getPersistence().safety.listSafetyPolicyVersions()).sort((a, b) =>
    b.effectiveAt.localeCompare(a.effectiveAt),
  );
}

/**
 * Record a moderation event. When the classification's decision is "review"
 * or "block" with crisis signals, a HumanReviewCase is opened in the same
 * transaction so the admin queue surfaces it.
 */
export async function recordModerationEvent(input: {
  tenantId: string;
  learnerId: string | null;
  subjectKind: SafetySubjectKind;
  subjectRefId: string | null;
  excerpt: string;
  classification: SafetyClassification;
  injectionSignals: ModerationEvent["injectionSignals"];
  crisisSignals: ModerationEvent["crisisSignals"];
  createdByUserId: string | null;
}): Promise<{ event: ModerationEvent; reviewCase: HumanReviewCase | null }> {
  const safety = getPersistence().safety;
  const eventId = newId("modev");
  // Open a review case automatically when the decision is "review", on any
  // crisis signal, or on a "block" decision involving self_harm /
  // adult_contact_risk so a human always sees the most sensitive blocks.
  const decision = input.classification.decision;
  const sensitive = input.classification.categories.some((c) =>
    ["self_harm", "adult_contact_risk", "violence"].includes(c),
  );
  const needsCase =
    decision === "review" || input.crisisSignals.length > 0 || (decision === "block" && sensitive);

  let reviewCase: HumanReviewCase | null = null;
  let reviewCaseId: string | null = null;
  if (needsCase) {
    reviewCaseId = newId("hrc");
    reviewCase = {
      id: reviewCaseId,
      eventId,
      tenantId: input.tenantId,
      learnerId: input.learnerId,
      status: "open",
      assignedToUserId: null,
      resolution: null,
      resolvedByUserId: null,
      resolvedAt: null,
      escalatedAt: input.crisisSignals.length > 0 ? nowIso() : null,
      createdAt: nowIso(),
    };
    await safety.upsertHumanReviewCase(reviewCase);
  }

  const event: ModerationEvent = {
    id: eventId,
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    subjectKind: input.subjectKind,
    subjectRefId: input.subjectRefId,
    // Cap the excerpt to keep the moderation log compact even when the
    // upstream content is large.
    excerpt: input.excerpt.slice(0, 500),
    classification: input.classification,
    injectionSignals: input.injectionSignals,
    crisisSignals: input.crisisSignals,
    createdByUserId: input.createdByUserId,
    reviewCaseId,
    createdAt: nowIso(),
  };
  await safety.appendModerationEvent(event);
  return { event, reviewCase };
}

export async function listModerationEvents(filter?: {
  tenantId?: string;
  decision?: "allow" | "review" | "block";
  limit?: number;
}): Promise<ModerationEvent[]> {
  let arr = await getPersistence().safety.listModerationEvents();
  if (filter?.tenantId) arr = arr.filter((e) => e.tenantId === filter.tenantId);
  if (filter?.decision) arr = arr.filter((e) => e.classification.decision === filter.decision);
  arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  if (filter?.limit) arr = arr.slice(0, filter.limit);
  return arr;
}

export async function getModerationEvent(id: string): Promise<ModerationEvent | null> {
  return await getPersistence().safety.getModerationEvent(id);
}

export async function listHumanReviewCases(filter?: {
  status?: HumanReviewCaseStatus;
  tenantId?: string;
}): Promise<HumanReviewCase[]> {
  let arr = await getPersistence().safety.listHumanReviewCases();
  if (filter?.status) arr = arr.filter((c) => c.status === filter.status);
  if (filter?.tenantId) arr = arr.filter((c) => c.tenantId === filter.tenantId);
  return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getHumanReviewCase(id: string): Promise<HumanReviewCase | null> {
  return await getPersistence().safety.getHumanReviewCase(id);
}

export async function updateHumanReviewCase(
  id: string,
  patch: {
    status?: HumanReviewCaseStatus;
    assignedToUserId?: string | null;
    resolution?: string | null;
    resolvedByUserId?: string | null;
  },
): Promise<HumanReviewCase | null> {
  const safety = getPersistence().safety;
  const existing = await safety.getHumanReviewCase(id);
  if (!existing) return null;
  const c: HumanReviewCase = { ...existing };
  if (patch.status !== undefined) {
    c.status = patch.status;
    if ((patch.status === "resolved_allow" || patch.status === "resolved_block") && !c.resolvedAt) {
      c.resolvedAt = nowIso();
    }
    if (patch.status === "escalated" && !c.escalatedAt) c.escalatedAt = nowIso();
  }
  if (patch.assignedToUserId !== undefined) c.assignedToUserId = patch.assignedToUserId;
  if (patch.resolution !== undefined) c.resolution = patch.resolution;
  if (patch.resolvedByUserId !== undefined) c.resolvedByUserId = patch.resolvedByUserId;
  return await safety.upsertHumanReviewCase(c);
}

export async function recordBlockedGeneration(input: {
  tenantId: string;
  learnerId: string | null;
  subjectKind: SafetySubjectKind;
  reason: string;
  fallbackResponse: string;
}): Promise<BlockedGeneration> {
  const rec: BlockedGeneration = { id: newId("blk"), createdAt: nowIso(), ...input };
  return await getPersistence().safety.appendBlockedGeneration(rec);
}

export async function listBlockedGenerations(tenantId?: string): Promise<BlockedGeneration[]> {
  let arr = await getPersistence().safety.listBlockedGenerations();
  if (tenantId) arr = arr.filter((b) => b.tenantId === tenantId);
  return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function recordTutorResponseAudit(input: {
  tenantId: string;
  learnerId: string;
  contextKind: "lesson_run" | "homework_session";
  contextRefId: string;
  tutorPersona: string;
  excerpt: string;
  classification: SafetyClassification;
}): Promise<TutorResponseAudit> {
  const rec: TutorResponseAudit = {
    id: newId("tra"),
    createdAt: nowIso(),
    ...input,
    excerpt: input.excerpt.slice(0, 500),
  };
  return await getPersistence().safety.appendTutorResponseAudit(rec);
}

export async function recordHomeworkInputAudit(input: {
  tenantId: string;
  learnerId: string;
  homeworkSessionId: string;
  rawExcerpt: string;
  sanitizedExcerpt: string;
  classification: SafetyClassification;
  piiRedacted: boolean;
}): Promise<HomeworkInputAudit> {
  const rec: HomeworkInputAudit = {
    id: newId("hia"),
    createdAt: nowIso(),
    ...input,
    rawExcerpt: input.rawExcerpt.slice(0, 500),
    sanitizedExcerpt: input.sanitizedExcerpt.slice(0, 500),
  };
  return await getPersistence().safety.appendHomeworkInputAudit(rec);
}

export async function listTutorResponseAudits(tenantId?: string): Promise<TutorResponseAudit[]> {
  let arr = await getPersistence().safety.listTutorResponseAudits();
  if (tenantId) arr = arr.filter((a) => a.tenantId === tenantId);
  return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listHomeworkInputAudits(tenantId?: string): Promise<HomeworkInputAudit[]> {
  let arr = await getPersistence().safety.listHomeworkInputAudits();
  if (tenantId) arr = arr.filter((a) => a.tenantId === tenantId);
  return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ===== Sprint 28: TTS / Read-Aloud =====

import { getTTSProvider, ttsContentHash, type TTSRequest } from "@/lib/tts/provider";
import type {
  AudioAsset,
  AudioCacheEntry,
  LearnerVoicePreference,
  PronunciationOverride,
  ReadAloudContextKind,
  ReadAloudUsageEvent,
  TTSGenerationJob,
  TTSVoiceId,
} from "@/lib/db/types";

const DEFAULT_VOICE_PREFERENCE: Omit<
  LearnerVoicePreference,
  "learnerId" | "tenantId" | "updatedAt"
> = {
  voiceId: "kid_friendly",
  speed: 1.0,
  enabled: true,
  captionsAlways: false,
};

/** Resolve override set for a tenant (platform-scope first, then tenant-scope). */
async function resolveOverrides(tenantId: string): Promise<PronunciationOverride[]> {
  const all = await getPersistence().audio.listPronunciationOverrides();
  return all
    .filter((o) => o.scope === "platform" || o.tenantId === tenantId)
    .sort((a, b) => a.token.localeCompare(b.token));
}

export async function listPronunciationOverrides(
  tenantId?: string,
): Promise<PronunciationOverride[]> {
  let arr = await getPersistence().audio.listPronunciationOverrides();
  if (tenantId) arr = arr.filter((o) => o.scope === "platform" || o.tenantId === tenantId);
  return arr.sort((a, b) => a.token.localeCompare(b.token));
}

export async function createPronunciationOverride(input: {
  tenantId: string;
  token: string;
  replacement: string;
  encoding: "ipa" | "x-sampa" | "plain";
  scope: "platform" | "tenant";
  notes: string | null;
  createdByUserId: string;
}): Promise<PronunciationOverride> {
  const rec: PronunciationOverride = {
    id: newId("pron"),
    createdAt: nowIso(),
    ...input,
  };
  return await getPersistence().audio.upsertPronunciationOverride(rec);
}

export async function updatePronunciationOverride(
  id: string,
  patch: Partial<Pick<PronunciationOverride, "replacement" | "encoding" | "notes" | "scope">>,
): Promise<PronunciationOverride | null> {
  const audio = getPersistence().audio;
  const existing = await audio.getPronunciationOverride(id);
  if (!existing) return null;
  const o: PronunciationOverride = { ...existing };
  if (patch.replacement !== undefined) o.replacement = patch.replacement;
  if (patch.encoding !== undefined) o.encoding = patch.encoding;
  if (patch.notes !== undefined) o.notes = patch.notes;
  if (patch.scope !== undefined) o.scope = patch.scope;
  return await audio.upsertPronunciationOverride(o);
}

export async function getPronunciationOverride(
  id: string,
): Promise<PronunciationOverride | null> {
  return await getPersistence().audio.getPronunciationOverride(id);
}

export async function getLearnerVoicePreference(
  learnerId: string,
): Promise<LearnerVoicePreference | null> {
  return await getPersistence().audio.getVoicePreference(learnerId);
}

export async function upsertLearnerVoicePreference(input: {
  learnerId: string;
  tenantId: string;
  voiceId?: TTSVoiceId;
  speed?: number;
  enabled?: boolean;
  captionsAlways?: boolean;
}): Promise<LearnerVoicePreference> {
  const existing = await getPersistence().audio.getVoicePreference(input.learnerId);
  const merged: LearnerVoicePreference = {
    learnerId: input.learnerId,
    tenantId: input.tenantId,
    voiceId: input.voiceId ?? existing?.voiceId ?? DEFAULT_VOICE_PREFERENCE.voiceId,
    // Clamp speed to keep audio intelligible.
    speed: Math.min(
      2,
      Math.max(0.5, input.speed ?? existing?.speed ?? DEFAULT_VOICE_PREFERENCE.speed),
    ),
    enabled: input.enabled ?? existing?.enabled ?? DEFAULT_VOICE_PREFERENCE.enabled,
    captionsAlways:
      input.captionsAlways ?? existing?.captionsAlways ?? DEFAULT_VOICE_PREFERENCE.captionsAlways,
    updatedAt: nowIso(),
  };
  return await getPersistence().audio.upsertVoicePreference(merged);
}

function cacheKey(tenantId: string, languageCode: string, contentHash: string) {
  return `${tenantId}:${languageCode}:${contentHash}`;
}

/**
 * Core TTS pipeline:
 *  1. Resolve effective voice + override set.
 *  2. Compute content hash; check cache.
 *  3. If hit → bump cache, return existing AudioAsset and a "cached_hit" job.
 *  4. Else → call provider, persist AudioAsset, create cache entry + success
 *     job. Provider failures persist a "failed" job and bubble the error so
 *     the caller can fall back to transcript-only rendering.
 */
export async function generateTTS(input: {
  tenantId: string;
  learnerId: string | null;
  text: string;
  voiceId?: TTSVoiceId;
  languageCode?: string;
  speed?: number;
}): Promise<{ job: TTSGenerationJob; asset: AudioAsset }> {
  const audio = getPersistence().audio;
  const languageCode = input.languageCode ?? "en-US";
  const pref = input.learnerId ? await getLearnerVoicePreference(input.learnerId) : null;
  const voiceId = input.voiceId ?? pref?.voiceId ?? "kid_friendly";
  const speed = Math.min(2, Math.max(0.5, input.speed ?? pref?.speed ?? 1.0));
  const overrides = (await resolveOverrides(input.tenantId)).map((o) => ({
    token: o.token,
    replacement: o.replacement,
    encoding: o.encoding,
  }));
  const hash = ttsContentHash({
    text: input.text,
    voiceId,
    languageCode,
    speed,
    pronunciationOverrides: overrides,
  });

  const key = cacheKey(input.tenantId, languageCode, hash);
  const cached = await audio.getCacheEntry(key);
  if (cached) {
    const existing = await audio.getAudioAsset(cached.audioAssetId);
    if (existing) {
      await audio.upsertCacheEntry(key, { ...cached, hits: cached.hits + 1, lastHitAt: nowIso() });
      const jobId = newId("tts");
      const job: TTSGenerationJob = {
        id: jobId,
        tenantId: input.tenantId,
        learnerId: input.learnerId,
        text: input.text,
        voiceId,
        languageCode,
        status: "cached_hit",
        audioAssetId: existing.id,
        errorMessage: null,
        createdAt: nowIso(),
        completedAt: nowIso(),
      };
      await audio.upsertTtsJob(job);
      return { job, asset: existing };
    }
  }

  const jobId = newId("tts");
  const job: TTSGenerationJob = {
    id: jobId,
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    text: input.text,
    voiceId,
    languageCode,
    status: "running",
    audioAssetId: null,
    errorMessage: null,
    createdAt: nowIso(),
    completedAt: null,
  };
  await audio.upsertTtsJob(job);

  try {
    const provider = getTTSProvider();
    const req: TTSRequest = {
      text: input.text,
      voiceId,
      languageCode,
      speed,
      pronunciationOverrides: overrides,
    };
    const result = await provider.generate(req);
    const assetId = newId("aud");
    const asset: AudioAsset = {
      id: assetId,
      tenantId: input.tenantId,
      contentHash: hash,
      text: input.text,
      voiceId,
      languageCode,
      format: "mp3",
      durationMs: result.durationMs,
      storageKey: result.storageKey,
      captions: result.captions,
      costMicroUsd: result.costMicroUsd,
      provider: result.provider,
      createdAt: nowIso(),
    };
    await audio.upsertAudioAsset(asset);
    const entry: AudioCacheEntry = {
      contentHash: hash,
      tenantId: input.tenantId,
      languageCode,
      audioAssetId: assetId,
      hits: 0,
      lastHitAt: nowIso(),
    };
    await audio.upsertCacheEntry(key, entry);
    job.status = "completed";
    job.audioAssetId = assetId;
    job.completedAt = nowIso();
    await audio.upsertTtsJob(job);
    return { job, asset };
  } catch (e) {
    job.status = "failed";
    job.errorMessage = e instanceof Error ? e.message : "TTS failed.";
    job.completedAt = nowIso();
    await audio.upsertTtsJob(job);
    throw e;
  }
}

export async function getAudioAsset(id: string): Promise<AudioAsset | null> {
  return await getPersistence().audio.getAudioAsset(id);
}

export async function listAudioAssets(tenantId?: string): Promise<AudioAsset[]> {
  let arr = await getPersistence().audio.listAudioAssets();
  if (tenantId) arr = arr.filter((a) => a.tenantId === tenantId);
  return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function recordReadAloudUsage(input: {
  tenantId: string;
  learnerId: string | null;
  audioAssetId: string;
  contextKind: ReadAloudContextKind;
  contextRefId: string | null;
  cacheHit: boolean;
  costMicroUsd: number;
}): Promise<ReadAloudUsageEvent> {
  const rec: ReadAloudUsageEvent = {
    id: newId("rau"),
    createdAt: nowIso(),
    ...input,
  };
  return await getPersistence().audio.appendReadAloudUsage(rec);
}

export async function listReadAloudUsage(tenantId?: string): Promise<ReadAloudUsageEvent[]> {
  let arr = await getPersistence().audio.listReadAloudUsage();
  if (tenantId) arr = arr.filter((e) => e.tenantId === tenantId);
  return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function summarizeAudioUsage(tenantId?: string): Promise<{
  totalPlaybacks: number;
  totalCostMicroUsd: number;
  cacheHitRate: number;
  uniqueAssets: number;
}> {
  const events = await listReadAloudUsage(tenantId);
  const total = events.length;
  const hits = events.filter((e) => e.cacheHit).length;
  const cost = events.reduce((a, e) => a + e.costMicroUsd, 0);
  const unique = new Set(events.map((e) => e.audioAssetId)).size;
  return {
    totalPlaybacks: total,
    totalCostMicroUsd: cost,
    cacheHitRate: total === 0 ? 0 : hits / total,
    uniqueAssets: unique,
  };
}

// ===== Sprint 29: Rostering / SIS / Sync / Notifications =====

import type {
  CalendarEvent,
  Classroom,
  Course,
  DigestSchedule,
  Enrollment,
  ExternalRosterMapping,
  LessonSyncState,
  Notification,
  NotificationChannel,
  NotificationDelivery,
  NotificationPreference,
  NotificationType,
  RosterImportError,
  RosterImportJob,
  RosterImportSource,
  School,
  SISConnection,
} from "@/lib/db/types";

// ===== Admin domain (ADR 0007 step 11) =====
// Schools, classrooms, enrollments, teacher assignments — all routed
// through the persistence adapter.

export async function listSchools(tenantId?: string): Promise<School[]> {
  return getPersistence().admin.listSchools(tenantId);
}

export async function getSchool(id: string): Promise<School | null> {
  return getPersistence().admin.getSchoolById(id);
}

export async function listClassrooms(opts: {
  tenantId: string;
  schoolId?: string;
  teacherUserId?: string;
}): Promise<Classroom[]> {
  return getPersistence().admin.listClassrooms(opts);
}

export async function getClassroom(id: string, tenantId: string): Promise<Classroom | null> {
  return getPersistence().admin.getClassroomById(id, tenantId);
}

export async function createClassroom(input: {
  tenantId: string;
  schoolId: string;
  name: string;
  gradeBand: Classroom["gradeBand"];
  teacherUserId: string;
  courseId: string | null;
}): Promise<Classroom> {
  const rec: Classroom = { id: newId("cls"), createdAt: nowIso(), ...input };
  return getPersistence().admin.upsertClassroom(rec);
}

export async function updateClassroom(
  id: string,
  tenantId: string,
  patch: Partial<Pick<Classroom, "name" | "gradeBand" | "teacherUserId" | "courseId">>,
): Promise<Classroom | null> {
  const existing = await getClassroom(id, tenantId);
  if (!existing) return null;
  const next: Classroom = {
    ...existing,
    name: patch.name ?? existing.name,
    gradeBand: patch.gradeBand ?? existing.gradeBand,
    teacherUserId: patch.teacherUserId ?? existing.teacherUserId,
    courseId: patch.courseId !== undefined ? patch.courseId : existing.courseId,
  };
  return getPersistence().admin.upsertClassroom(next);
}

export async function listEnrollments(classroomId: string): Promise<Enrollment[]> {
  return getPersistence().admin.listEnrollmentsForClassroom(classroomId);
}

/** Sprint A4: teacher personal-calendar events, ascending by date. */
export async function listCalendarEventsForTeacher(
  teacherUserId: string,
  tenantId: string,
  opts?: { fromIso?: string; limit?: number },
): Promise<CalendarEvent[]> {
  return getPersistence().admin.listCalendarEventsForTeacher(teacherUserId, tenantId, opts);
}

export async function upsertCalendarEvent(
  input: Omit<CalendarEvent, "id" | "createdAt"> & { id?: string; createdAt?: string },
): Promise<CalendarEvent> {
  const rec: CalendarEvent = {
    id: input.id ?? newId("cal"),
    createdAt: input.createdAt ?? nowIso(),
    tenantId: input.tenantId,
    teacherUserId: input.teacherUserId,
    title: input.title,
    subtitle: input.subtitle,
    type: input.type,
    date: input.date,
    timeLabel: input.timeLabel,
  };
  return getPersistence().admin.upsertCalendarEvent(rec);
}

export async function createEnrollment(
  input: Omit<Enrollment, "id" | "createdAt">,
): Promise<Enrollment> {
  const rec: Enrollment = { id: newId("enr"), createdAt: nowIso(), ...input };
  return getPersistence().admin.upsertEnrollment(rec);
}

/** Idempotent: returns the existing enrollment if (classroomId, subjectId, role) already exists. */
async function ensureEnrollment(input: Omit<Enrollment, "id" | "createdAt">): Promise<{
  rec: Enrollment;
  created: boolean;
}> {
  const existing = await getPersistence().admin.findEnrollmentByNaturalKey({
    classroomId: input.classroomId,
    subjectId: input.subjectId,
    role: input.role,
  });
  if (existing) return { rec: existing, created: false };
  return { rec: await createEnrollment(input), created: true };
}

/**
 * Parse a roster CSV per the (intentionally narrow) AIVO column contract:
 *   role,first_name,last_name,email,external_id,classroom_name,grade_band
 * One header row required. Empty lines + lines starting with # are skipped.
 * Returns rows + parse-time errors (e.g. bad role, missing required field).
 *
 * This is deliberately simpler than full OneRoster v1.2 — we accept a single
 * flat file so a school admin can sanity-test sync before wiring SIS.
 */
type CsvRow = {
  rowNumber: number;
  role: "learner" | "teacher" | "co_teacher";
  firstName: string;
  lastName: string;
  email: string;
  externalId: string;
  classroomName: string;
  gradeBand: Classroom["gradeBand"];
};

function parseRosterCsv(text: string): {
  rows: CsvRow[];
  errors: { rowNumber: number; row: Record<string, string>; message: string }[];
} {
  const lines = text.split(/\r?\n/);
  const rows: CsvRow[] = [];
  const errors: { rowNumber: number; row: Record<string, string>; message: string }[] = [];
  if (lines.length === 0) return { rows, errors };
  const header = lines[0]!.split(",").map((h) => h.trim().toLowerCase());
  const required = [
    "role",
    "first_name",
    "last_name",
    "email",
    "external_id",
    "classroom_name",
    "grade_band",
  ];
  const missingCols = required.filter((c) => !header.includes(c));
  if (missingCols.length > 0) {
    errors.push({
      rowNumber: 1,
      row: { header: header.join(",") },
      message: `Missing columns: ${missingCols.join(", ")}`,
    });
    return { rows, errors };
  }
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i]!;
    if (!raw.trim() || raw.trim().startsWith("#")) continue;
    const cells = raw.split(",").map((c) => c.trim());
    const row: Record<string, string> = {};
    for (let j = 0; j < header.length; j++) row[header[j]!] = cells[j] ?? "";
    const rowNumber = i + 1;
    const role = row.role?.toLowerCase();
    if (role !== "learner" && role !== "teacher" && role !== "co_teacher") {
      errors.push({
        rowNumber,
        row,
        message: `Invalid role "${row.role}". Expected learner | teacher | co_teacher.`,
      });
      continue;
    }
    const gradeBand = row.grade_band as Classroom["gradeBand"];
    if (!["K-2", "3-5", "6-8", "9-12"].includes(gradeBand)) {
      errors.push({ rowNumber, row, message: `Invalid grade_band "${row.grade_band}".` });
      continue;
    }
    for (const f of ["first_name", "last_name", "email", "external_id", "classroom_name"]) {
      if (!row[f]) {
        errors.push({ rowNumber, row, message: `Missing required field: ${f}` });
      }
    }
    if (errors.some((e) => e.rowNumber === rowNumber)) continue;
    rows.push({
      rowNumber,
      role,
      firstName: row.first_name!,
      lastName: row.last_name!,
      email: row.email!,
      externalId: row.external_id!,
      classroomName: row.classroom_name!,
      gradeBand,
    });
  }
  return { rows, errors };
}

/**
 * Run a roster import. When dryRun is true, no entities are persisted but
 * the same parse/validation pipeline runs so the admin can review the
 * counts + error rows before committing.
 */
export async function runRosterImport(input: {
  tenantId: string;
  schoolId: string;
  source: RosterImportSource;
  csvText: string;
  dryRun: boolean;
  createdByUserId: string;
}): Promise<RosterImportJob> {
  const rostering = getPersistence().rostering;
  const admin = getPersistence().admin;
  const school = await getSchool(input.schoolId);
  if (!school || school.tenantId !== input.tenantId) {
    const errId = newId("job");
    const failed: RosterImportJob = {
      id: errId,
      tenantId: input.tenantId,
      schoolId: input.schoolId,
      source: input.source,
      status: "failed",
      totalRows: 0,
      createdRows: 0,
      updatedRows: 0,
      skippedRows: 0,
      errorRows: 0,
      dryRun: input.dryRun,
      createdByUserId: input.createdByUserId,
      createdAt: nowIso(),
      completedAt: nowIso(),
    };
    return await rostering.upsertImportJob(failed);
  }
  const { rows, errors: parseErrors } = parseRosterCsv(input.csvText);
  const job: RosterImportJob = {
    id: newId("job"),
    tenantId: input.tenantId,
    schoolId: input.schoolId,
    source: input.source,
    status: input.dryRun ? "dry_run" : "running",
    totalRows: rows.length + parseErrors.length,
    createdRows: 0,
    updatedRows: 0,
    skippedRows: 0,
    errorRows: parseErrors.length,
    dryRun: input.dryRun,
    createdByUserId: input.createdByUserId,
    createdAt: nowIso(),
    completedAt: null,
  };
  // The job is persisted once at the end with its final counts (in-place
  // counter mutation below no longer relies on a shared Map reference).
  for (const err of parseErrors) {
    const errRec: RosterImportError = {
      id: newId("rerr"),
      jobId: job.id,
      rowNumber: err.rowNumber,
      row: err.row,
      message: err.message,
    };
    await rostering.appendImportError(errRec);
  }

  // Track classrooms we've materialized this run so multiple roster rows
  // pointing at the same "Mrs. Smith 4A" share one classroom record.
  const classroomByName = new Map<string, Classroom>();
  for (const c of await admin.listClassrooms({
    tenantId: input.tenantId,
    schoolId: input.schoolId,
  })) {
    classroomByName.set(c.name, c);
  }

  for (const row of rows) {
    try {
      let classroom = classroomByName.get(row.classroomName) ?? null;
      // First non-learner row encountered claims teacherUserId; learner rows
      // alone don't have enough info to bind a teacher, so we keep a stub
      // teacherUserId of `pending` until a teacher row lands. If a teacher
      // row arrives after a learner row created the classroom, promote
      // teacherUserId from `pending` so the teacher dashboard sees the
      // class instead of leaving it orphaned.
      if (!classroom) {
        if (input.dryRun) {
          job.createdRows += 1;
          continue;
        }
        classroom = await createClassroom({
          tenantId: input.tenantId,
          schoolId: input.schoolId,
          name: row.classroomName,
          gradeBand: row.gradeBand,
          teacherUserId: row.role === "teacher" ? row.externalId : "pending",
          courseId: null,
        });
        classroomByName.set(classroom.name, classroom);
      } else if (!input.dryRun && row.role === "teacher" && classroom.teacherUserId === "pending") {
        classroom = { ...classroom, teacherUserId: row.externalId };
        classroomByName.set(classroom.name, classroom);
        // Persist the teacher promotion so a learner-row-created classroom is
        // no longer orphaned (durable in both backends).
        await admin.upsertClassroom(classroom);
      }
      if (input.dryRun) {
        job.createdRows += 1;
        continue;
      }
      const enrollRole: Enrollment["role"] =
        row.role === "teacher" ? "teacher" : row.role === "co_teacher" ? "co_teacher" : "learner";
      const { created } = await ensureEnrollment({
        tenantId: input.tenantId,
        classroomId: classroom.id,
        subjectId: row.externalId,
        role: enrollRole,
      });
      if (created) job.createdRows += 1;
      else job.skippedRows += 1;
    } catch (e) {
      job.errorRows += 1;
      const errRec: RosterImportError = {
        id: newId("rerr"),
        jobId: job.id,
        rowNumber: row.rowNumber,
        row: row as unknown as Record<string, string>,
        message: e instanceof Error ? e.message : "Unknown error.",
      };
      await rostering.appendImportError(errRec);
    }
  }
  job.status = input.dryRun
    ? "dry_run"
    : job.errorRows > 0 && job.createdRows === 0
      ? "failed"
      : "completed";
  job.completedAt = nowIso();
  return await rostering.upsertImportJob(job);
}

export async function getRosterImportJob(
  jobId: string,
  tenantId: string,
): Promise<RosterImportJob | null> {
  const j = await getPersistence().rostering.getImportJobById(jobId);
  return j && j.tenantId === tenantId ? j : null;
}

/** Platform-admin escape hatch: skip tenant scoping. Caller MUST gate on role. */
export async function getRosterImportJobAny(jobId: string): Promise<RosterImportJob | null> {
  return await getPersistence().rostering.getImportJobById(jobId);
}

export async function listRosterImportJobs(
  tenantId: string,
  schoolId?: string,
): Promise<RosterImportJob[]> {
  let arr = await getPersistence().rostering.listImportJobsForTenant(tenantId);
  if (schoolId) arr = arr.filter((j) => j.schoolId === schoolId);
  return arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function listRosterImportErrors(jobId: string): Promise<RosterImportError[]> {
  return (await getPersistence().rostering.listImportErrors(jobId)).sort(
    (a, b) => a.rowNumber - b.rowNumber,
  );
}

export async function listCourses(tenantId: string, schoolId?: string): Promise<Course[]> {
  let arr = await getPersistence().rostering.listCoursesForTenant(tenantId);
  if (schoolId) arr = arr.filter((c) => c.schoolId === schoolId);
  return arr.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listSISConnections(tenantId: string): Promise<SISConnection[]> {
  return (await getPersistence().rostering.listSISConnectionsForTenant(tenantId)).sort((a, b) =>
    a.label.localeCompare(b.label),
  );
}

export async function listExternalRosterMappings(
  connectionId: string,
): Promise<ExternalRosterMapping[]> {
  return await getPersistence().rostering.listExternalMappingsForConnection(connectionId);
}

/** Multi-device lesson sync — optimistic concurrency on `version`. */
export async function getLessonSyncState(
  lessonRunId: string,
  tenantId: string,
): Promise<LessonSyncState | null> {
  const s = await getPersistence().rostering.getLessonSyncState(lessonRunId);
  return s && s.tenantId === tenantId ? s : null;
}

export async function putLessonSyncState(input: {
  lessonRunId: string;
  tenantId: string;
  learnerId: string;
  /** Caller's last-known version. The server rejects if the stored version
   * has moved past `baseVersion` since the caller last read it. */
  baseVersion: number;
  state: Record<string, unknown>;
  deviceId: string;
}): Promise<
  { ok: true; state: LessonSyncState } | { ok: false; current: LessonSyncState | null }
> {
  const rostering = getPersistence().rostering;
  const existing = await rostering.getLessonSyncState(input.lessonRunId);
  if (existing) {
    if (existing.tenantId !== input.tenantId) return { ok: false, current: null };
    // Lesson runs are bound to a single learner at creation time. A caller
    // with scope to learner A must never overwrite learner B's run even if
    // they happen to know lessonRunId — guard before the version check.
    if (existing.learnerId !== input.learnerId) return { ok: false, current: null };
    if (existing.version !== input.baseVersion) return { ok: false, current: existing };
    const bumped: LessonSyncState = {
      ...existing,
      version: existing.version + 1,
      state: input.state,
      lastWriterDeviceId: input.deviceId,
      updatedAt: nowIso(),
    };
    return { ok: true, state: await rostering.upsertLessonSyncState(bumped) };
  }
  if (input.baseVersion !== 0) return { ok: false, current: null };
  const next: LessonSyncState = {
    lessonRunId: input.lessonRunId,
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    version: 1,
    state: input.state,
    lastWriterDeviceId: input.deviceId,
    updatedAt: nowIso(),
  };
  return { ok: true, state: await rostering.upsertLessonSyncState(next) };
}

/**
 * Default preferences when a user has never saved any: in-app on for every
 * type, email on for parent_progress_summary + safety_review_required, push
 * off everywhere (no device tokens yet).
 */
const DEFAULT_NOTIFICATION_TYPES: NotificationType[] = [
  "parent_progress_summary",
  "baseline_completed",
  "lesson_completed",
  "teacher_assignment_created",
  "teacher_assignment_due",
  "streak_reminder",
  "quest_unlocked",
  "iep_extraction_ready",
  "data_request_completed",
  "billing_notice",
  "safety_review_required",
  // Sprint C-13 — brain evolution notifications.
  "brain_profile_ready",
  "brain_profile_changed",
  // Sprint C-16 — contributor feedback loop.
  "contribution_acknowledged",
];

/** Types that default to ALSO emailing (in addition to in-app). The C-13 brain
 *  notifications are care-not-surveillance moments worth one warm email: the
 *  profile being ready for first review (SCREEN 0) and a structural change the
 *  parent should re-acknowledge. Mastery moves never get here — they are never
 *  their own notification. The parent can opt out of either channel. */
const EMAIL_BY_DEFAULT: ReadonlySet<NotificationType> = new Set<NotificationType>([
  "parent_progress_summary",
  "safety_review_required",
  "brain_profile_ready",
  "brain_profile_changed",
  // C-16 — the contributor "your input shaped X" note is the single
  // highest-leverage retention moment for teachers/therapists; it earns one
  // warm email by default (the contributor can opt out of either channel).
  "contribution_acknowledged",
]);

function defaultPreferenceMap(): Record<string, boolean> {
  const m: Record<string, boolean> = {};
  for (const t of DEFAULT_NOTIFICATION_TYPES) {
    m[`${t}:in_app`] = true;
    m[`${t}:email`] = EMAIL_BY_DEFAULT.has(t);
    m[`${t}:push`] = false;
  }
  return m;
}

export async function getNotificationPreference(
  userId: string,
  tenantId: string,
): Promise<NotificationPreference> {
  const existing = await getPersistence().notifications.getPreference(userId);
  if (existing) return existing;
  // Create on read so the UI always has a row to render. Saves an explicit
  // "create defaults" call across BFFs.
  const created: NotificationPreference = {
    userId,
    tenantId,
    preferences: defaultPreferenceMap(),
    quietHours: null,
    digestCadence: "weekly",
    updatedAt: nowIso(),
  };
  return await getPersistence().notifications.upsertPreference(created);
}

export async function updateNotificationPreference(
  userId: string,
  tenantId: string,
  patch: Partial<Pick<NotificationPreference, "preferences" | "quietHours" | "digestCadence">>,
): Promise<NotificationPreference> {
  const pref = await getNotificationPreference(userId, tenantId);
  const next: NotificationPreference = { ...pref };
  if (patch.preferences) next.preferences = { ...pref.preferences, ...patch.preferences };
  if (patch.quietHours !== undefined) next.quietHours = patch.quietHours;
  if (patch.digestCadence !== undefined) next.digestCadence = patch.digestCadence;
  next.updatedAt = nowIso();
  return await getPersistence().notifications.upsertPreference(next);
}

/**
 * Persist a notification + dispatch a delivery record for each enabled
 * channel. The dispatch is "mock-send" — in production this is replaced by
 * a real provider call. Sensitive learner-context never includes raw IEP
 * text (callers must pass already-redacted body strings).
 *
 * Routed through the persistence adapter (ADR 0007). The adapter is
 * memory-backed by default; flip AIVO_PERSISTENCE_NOTIFICATIONS=postgres
 * once `packages/db` ships the notifications schema.
 */
export async function createNotification(input: {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  href: string | null;
  learnerId: string | null;
  /** ADR 0020 — the role the recipient must be in to act on this. When set, the
   *  inbox routes them through role-switch before navigating. Optional. */
  targetRole?: Notification["targetRole"];
}): Promise<{ notification: Notification; deliveries: NotificationDelivery[] }> {
  const rec: Notification = {
    id: newId("nfn"),
    tenantId: input.tenantId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body,
    href: input.href,
    learnerId: input.learnerId,
    ...(input.targetRole ? { targetRole: input.targetRole } : {}),
    readAt: null,
    createdAt: nowIso(),
  };
  const pref = await getNotificationPreference(input.userId, input.tenantId);
  const channels: NotificationChannel[] = ["in_app", "email", "push"];
  const deliveries: NotificationDelivery[] = channels.map((ch) => {
    const enabled = pref.preferences[`${input.type}:${ch}`] ?? false;
    return {
      id: newId("ndlv"),
      notificationId: rec.id,
      channel: ch,
      status: enabled ? "sent" : "skipped",
      providerMessageId: enabled ? `mock_${rec.id}_${ch}` : null,
      errorMessage: null,
      attemptedAt: nowIso(),
    };
  });
  return getPersistence().notifications.create({ notification: rec, deliveries });
}

export async function listNotifications(opts: {
  tenantId: string;
  userId: string;
  unreadOnly?: boolean;
}): Promise<Notification[]> {
  return getPersistence().notifications.list(opts);
}

export async function markNotificationsRead(
  userId: string,
  tenantId: string,
  ids: string[],
): Promise<number> {
  return getPersistence().notifications.markRead({ userId, tenantId, ids });
}

export async function listDeliveriesFor(notificationId: string): Promise<NotificationDelivery[]> {
  return getPersistence().notifications.listDeliveries(notificationId);
}

export async function listDigestSchedules(
  tenantId: string,
  userId?: string,
): Promise<DigestSchedule[]> {
  let arr = (await getPersistence().notifications.listDigestSchedules()).filter(
    (d) => d.tenantId === tenantId,
  );
  if (userId) arr = arr.filter((d) => d.userId === userId);
  return arr;
}

// ===== Sprint 30: Billing / AI Cost / Migration =====

import type {
  AIBudget,
  AICostEvent,
  Invoice,
  MigrationJob,
  MigrationRecord,
  Plan,
  Price,
  SeatAssignment,
  SeatLicense,
  Subscription,
} from "@/lib/db/types";

export function listPlans(audience?: Plan["audience"]): Array<{ plan: Plan; prices: Price[] }> {
  const plans = Array.from(db().plans.values()).filter(
    (p) => p.active && (!audience || p.audience === audience),
  );
  return plans.map((plan) => ({
    plan,
    prices: Array.from(db().prices.values()).filter((p) => p.planId === plan.id && p.active),
  }));
}

export function getActiveSubscriptionForTenant(tenantId: string): Subscription | null {
  return (
    Array.from(db().subscriptions.values()).find(
      (s) => s.tenantId === tenantId && s.status !== "canceled",
    ) ?? null
  );
}

/**
 * Idempotent subscribe: if the tenant already has an active subscription on
 * the requested price, returns it unchanged. Otherwise cancels any prior
 * active sub (cancel-at-period-end semantics — kept canceled in mock for
 * simplicity) and creates a new trialing/active sub. Mirrors what a
 * Stripe webhook handler would do.
 */
export function subscribeTenant(input: {
  tenantId: string;
  ownerUserId: string;
  planId: string;
  priceId: string;
}): { subscription: Subscription; invoice: Invoice | null } {
  const store = db();
  const plan = store.plans.get(input.planId);
  const price = store.prices.get(input.priceId);
  if (!plan || !price || price.planId !== plan.id) {
    throw new Error("Invalid plan or price.");
  }
  // Plan audience must match tenant type. Without this gate a family tenant
  // could subscribe to a school/district plan by guessing IDs.
  const tenant = store.tenants.get(input.tenantId);
  if (!tenant) {
    throw new Error("Invalid tenant.");
  }
  const tenantTypeMatchesAudience =
    (plan.audience === "family" && tenant.type === "family") ||
    (plan.audience === "school" && tenant.type === "school") ||
    (plan.audience === "district" && tenant.type === "district");
  if (!tenantTypeMatchesAudience) {
    throw new Error("Plan audience does not match tenant type.");
  }
  const existing = getActiveSubscriptionForTenant(input.tenantId);
  if (existing && existing.priceId === input.priceId) {
    return { subscription: existing, invoice: null };
  }
  if (existing) {
    existing.status = "canceled";
    existing.canceledAt = nowIso();
  }
  const now = new Date();
  const trialEnd =
    price.trialDays > 0 ? new Date(now.getTime() + price.trialDays * 86400_000) : null;
  const periodEnd = new Date(now);
  if (price.interval === "monthly") periodEnd.setMonth(periodEnd.getMonth() + 1);
  else periodEnd.setFullYear(periodEnd.getFullYear() + 1);
  const sub: Subscription = {
    id: newId("sub"),
    tenantId: input.tenantId,
    ownerUserId: input.ownerUserId,
    planId: plan.id,
    priceId: price.id,
    status: price.trialDays > 0 ? "trialing" : "active",
    trialEndAt: trialEnd ? trialEnd.toISOString() : null,
    currentPeriodStartAt: now.toISOString(),
    currentPeriodEndAt: periodEnd.toISOString(),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    externalCustomerId: `mock_cus_${input.tenantId}`,
    createdAt: now.toISOString(),
  };
  store.subscriptions.set(sub.id, sub);
  // Issue an open invoice immediately for paid (non-trial) periods so the
  // platform billing screen has data to render. Trials issue $0 paid invoices
  // so the audit trail is complete.
  const invoice: Invoice = {
    id: newId("inv"),
    subscriptionId: sub.id,
    tenantId: sub.tenantId,
    amountCents: sub.status === "trialing" ? 0 : price.amountCents,
    currency: price.currency,
    status: sub.status === "trialing" ? "paid" : "open",
    periodStartAt: sub.currentPeriodStartAt,
    periodEndAt: sub.currentPeriodEndAt,
    paidAt: sub.status === "trialing" ? now.toISOString() : null,
    number: `INV-${Date.now().toString(36).toUpperCase()}`,
    createdAt: now.toISOString(),
  };
  store.invoices.set(invoice.id, invoice);
  // School/district plans get a seat license sized to plan.maxSeats.
  if (plan.audience !== "family" && plan.maxSeats) {
    const lic: SeatLicense = {
      id: newId("lic"),
      tenantId: sub.tenantId,
      subscriptionId: sub.id,
      totalSeats: plan.maxSeats,
      createdAt: now.toISOString(),
    };
    store.seatLicenses.set(lic.id, lic);
  }
  return { subscription: sub, invoice };
}

export function cancelSubscription(
  subscriptionId: string,
  tenantId: string,
  atPeriodEnd = true,
): Subscription | null {
  const sub = db().subscriptions.get(subscriptionId);
  if (!sub || sub.tenantId !== tenantId) return null;
  if (atPeriodEnd) {
    sub.cancelAtPeriodEnd = true;
    return sub;
  }
  sub.status = "canceled";
  sub.canceledAt = nowIso();
  return sub;
}

export function listInvoicesForTenant(tenantId: string): Invoice[] {
  return Array.from(db().invoices.values())
    .filter((i) => i.tenantId === tenantId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listSeatLicensesForTenant(
  tenantId: string,
): Array<{ license: SeatLicense; assigned: number; remaining: number }> {
  const licenses = Array.from(db().seatLicenses.values()).filter((l) => l.tenantId === tenantId);
  return licenses.map((license) => {
    const assigned = Array.from(db().seatAssignments.values()).filter(
      (a) => a.licenseId === license.id && !a.revokedAt,
    ).length;
    return { license, assigned, remaining: license.totalSeats - assigned };
  });
}

export function listSeatAssignments(licenseId: string): SeatAssignment[] {
  return Array.from(db().seatAssignments.values()).filter((a) => a.licenseId === licenseId);
}

export function assignSeat(input: {
  licenseId: string;
  tenantId: string;
  subjectId: string;
  subjectKind: SeatAssignment["subjectKind"];
}):
  | { ok: true; assignment: SeatAssignment }
  | {
      ok: false;
      reason: "license_not_found" | "subject_not_in_tenant" | "full" | "already_assigned";
    } {
  const lic = db().seatLicenses.get(input.licenseId);
  if (!lic || lic.tenantId !== input.tenantId) return { ok: false, reason: "license_not_found" };
  // The subject must belong to the same tenant as the license. Otherwise a
  // school admin could spend a seat on a learner that doesn't belong to the
  // school — either by typo or by guessing an ID from another tenant.
  if (input.subjectKind === "learner") {
    const learner = db().learnerProfiles.get(input.subjectId);
    if (!learner || learner.tenantId !== input.tenantId) {
      return { ok: false, reason: "subject_not_in_tenant" };
    }
  } else {
    const member = db().memberships.find(
      (m) => m.userId === input.subjectId && m.tenantId === input.tenantId,
    );
    if (!member) return { ok: false, reason: "subject_not_in_tenant" };
  }
  const existing = Array.from(db().seatAssignments.values()).find(
    (a) => a.licenseId === lic.id && a.subjectId === input.subjectId && !a.revokedAt,
  );
  if (existing) return { ok: false, reason: "already_assigned" };
  const active = Array.from(db().seatAssignments.values()).filter(
    (a) => a.licenseId === lic.id && !a.revokedAt,
  ).length;
  if (active >= lic.totalSeats) return { ok: false, reason: "full" };
  const rec: SeatAssignment = {
    id: newId("seat"),
    licenseId: lic.id,
    tenantId: lic.tenantId,
    subjectId: input.subjectId,
    subjectKind: input.subjectKind,
    assignedAt: nowIso(),
    revokedAt: null,
  };
  db().seatAssignments.set(rec.id, rec);
  return { ok: true, assignment: rec };
}

export function revokeSeat(assignmentId: string, tenantId: string): SeatAssignment | null {
  const a = db().seatAssignments.get(assignmentId);
  if (!a || a.tenantId !== tenantId || a.revokedAt) return null;
  a.revokedAt = nowIso();
  return a;
}

// ----- AI cost controls -----

export async function getAIBudget(tenantId: string): Promise<AIBudget> {
  const billing = getPersistence().billing;
  const existing = await billing.getAIBudget(tenantId);
  if (existing) return existing;
  // Reasonable default for paid tenants: $50/mo soft warn at 80%, no hard
  // stop. Platform tenant is unbounded. Repos lazily materialize so every
  // BFF has a row to read.
  const def: AIBudget = {
    tenantId,
    monthlyCapCents: tenantId === "t_platform" ? null : 5000,
    warnAt: 0.8,
    hardStop: false,
    updatedAt: nowIso(),
  };
  return await billing.upsertAIBudget(def);
}

export async function updateAIBudget(
  tenantId: string,
  patch: Partial<Pick<AIBudget, "monthlyCapCents" | "warnAt" | "hardStop">>,
): Promise<AIBudget> {
  const b = await getAIBudget(tenantId);
  if (patch.monthlyCapCents !== undefined) b.monthlyCapCents = patch.monthlyCapCents;
  if (patch.warnAt !== undefined) b.warnAt = patch.warnAt;
  if (patch.hardStop !== undefined) b.hardStop = patch.hardStop;
  b.updatedAt = nowIso();
  return await getPersistence().billing.upsertAIBudget(b);
}

function periodKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function monthToDateSpendCents(
  tenantId: string,
  at: Date = new Date(),
): Promise<number> {
  const key = periodKey(at);
  // Period maths stays in app code (identical across backends); the store
  // returns the tenant's full cost ledger (uncapped — month-to-date must sum
  // every event, not just the default 200-row page).
  const events = await getPersistence().billing.listAICostEvents({
    tenantId,
    limit: Number.MAX_SAFE_INTEGER,
  });
  let sum = 0;
  for (const ev of events) {
    if (periodKey(new Date(ev.occurredAt)) !== key) continue;
    sum += ev.amountCents;
  }
  return sum;
}

/**
 * Pre-flight check called by AI generators before submitting a prompt to a
 * provider. Returns `allow=true` until the tenant crosses its hard stop. If
 * over the soft `warnAt`, sets `warning=true` so observability can surface
 * the approaching cap without blocking the request.
 */
export async function checkAIBudget(tenantId: string): Promise<{
  allow: boolean;
  warning: boolean;
  spentCents: number;
  capCents: number | null;
  reason: string | null;
}> {
  const budget = await getAIBudget(tenantId);
  const spent = await monthToDateSpendCents(tenantId);
  if (budget.monthlyCapCents === null) {
    return { allow: true, warning: false, spentCents: spent, capCents: null, reason: null };
  }
  const ratio = budget.monthlyCapCents === 0 ? 1 : spent / budget.monthlyCapCents;
  if (budget.hardStop && spent >= budget.monthlyCapCents) {
    return {
      allow: false,
      warning: true,
      spentCents: spent,
      capCents: budget.monthlyCapCents,
      reason: "Monthly AI budget reached. Ask an admin to raise the cap.",
    };
  }
  return {
    allow: true,
    warning: ratio >= budget.warnAt,
    spentCents: spent,
    capCents: budget.monthlyCapCents,
    reason: null,
  };
}

export async function recordAICostEvent(
  input: Omit<AICostEvent, "id" | "occurredAt"> & { occurredAt?: string },
): Promise<AICostEvent> {
  const rec: AICostEvent = {
    id: newId("acos"),
    occurredAt: input.occurredAt ?? nowIso(),
    ...input,
  };
  return await getPersistence().billing.recordAICostEvent(rec);
}

export async function listAICostEvents(opts: {
  tenantId?: string;
  limit?: number;
}): Promise<AICostEvent[]> {
  return await getPersistence().billing.listAICostEvents(opts);
}

// ----- Migration framework -----

/**
 * v1 → v2 migration. We support `dryRun` so an operator can preview the
 * record counts + the source→target id map before committing. Failures are
 * persisted on MigrationRecord so an operator can retry just the failed rows.
 */
export function runMigrationJob(input: {
  source: string;
  kind: MigrationJob["kind"];
  dryRun: boolean;
  createdByUserId: string;
  /** Caller-supplied source records — keeps the mock simple. In prod the
   *  runner streams from the v1 database directly. */
  sourceRecords: Array<{ sourceId: string; payload: Record<string, unknown> }>;
}): MigrationJob {
  const store = db();
  const job: MigrationJob = {
    id: newId("mig"),
    source: input.source,
    kind: input.kind,
    dryRun: input.dryRun,
    status: input.dryRun ? "dry_run" : "running",
    totalRecords: input.sourceRecords.length,
    successRecords: 0,
    failedRecords: 0,
    skippedRecords: 0,
    createdByUserId: input.createdByUserId,
    createdAt: nowIso(),
    completedAt: null,
  };
  store.migrationJobs.set(job.id, job);

  for (const src of input.sourceRecords) {
    let status: MigrationRecord["status"] = "skipped";
    let targetId: string | null = null;
    let message: string | null = null;
    try {
      switch (input.kind) {
        case "users": {
          const email = src.payload.email as string | undefined;
          if (!email) {
            status = "failed";
            message = "Missing email.";
            break;
          }
          if (input.dryRun) {
            status = "migrated";
            targetId = src.sourceId;
            break;
          }
          const tId = (src.payload.tenantId as string | undefined) ?? "t_demo";
          const id = (src.payload.userId as string | undefined) ?? newId("u");
          store.users.set(id, {
            id,
            email,
            displayName: (src.payload.displayName as string) ?? email,
            createdAt: nowIso(),
          });
          targetId = id;
          status = "migrated";
          // Preserve tenant via mapping in message so audit is complete.
          message = `tenantId=${tId}`;
          break;
        }
        case "learners": {
          const tenantId = src.payload.tenantId as string | undefined;
          const name = (src.payload.firstName as string | undefined) ?? src.payload.displayName;
          if (!tenantId || !name) {
            status = "failed";
            message = "Missing tenantId or firstName.";
            break;
          }
          if (input.dryRun) {
            status = "migrated";
            targetId = src.sourceId;
            break;
          }
          // Intentionally avoid colliding userId with learnerId — generate a
          // fresh learner-prefixed id. Source userId, if present, lands on
          // an audit log message rather than the learner record.
          const id = newId("lrn");
          targetId = id;
          status = "migrated";
          message = `tenantId=${tenantId}`;
          break;
        }
        case "iep_documents":
        case "lesson_runs": {
          // Stubs for the other kinds — accepted but not actually written, so
          // operators can validate the connection + counts without polluting
          // the demo dataset.
          status = input.dryRun ? "migrated" : "skipped";
          message = `${input.kind} migration not implemented in mock runner.`;
          break;
        }
      }
    } catch (e) {
      status = "failed";
      message = e instanceof Error ? e.message : "Unknown error.";
    }
    const rec: MigrationRecord = {
      id: newId("mrec"),
      jobId: job.id,
      sourceId: src.sourceId,
      targetId,
      status,
      message,
      attemptedAt: nowIso(),
    };
    store.migrationRecords.set(rec.id, rec);
    if (status === "migrated") job.successRecords += 1;
    else if (status === "failed") job.failedRecords += 1;
    else job.skippedRecords += 1;
  }
  job.status = input.dryRun
    ? "dry_run"
    : job.failedRecords > 0 && job.successRecords === 0
      ? "failed"
      : "completed";
  job.completedAt = nowIso();
  return job;
}

export function listMigrationJobs(): MigrationJob[] {
  return Array.from(db().migrationJobs.values()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getMigrationJob(jobId: string): MigrationJob | null {
  return db().migrationJobs.get(jobId) ?? null;
}

export function listMigrationRecords(jobId: string): MigrationRecord[] {
  return Array.from(db().migrationRecords.values())
    .filter((r) => r.jobId === jobId)
    .sort((a, b) => a.attemptedAt.localeCompare(b.attemptedAt));
}

// ===== Sprint 31: Security / SOC 2 / Privacy law matrix / Incidents =====

import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
  IncidentTimelineEvent,
  RiskRegisterEntry,
  SecurityControl,
  SecurityControlEvidence,
  StatePrivacyControlMapping,
  StatePrivacyRequirement,
  Vendor,
  VulnerabilityReport,
  VulnerabilityStatus,
} from "@/lib/db/types";

// ---- Security controls + evidence (Sprint 4: getPersistence().security) ----

export async function listSecurityControls(): Promise<SecurityControl[]> {
  return await getPersistence().security.listControls();
}
export async function getSecurityControl(id: string): Promise<SecurityControl | null> {
  return await getPersistence().security.getControl(id);
}
export async function createSecurityControl(
  input: Omit<SecurityControl, "id" | "createdAt" | "lastReviewedAt"> & { lastReviewedAt?: string },
): Promise<SecurityControl> {
  const rec: SecurityControl = {
    id: newId("ctl"),
    createdAt: nowIso(),
    lastReviewedAt: input.lastReviewedAt ?? nowIso(),
    code: input.code,
    title: input.title,
    description: input.description,
    criterion: input.criterion,
    owner: input.owner,
    status: input.status,
  };
  return await getPersistence().security.upsertControl(rec);
}
export async function updateSecurityControl(
  id: string,
  patch: Partial<Omit<SecurityControl, "id" | "code" | "createdAt">>,
): Promise<SecurityControl | null> {
  const security = getPersistence().security;
  const c = await security.getControl(id);
  if (!c) return null;
  return await security.upsertControl({ ...c, ...patch, lastReviewedAt: nowIso() });
}

export async function listEvidenceForControl(
  controlId: string,
): Promise<SecurityControlEvidence[]> {
  return await getPersistence().security.listEvidenceForControl(controlId);
}
export async function createControlEvidence(
  input: Omit<SecurityControlEvidence, "id" | "collectedAt">,
): Promise<SecurityControlEvidence | null> {
  const security = getPersistence().security;
  if (!(await security.getControl(input.controlId))) return null;
  const rec: SecurityControlEvidence = { id: newId("evd"), collectedAt: nowIso(), ...input };
  return await security.upsertEvidence(rec);
}

// ---- Risk register ----

export async function listRisks(): Promise<RiskRegisterEntry[]> {
  return await getPersistence().security.listRisks();
}
export async function createRisk(
  input: Omit<RiskRegisterEntry, "id" | "createdAt" | "updatedAt">,
): Promise<RiskRegisterEntry> {
  const rec: RiskRegisterEntry = {
    id: newId("risk"),
    createdAt: nowIso(),
    updatedAt: nowIso(),
    ...input,
  };
  return await getPersistence().security.upsertRisk(rec);
}
export async function updateRisk(
  id: string,
  patch: Partial<Omit<RiskRegisterEntry, "id" | "createdAt">>,
): Promise<RiskRegisterEntry | null> {
  const security = getPersistence().security;
  const r = await security.getRisk(id);
  if (!r) return null;
  return await security.upsertRisk({ ...r, ...patch, updatedAt: nowIso() });
}

// ---- Incidents ----

export async function listIncidents(): Promise<Incident[]> {
  return await getPersistence().security.listIncidents();
}
export async function getIncident(id: string): Promise<Incident | null> {
  return await getPersistence().security.getIncident(id);
}
export async function createIncident(input: {
  title: string;
  summary: string;
  severity: IncidentSeverity;
  commanderUserId: string;
  customerImpact: boolean;
  regulatorNotificationRequired: boolean;
}): Promise<Incident> {
  const security = getPersistence().security;
  const now = nowIso();
  const rec: Incident = {
    id: newId("inc"),
    status: "open",
    detectedAt: now,
    resolvedAt: null,
    createdAt: now,
    ...input,
  };
  await security.upsertIncident(rec);
  // Seed an opening timeline entry so post-mortems start with a detection note.
  const tev: IncidentTimelineEvent = {
    id: newId("itl"),
    incidentId: rec.id,
    authorUserId: input.commanderUserId,
    kind: "detection",
    message: `Incident opened at severity ${input.severity}.`,
    occurredAt: now,
  };
  await security.appendIncidentTimeline(tev);
  return rec;
}
export async function updateIncident(
  id: string,
  patch: Partial<
    Pick<
      Incident,
      | "status"
      | "severity"
      | "summary"
      | "customerImpact"
      | "regulatorNotificationRequired"
      | "resolvedAt"
    >
  >,
): Promise<Incident | null> {
  const security = getPersistence().security;
  const i = await security.getIncident(id);
  if (!i) return null;
  const next: Incident = { ...i, ...patch };
  if (patch.status === "resolved" && !next.resolvedAt) next.resolvedAt = nowIso();
  return await security.upsertIncident(next);
}
export async function appendIncidentTimeline(input: {
  incidentId: string;
  authorUserId: string;
  kind: IncidentTimelineEvent["kind"];
  message: string;
}): Promise<IncidentTimelineEvent | null> {
  const security = getPersistence().security;
  if (!(await security.getIncident(input.incidentId))) return null;
  const rec: IncidentTimelineEvent = { id: newId("itl"), occurredAt: nowIso(), ...input };
  return await security.appendIncidentTimeline(rec);
}
export async function listIncidentTimeline(incidentId: string): Promise<IncidentTimelineEvent[]> {
  return await getPersistence().security.listIncidentTimeline(incidentId);
}

// ---- Vendors ----

export async function listVendors(): Promise<Vendor[]> {
  return await getPersistence().security.listVendors();
}
export async function createVendor(
  input: Omit<Vendor, "id" | "createdAt" | "lastReviewedAt"> & { lastReviewedAt?: string },
): Promise<Vendor> {
  const rec: Vendor = {
    id: newId("vnd"),
    createdAt: nowIso(),
    lastReviewedAt: input.lastReviewedAt ?? nowIso(),
    name: input.name,
    category: input.category,
    dataResidency: input.dataResidency,
    processesLearnerData: input.processesLearnerData,
    dpaSigned: input.dpaSigned,
    riskTier: input.riskTier,
    approved: input.approved,
    notes: input.notes,
  };
  return await getPersistence().security.upsertVendor(rec);
}
export async function updateVendor(
  id: string,
  patch: Partial<Omit<Vendor, "id" | "createdAt">>,
): Promise<Vendor | null> {
  const security = getPersistence().security;
  const v = await security.getVendor(id);
  if (!v) return null;
  return await security.upsertVendor({ ...v, ...patch, lastReviewedAt: nowIso() });
}

// ---- State privacy law matrix ----

export async function listStatePrivacyRequirements(): Promise<StatePrivacyRequirement[]> {
  return await getPersistence().security.listStatePrivacyRequirements();
}
export async function listStatePrivacyMappingsFor(
  requirementId: string,
): Promise<StatePrivacyControlMapping[]> {
  return await getPersistence().security.listStatePrivacyMappingsFor(requirementId);
}
export async function createStatePrivacyMapping(
  input: Omit<StatePrivacyControlMapping, "id" | "reviewedAt">,
): Promise<StatePrivacyControlMapping | null> {
  const security = getPersistence().security;
  if (!(await security.getStatePrivacyRequirement(input.requirementId))) return null;
  if (!(await security.getControl(input.controlId))) return null;
  const rec: StatePrivacyControlMapping = { id: newId("spm"), reviewedAt: nowIso(), ...input };
  return await security.upsertStatePrivacyMapping(rec);
}
export async function updateStatePrivacyMapping(
  id: string,
  patch: Partial<Pick<StatePrivacyControlMapping, "status" | "evidence">>,
): Promise<StatePrivacyControlMapping | null> {
  const security = getPersistence().security;
  const m = await security.getStatePrivacyMapping(id);
  if (!m) return null;
  return await security.upsertStatePrivacyMapping({ ...m, ...patch, reviewedAt: nowIso() });
}

// ---- Vulnerabilities ----

export async function listVulnerabilities(): Promise<VulnerabilityReport[]> {
  return await getPersistence().security.listVulnerabilities();
}
export async function createVulnerability(
  input: Omit<VulnerabilityReport, "id" | "discoveredAt" | "resolvedAt"> & {
    discoveredAt?: string;
  },
): Promise<VulnerabilityReport> {
  const rec: VulnerabilityReport = {
    id: newId("vuln"),
    discoveredAt: input.discoveredAt ?? nowIso(),
    resolvedAt: null,
    title: input.title,
    cveId: input.cveId,
    severity: input.severity,
    status: input.status,
    source: input.source,
    affectedComponent: input.affectedComponent,
    fixedIn: input.fixedIn,
  };
  return await getPersistence().security.upsertVulnerability(rec);
}
export async function updateVulnerability(
  id: string,
  patch: Partial<Pick<VulnerabilityReport, "status" | "fixedIn" | "severity">>,
): Promise<VulnerabilityReport | null> {
  const security = getPersistence().security;
  const v = await security.getVulnerability(id);
  if (!v) return null;
  const next: VulnerabilityReport = { ...v, ...patch };
  if (patch.status === "fixed" && !next.resolvedAt) next.resolvedAt = nowIso();
  return await security.upsertVulnerability(next);
}

// Make types available to BFFs that import from repos.
export type { IncidentStatus, VulnerabilityStatus };

// ===== District / school admin helpers =====
import type {
  TenantSettings,
  TenantBranding,
  TenantNotificationPrefs,
  TenantFeatureOverrides,
  TenantSSOConfig,
  FunctioningLevel,
} from "@/lib/db/types";

/** Default settings filled in for any tenant that has never been written. */
function defaultTenantSettings(tenantId: string): TenantSettings {
  return {
    tenantId,
    branding: { displayName: null, supportEmail: null, primaryColor: null },
    notifications: {
      weeklyDigestEmail: true,
      incidentAlertsEmail: true,
      rosterDriftEmail: true,
      complianceRemindersEmail: true,
    },
    features: {
      homeworkHelpEnabled: true,
      parentIepUploadEnabled: true,
      rewardsShopEnabled: true,
      discoveryAdventureEnabled: true,
    },
    sso: {
      mode: "off",
      idpName: null,
      metadataUrl: null,
      scimEnabled: false,
      lastScimRotationAt: null,
    },
    updatedAt: nowIso(),
  };
}

/**
 * Read tenant settings, returning sane defaults if the tenant has never
 * been written. Never returns null so callers can safely render forms.
 */
export async function getTenantSettings(tenantId: string): Promise<TenantSettings> {
  return (await getPersistence().settings.getTenantSettings(tenantId)) ?? defaultTenantSettings(tenantId);
}

export async function updateTenantSettings(
  tenantId: string,
  patch: {
    branding?: Partial<TenantBranding>;
    notifications?: Partial<TenantNotificationPrefs>;
    features?: Partial<TenantFeatureOverrides>;
    sso?: Partial<TenantSSOConfig>;
  },
): Promise<TenantSettings> {
  const current = await getTenantSettings(tenantId);
  const next: TenantSettings = {
    ...current,
    branding: { ...current.branding, ...(patch.branding ?? {}) },
    notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
    features: { ...current.features, ...(patch.features ?? {}) },
    sso: { ...current.sso, ...(patch.sso ?? {}) },
    updatedAt: nowIso(),
  };
  return await getPersistence().settings.upsertTenantSettings(next);
}

/** Every learner whose tenant is in `tenantIds`. */
export async function listLearnersForTenants(tenantIds: string[]): Promise<LearnerProfile[]> {
  const all = await getPersistence().learners.listForTenants(tenantIds);
  return all.slice().sort((a, b) => a.displayName.localeCompare(b.displayName));
}

/** Number of IEPDocuments whose owning learner sits inside this tenant set. */
export function countIepsForTenants(tenantIds: string[]): number {
  const ids = new Set(tenantIds);
  let n = 0;
  for (const doc of db().iepDocuments.values()) {
    const learner = db().learnerProfiles.get(doc.learnerId);
    if (learner && ids.has(learner.tenantId)) n += 1;
  }
  return n;
}

/**
 * Aggregated district KPIs used by `/admin/district` overview. Keeps the
 * server component reading a single shape rather than wiring 6 calls.
 */
export type DistrictStats = {
  schools: number;
  families: number;
  staff: number;
  districtAdmins: number;
  schoolAdmins: number;
  teachers: number;
  parents: number;
  learners: number;
  ieps: number;
  /** Counts per functioning level, in display order. */
  flDistribution: Array<{ level: FunctioningLevel | "unset"; count: number }>;
};

export function getDistrictStats(tenantIds: string[]): DistrictStats {
  const ids = new Set(tenantIds);
  const tenants = Array.from(db().tenants.values()).filter((t) => ids.has(t.id));
  const memberships = db().memberships.filter((m) => ids.has(m.tenantId));

  const roleCount = (role: Role) => memberships.filter((m) => m.role === role).length;

  const learners = Array.from(db().learnerProfiles.values()).filter((l) => ids.has(l.tenantId));

  const levels: Array<FunctioningLevel | "unset"> = [
    "standard",
    "supported",
    "alternative",
    "non_verbal",
    "pre_symbolic",
    "unset",
  ];
  const flDistribution = levels.map((lvl) => ({
    level: lvl,
    count: learners.filter((l) =>
      lvl === "unset" ? l.functioningLevel === null : l.functioningLevel === lvl,
    ).length,
  }));

  return {
    schools: tenants.filter((t) => t.type === "school").length,
    families: tenants.filter((t) => t.type === "family").length,
    staff: roleCount("teacher") + roleCount("school_admin") + roleCount("district_admin"),
    districtAdmins: roleCount("district_admin"),
    schoolAdmins: roleCount("school_admin"),
    teachers: roleCount("teacher"),
    parents: roleCount("parent"),
    learners: learners.length,
    ieps: countIepsForTenants(tenantIds),
    flDistribution,
  };
}

/**
 * Users in this tenant set holding an admin/teacher/etc. role. Used by the
 * district admins + staff pages. `roles` filters the result.
 */
export async function listMembersByRole(
  tenantIds: string[],
  roles: Role[],
): Promise<UserSummary[]> {
  const wanted = new Set(roles);
  const all = await listUsersForTenants(tenantIds);
  return all.filter((u) => wanted.has(u.role));
}

/**
 * One learner with their school + family tenant labels. Lets the district
 * IEP tracker render "school — family" rows without a second tenant lookup.
 */
export type DistrictLearnerRow = {
  learner: LearnerProfile;
  familyName: string;
  schoolName: string | null;
  hasIep: boolean;
};

export async function listDistrictLearners(tenantIds: string[]): Promise<DistrictLearnerRow[]> {
  const learners = await listLearnersForTenants(tenantIds);
  const iepLearnerIds = new Set(Array.from(db().iepDocuments.values()).map((d) => d.learnerId));
  return learners.map((l) => {
    const family = db().tenants.get(l.tenantId);
    const school = family?.parentTenantId ? db().tenants.get(family.parentTenantId) : null;
    return {
      learner: l,
      familyName: family?.name ?? l.tenantId,
      schoolName: school?.type === "school" ? school.name : null,
      hasIep: iepLearnerIds.has(l.id),
    };
  });
}

/** Per-school roll-up for the district schools page. */
export type DistrictSchoolRow = {
  school: Tenant;
  staffCount: number;
  familyCount: number;
  learnerCount: number;
};

export function listDistrictSchools(tenantIds: string[]): DistrictSchoolRow[] {
  const ids = new Set(tenantIds);
  const tenants = Array.from(db().tenants.values()).filter((t) => ids.has(t.id));
  const schools = tenants.filter((t) => t.type === "school");
  return schools
    .map((school) => {
      const families = tenants.filter((t) => t.type === "family" && t.parentTenantId === school.id);
      const familyIds = new Set(families.map((f) => f.id));
      const learnerCount = Array.from(db().learnerProfiles.values()).filter((l) =>
        familyIds.has(l.tenantId),
      ).length;
      const staffCount = db().memberships.filter(
        (m) => m.tenantId === school.id && (m.role === "teacher" || m.role === "school_admin"),
      ).length;
      return {
        school,
        staffCount,
        familyCount: families.length,
        learnerCount,
      };
    })
    .sort((a, b) => a.school.name.localeCompare(b.school.name));
}

/** Look up a single user by id. Returns null when not found. */
export async function getUserById(id: string): Promise<User | null> {
  return getPersistence().identity.getUserById(id);
}

/** List all memberships for a single user, newest first. */
export async function listMembershipsForUser(userId: string): Promise<TenantMembership[]> {
  return getPersistence().identity.listMembershipsForUser(userId);
}

/** Invoices across many tenants, newest first. */
export function listInvoicesForTenants(tenantIds: string[]): Invoice[] {
  const ids = new Set(tenantIds);
  return Array.from(db().invoices.values())
    .filter((i) => ids.has(i.tenantId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

// ============================================================
// Platform-admin operations: coupons + daily billing batches
// ============================================================

import type {
  Coupon,
  DailyBillingBatch,
  PlatformApiKey,
  PlatformEmailTemplate,
  PlatformWebhookEndpoint,
} from "@/lib/db/types";

/** Every coupon, newest first. */
export async function listCoupons(): Promise<Coupon[]> {
  return await getPersistence().billing.listCoupons();
}

/** Every daily billing batch, newest run-date first. */
export async function listDailyBillingBatches(): Promise<DailyBillingBatch[]> {
  return await getPersistence().billing.listDailyBillingBatches();
}

// ============================================================
// Platform-admin settings: API keys, email templates, webhooks
// ============================================================

/** Every platform API key, newest first. Secrets are never returned. */
export async function listPlatformApiKeys(): Promise<PlatformApiKey[]> {
  return (await getPersistence().settings.listPlatformApiKeys()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

/** Every platform email template, alphabetised by name. */
export async function listPlatformEmailTemplates(): Promise<PlatformEmailTemplate[]> {
  return (await getPersistence().settings.listPlatformEmailTemplates()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** Every platform webhook endpoint, newest first. */
export async function listPlatformWebhookEndpoints(): Promise<PlatformWebhookEndpoint[]> {
  return (await getPersistence().settings.listPlatformWebhookEndpoints()).sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

// ============================================================
// Sprint 30: Engagement, badges, sensory (Parent enterprise parity)
// ============================================================

import type {
  LearnerEngagement,
  LearnerBadge,
  LearnerSensoryProfile,
  SensoryModality,
  SensoryResponse,
} from "@/lib/db/types";

/** Engagement (XP/streak/currency) for a learner, or null if not seeded. */
export async function getLearnerEngagement(
  learnerId: string,
  tenantId: string,
): Promise<LearnerEngagement | null> {
  const row = await getPersistence().engagement.getEngagement(learnerId);
  if (!row || row.tenantId !== tenantId) return null;
  return row;
}

/** All badges earned by a learner, newest first. */
export async function listLearnerBadges(
  learnerId: string,
  tenantId: string,
): Promise<LearnerBadge[]> {
  return (await getPersistence().engagement.listBadges())
    .filter((b) => b.learnerId === learnerId && b.tenantId === tenantId)
    .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
}

/** Sensory profile (hyper/neutral/hypo per modality) for a learner, or null. */
export async function getLearnerSensoryProfile(
  learnerId: string,
  tenantId: string,
): Promise<LearnerSensoryProfile | null> {
  const row = await getPersistence().engagement.getSensoryProfile(learnerId);
  if (!row || row.tenantId !== tenantId) return null;
  return row;
}

/**
 * Upsert one modality + optional notes. Returns the updated profile.
 * Creates a fresh "neutral" profile first if none existed.
 */
export async function upsertLearnerSensoryModality(
  learnerId: string,
  tenantId: string,
  modality: SensoryModality,
  response: SensoryResponse,
  notes?: string,
): Promise<LearnerSensoryProfile> {
  const engagement = getPersistence().engagement;
  // Tenant isolation: refuse to write if the learner doesn't belong to the
  // caller's tenant. Prevents one tenant overwriting another's profile via
  // a shared learnerId key.
  const learner = await getPersistence().learners.getById(learnerId, tenantId);
  if (!learner) {
    throw new Error(`upsertLearnerSensoryModality: learner ${learnerId} not in tenant ${tenantId}`);
  }
  let prof = await engagement.getSensoryProfile(learnerId);
  if (!prof || prof.tenantId !== tenantId) {
    prof = {
      learnerId,
      tenantId,
      modalities: {
        visual: "unknown",
        auditory: "unknown",
        tactile: "unknown",
        vestibular: "unknown",
        proprioception: "unknown",
      },
      notes: "",
      updatedAt: new Date().toISOString(),
    };
  }
  const next: LearnerSensoryProfile = {
    ...prof,
    modalities: { ...prof.modalities, [modality]: response },
    notes: typeof notes === "string" ? notes : prof.notes,
    updatedAt: new Date().toISOString(),
  };
  return await engagement.upsertSensoryProfile(next);
}

// ---------------------------------------------------------------------------
// Sprint 7 — school admin dashboard. The previous `/admin/school` page
// rendered hardcoded values (school name, learner count, consent %, etc.).
// `getSchoolDashboard` collapses the relevant repos into one server-side
// payload so the page can fetch real numbers and the test suite has one
// observable surface to pin.
// ---------------------------------------------------------------------------

export interface SchoolDashboardSnapshot {
  /** Returns null when no school/tenant maps to the caller. */
  school: { id: string | null; name: string; districtId: string | null } | null;
  counts: {
    learners: number;
    staff: number;
    classes: number;
    iepsOnFile: number;
    auditEvents30d: number;
    moderationFlagged7d: number;
    consentCompletePct: number;
  };
  licenses: {
    used: number;
    total: number;
    utilizationPct: number;
  };
  rostering: {
    source: string;
    lastSyncIso: string | null;
    lastErrorIso: string | null;
    status: "healthy" | "warning" | "error" | "unknown";
  };
}

export async function getSchoolDashboard(
  tenantId: string,
  schoolId?: string,
): Promise<SchoolDashboardSnapshot> {
  const store = db();
  const tenant = getTenantById(tenantId);
  const schools = await listSchools(tenantId);
  const school = schools.find((s) => (schoolId ? s.id === schoolId : true)) ?? schools[0] ?? null;

  const learners = Array.from(store.learnerProfiles.values()).filter(
    (l) => l.tenantId === tenantId,
  );
  const allStaff = await listUsersForTenants([tenantId]);
  const staff = allStaff.filter((u) =>
    ["TEACHER", "SCHOOL_ADMIN", "DISTRICT_ADMIN", "THERAPIST"].includes(u.role as string),
  );
  const classes = await listClassrooms({
    tenantId,
    schoolId: school?.id,
  });

  const ieps = Array.from(store.iepDocuments.values()).filter((d) => {
    const l = store.learnerProfiles.get(d.learnerId);
    return l?.tenantId === tenantId;
  });

  const auditLogs = await listAuditLogsForTenants([tenantId], 1000);
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const auditEvents30d = auditLogs.filter(
    (a) => new Date(a.occurredAt).getTime() >= thirtyDaysAgo,
  ).length;

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const moderationFlagged7d = Array.from(store.moderationEvents.values()).filter(
    (m) => m.tenantId === tenantId && new Date(m.createdAt).getTime() >= sevenDaysAgo,
  ).length;

  // Count UNIQUE learners with at least one consent record on file —
  // the seed writes one record per consent version per learner, so a
  // naïve rows/learners ratio over-reports (a learner with 5 versions
  // would count as 500%). Cap at 100 % defensively too.
  const consentedLearners = new Set(
    (store.consentRecords ?? [])
      .filter((c) => c.tenantId === tenantId)
      .map((c) => c.learnerId)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );
  const consentCompletePct =
    learners.length === 0
      ? 100
      : Math.min(100, Math.round((consentedLearners.size / learners.length) * 100));

  // License pool — use tenant.seatLimit when present, fall back to learner+staff.
  const totalSeats =
    (tenant as { seatLimit?: number } | null)?.seatLimit ?? learners.length + staff.length;
  const usedSeats = learners.length + staff.length;
  const utilizationPct = totalSeats === 0 ? 0 : Math.round((usedSeats / totalSeats) * 100);

  // Rostering — last successful job if any, else "unknown".
  const rosteringJobs = Array.from(store.aiGenerationJobs?.values?.() ?? []).filter(
    (j) =>
      (j as { tenantId?: string }).tenantId === tenantId &&
      (j as { kind?: string }).kind === "rostering_import",
  );
  rosteringJobs.sort((a, b) => {
    const ta = new Date((a as { updatedAt?: string }).updatedAt ?? 0).getTime();
    const tb = new Date((b as { updatedAt?: string }).updatedAt ?? 0).getTime();
    return tb - ta;
  });
  const lastJob = rosteringJobs[0] as
    | { status?: string; updatedAt?: string; source?: string }
    | undefined;
  const lastSyncIso = lastJob?.updatedAt ?? null;
  const status: SchoolDashboardSnapshot["rostering"]["status"] = !lastJob
    ? "unknown"
    : lastJob.status === "succeeded"
      ? "healthy"
      : lastJob.status === "failed"
        ? "error"
        : "warning";

  return {
    school: school
      ? { id: school.id, name: school.name, districtId: null }
      : { id: null, name: tenant?.name ?? "(unnamed school)", districtId: null },
    counts: {
      learners: learners.length,
      staff: staff.length,
      classes: classes.length,
      iepsOnFile: ieps.length,
      auditEvents30d,
      moderationFlagged7d,
      consentCompletePct,
    },
    licenses: { used: usedSeats, total: totalSeats, utilizationPct },
    rostering: {
      source: lastJob?.source ?? "manual",
      lastSyncIso,
      lastErrorIso: null,
      status,
    },
  };
}

// ---------------------------------------------------------------------------
// Sprint 8 — school reports backend.
//
// Returns per-learner aggregate rows for the configurable date range so the
// admin can drill into adoption, IEP compliance, and engagement. The shape
// is deliberately tabular so the CSV export endpoint can serialize it
// directly without bespoke transforms.
// ---------------------------------------------------------------------------

export interface SchoolReportRow {
  learnerId: string;
  learnerName: string;
  classroomName: string | null;
  gradeBand: string | null;
  iepOnFile: boolean;
  baselineCompleted: boolean;
  lessonsCompleted: number;
  lessonsInWindow: number;
  consentOnFile: boolean;
  lastActiveIso: string | null;
}

export interface SchoolReportSummary {
  totalLearners: number;
  lessonsInWindow: number;
  iepCoveragePct: number;
  consentCoveragePct: number;
  windowStartIso: string;
  windowEndIso: string;
}

export interface SchoolReportPayload {
  summary: SchoolReportSummary;
  rows: SchoolReportRow[];
}

export async function getSchoolReport(
  tenantId: string,
  opts: { startIso?: string; endIso?: string } = {},
): Promise<SchoolReportPayload> {
  const store = db();
  const endIso = opts.endIso ?? new Date().toISOString();
  const startIso = opts.startIso ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  const learners = Array.from(store.learnerProfiles.values()).filter(
    (l) => l.tenantId === tenantId,
  );
  const classrooms = await listClassrooms({ tenantId });
  const classroomById = new Map(classrooms.map((c) => [c.id, c]));
  const enrollmentByLearner = new Map<string, string>();
  for (const e of Array.from(store.enrollments.values())) {
    if (e.role === "learner" && e.subjectId && !enrollmentByLearner.has(e.subjectId)) {
      enrollmentByLearner.set(e.subjectId, e.classroomId);
    }
  }

  const consentByLearner = new Set(
    (store.consentRecords ?? [])
      .filter((c) => c.tenantId === tenantId && c.learnerId)
      .map((c) => c.learnerId as string),
  );
  const iepByLearner = new Set(Array.from(store.iepDocuments.values()).map((d) => d.learnerId));

  const lessonRunsByLearner = new Map<string, number>();
  const lessonRunsInWindowByLearner = new Map<string, number>();
  const lastActiveByLearner = new Map<string, string>();
  for (const lr of Array.from(store.lessonRuns?.values?.() ?? [])) {
    const t = lr as {
      learnerId?: string;
      createdAt?: string;
      completedAt?: string | null;
      tenantId?: string;
    };
    if (t.tenantId !== tenantId || !t.learnerId) continue;
    lessonRunsByLearner.set(t.learnerId, (lessonRunsByLearner.get(t.learnerId) ?? 0) + 1);
    const tMs = new Date(t.createdAt ?? 0).getTime();
    if (tMs >= startMs && tMs <= endMs) {
      lessonRunsInWindowByLearner.set(
        t.learnerId,
        (lessonRunsInWindowByLearner.get(t.learnerId) ?? 0) + 1,
      );
    }
    const last = lastActiveByLearner.get(t.learnerId);
    if (!last || (t.createdAt && new Date(t.createdAt).getTime() > new Date(last).getTime())) {
      if (t.createdAt) lastActiveByLearner.set(t.learnerId, t.createdAt);
    }
  }

  const rows: SchoolReportRow[] = learners.map((l) => {
    const cls = enrollmentByLearner.get(l.id);
    const classroom = cls ? (classroomById.get(cls) ?? null) : null;
    return {
      learnerId: l.id,
      learnerName: l.displayName ?? l.id,
      classroomName: classroom?.name ?? null,
      gradeBand: classroom?.gradeBand ?? null,
      iepOnFile: iepByLearner.has(l.id),
      baselineCompleted: !!(l as { baselineCompletedAt?: string | null }).baselineCompletedAt,
      lessonsCompleted: lessonRunsByLearner.get(l.id) ?? 0,
      lessonsInWindow: lessonRunsInWindowByLearner.get(l.id) ?? 0,
      consentOnFile: consentByLearner.has(l.id),
      lastActiveIso: lastActiveByLearner.get(l.id) ?? null,
    };
  });

  const lessonsInWindow = rows.reduce((sum, r) => sum + r.lessonsInWindow, 0);
  const iepCoveragePct =
    learners.length === 0
      ? 100
      : Math.round((rows.filter((r) => r.iepOnFile).length / learners.length) * 100);
  const consentCoveragePct =
    learners.length === 0
      ? 100
      : Math.round((rows.filter((r) => r.consentOnFile).length / learners.length) * 100);

  return {
    summary: {
      totalLearners: learners.length,
      lessonsInWindow,
      iepCoveragePct,
      consentCoveragePct,
      windowStartIso: startIso,
      windowEndIso: endIso,
    },
    rows: rows.sort((a, b) => a.learnerName.localeCompare(b.learnerName)),
  };
}

/**
 * Sprint 8 — render a school report payload as RFC 4180 CSV. Kept in
 * the repo module so the BFF route stays lean and so the CSV shape is
 * unit-testable without spinning up HTTP.
 */
export function renderSchoolReportCsv(payload: SchoolReportPayload): string {
  const header = [
    "learnerId",
    "learnerName",
    "classroomName",
    "gradeBand",
    "iepOnFile",
    "baselineCompleted",
    "lessonsCompleted",
    "lessonsInWindow",
    "consentOnFile",
    "lastActiveIso",
  ].join(",");
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const body = payload.rows
    .map((r) =>
      [
        r.learnerId,
        r.learnerName,
        r.classroomName ?? "",
        r.gradeBand ?? "",
        r.iepOnFile,
        r.baselineCompleted,
        r.lessonsCompleted,
        r.lessonsInWindow,
        r.consentOnFile,
        r.lastActiveIso ?? "",
      ]
        .map(escape)
        .join(","),
    )
    .join("\n");
  return `${header}\n${body}\n`;
}

// ---------------------------------------------------------------------------
// Sprint 8 — class CRUD authorised at the BFF / route layer. The two
// helpers below are the destructive counterparts to listClassrooms;
// `createClassroom` already exists above.
// ---------------------------------------------------------------------------

export async function deleteClassroom(id: string, tenantId: string): Promise<boolean> {
  const c = await getClassroom(id, tenantId);
  if (!c) return false;
  // Cascade: drop enrollments for this classroom.
  for (const e of Array.from(db().enrollments.values())) {
    if (e.classroomId === id) db().enrollments.delete(e.id);
  }
  db().classrooms.delete(id);
  return true;
}

// ---------------------------------------------------------------------------
// Sprint 8 — staff add/remove. The previous /admin/school/staff page
// could only LIST users; these helpers fill in the create + delete
// half so the admin can complete invites and revoke access.
// ---------------------------------------------------------------------------

export async function addStaffUser(input: {
  tenantId: string;
  email: string;
  displayName: string;
  role: "TEACHER" | "SCHOOL_ADMIN" | "THERAPIST" | "CAREGIVER";
}): Promise<{
  id: string;
  tenantId: string;
  email: string;
  displayName: string;
  role: "TEACHER" | "SCHOOL_ADMIN" | "THERAPIST" | "CAREGIVER";
  status: "INVITED";
  createdAt: string;
}> {
  return getPersistence().identity.addStaffUser(input);
}

export async function removeStaffUser(userId: string, tenantId: string): Promise<boolean> {
  return getPersistence().identity.removeStaffUser(userId, tenantId);
}

// ---------------------------------------------------------------------------
// Sprint 9 — therapist domain repos. The therapist shell used to read
// from shared LessonRun rows only; this layer gives the role a proper
// caseload + session notes + goal tracking surface.
// ---------------------------------------------------------------------------

export interface TherapistCaseloadEntry {
  learner: LearnerProfile;
  /** Active IEP goals owned by this therapist for the learner. */
  goals: import("./types").IepGoalRecord[];
  /** Last session note authored, when any. */
  lastSession: import("./types").TherapistSessionNote | null;
  /** Next scheduled session ISO (placeholder — wired from scheduling
   *  service in a later sprint). */
  nextSessionIso: string | null;
}

export async function listTherapistCaseload(
  therapistUserId: string,
  therapistEmail: string,
  tenantId: string,
): Promise<TherapistCaseloadEntry[]> {
  const store = db();
  const learnerIds = new Set<string>(
    await listLearnersForTeamMember(therapistUserId, therapistEmail, "therapist", tenantId),
  );
  const goalsByLearner = new Map<string, import("./types").IepGoalRecord[]>();
  for (const g of Array.from(store.iepGoalRecords.values())) {
    if (g.tenantId !== tenantId) continue;
    if (g.status === "discontinued") continue;
    const arr = goalsByLearner.get(g.learnerId) ?? [];
    arr.push(g);
    goalsByLearner.set(g.learnerId, arr);
  }
  const lastSessionByLearner = new Map<string, import("./types").TherapistSessionNote>();
  for (const note of Array.from(store.therapistSessionNotes.values())) {
    if (note.tenantId !== tenantId || note.therapistUserId !== therapistUserId) continue;
    const prev = lastSessionByLearner.get(note.learnerId);
    if (!prev || note.sessionDate > prev.sessionDate) {
      lastSessionByLearner.set(note.learnerId, note);
    }
  }
  const out: TherapistCaseloadEntry[] = [];
  for (const id of learnerIds) {
    const l = store.learnerProfiles.get(id);
    if (!l || l.tenantId !== tenantId) continue;
    out.push({
      learner: l,
      goals: (goalsByLearner.get(id) ?? []).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
      lastSession: lastSessionByLearner.get(id) ?? null,
      nextSessionIso: null,
    });
  }
  return out.sort((a, b) => a.learner.displayName.localeCompare(b.learner.displayName));
}

export function listIepGoals(
  learnerId: string,
  tenantId: string,
): import("./types").IepGoalRecord[] {
  return Array.from(db().iepGoalRecords.values())
    .filter((g) => g.learnerId === learnerId && g.tenantId === tenantId)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}

export function createIepGoal(input: {
  tenantId: string;
  learnerId: string;
  authoredByUserId: string;
  domain: string;
  goalText: string;
  baseline?: string;
  targetCriteria?: string;
  measurableCriteria?: string;
}): import("./types").IepGoalRecord {
  const now = nowIso();
  const rec: import("./types").IepGoalRecord = {
    id: newId("goal"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    authoredByUserId: input.authoredByUserId,
    domain: input.domain,
    goalText: input.goalText,
    baseline: input.baseline ?? "",
    targetCriteria: input.targetCriteria ?? "",
    measurableCriteria: input.measurableCriteria ?? "",
    status: "active",
    progressPct: 0,
    dataPoints: [],
    createdAt: now,
    updatedAt: now,
  };
  db().iepGoalRecords.set(rec.id, rec);
  return rec;
}

export function updateIepGoalProgress(
  goalId: string,
  tenantId: string,
  value: number,
  note?: string,
): import("./types").IepGoalRecord | null {
  const g = db().iepGoalRecords.get(goalId);
  if (!g || g.tenantId !== tenantId) return null;
  const clamped = Math.max(0, Math.min(100, value));
  g.progressPct = clamped;
  g.dataPoints = [...g.dataPoints, { date: nowIso(), value: clamped, note }].slice(-50);
  g.updatedAt = nowIso();
  if (clamped >= 100 && g.status === "active") g.status = "met";
  return g;
}

export function listSessionNotes(
  learnerId: string,
  tenantId: string,
): import("./types").TherapistSessionNote[] {
  return Array.from(db().therapistSessionNotes.values())
    .filter((n) => n.learnerId === learnerId && n.tenantId === tenantId)
    .sort((a, b) => (a.sessionDate < b.sessionDate ? 1 : -1));
}

export function createSessionNote(input: {
  tenantId: string;
  learnerId: string;
  therapistUserId: string;
  sessionDate?: string;
  durationMinutes: number;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  goalIds: string[];
}): import("./types").TherapistSessionNote {
  const now = nowIso();
  const rec: import("./types").TherapistSessionNote = {
    id: newId("note"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    therapistUserId: input.therapistUserId,
    sessionDate: input.sessionDate ?? now,
    durationMinutes: input.durationMinutes,
    subjective: input.subjective,
    objective: input.objective,
    assessment: input.assessment,
    plan: input.plan,
    goalIds: input.goalIds,
    signedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  db().therapistSessionNotes.set(rec.id, rec);
  return rec;
}

export function signSessionNote(
  id: string,
  tenantId: string,
): import("./types").TherapistSessionNote | null {
  const n = db().therapistSessionNotes.get(id);
  if (!n || n.tenantId !== tenantId) return null;
  n.signedAt = nowIso();
  n.updatedAt = nowIso();
  return n;
}

// ---------------------------------------------------------------------------
// Sprint 10 — caregiver observations.
// ---------------------------------------------------------------------------

export function listCaregiverObservations(
  learnerId: string,
  tenantId: string,
  limit = 100,
): import("./types").CaregiverObservation[] {
  return Array.from(db().caregiverObservations.values())
    .filter((o) => o.learnerId === learnerId && o.tenantId === tenantId)
    .sort((a, b) => (a.observedAt < b.observedAt ? 1 : -1))
    .slice(0, limit);
}

export function createCaregiverObservation(input: {
  tenantId: string;
  learnerId: string;
  caregiverUserId: string;
  observedAt?: string;
  behaviour: string;
  antecedent?: string;
  consequence?: string;
  durationMinutes?: number | null;
  location?: string;
  mood?: string | null;
  attachmentUrl?: string | null;
}): import("./types").CaregiverObservation {
  const rec: import("./types").CaregiverObservation = {
    id: newId("obs"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    caregiverUserId: input.caregiverUserId,
    observedAt: input.observedAt ?? nowIso(),
    behaviour: input.behaviour,
    antecedent: input.antecedent ?? "",
    consequence: input.consequence ?? "",
    durationMinutes: input.durationMinutes ?? null,
    location: input.location ?? "home",
    mood: input.mood ?? null,
    attachmentUrl: input.attachmentUrl ?? null,
    createdAt: nowIso(),
    updatedAt: null,
    editHistory: [],
  };
  db().caregiverObservations.set(rec.id, rec);
  return rec;
}

export function getCaregiverObservation(
  id: string,
  tenantId: string,
): import("./types").CaregiverObservation | null {
  const o = db().caregiverObservations.get(id);
  if (!o || o.tenantId !== tenantId) return null;
  return o;
}

/** The author-only edit window (15 minutes from creation). Shared with the
 *  family-svc PATCH route so the web + service surfaces enforce the same rule. */
export const CAREGIVER_EDIT_WINDOW_MS = 15 * 60 * 1000;

export type CaregiverObservationEditResult =
  | { ok: true; observation: import("./types").CaregiverObservation }
  | { ok: false; reason: "not_found" | "forbidden" | "window_expired" };

/**
 * Author-only edit within the 15-minute window. Enforced here (server-side, the
 * web store's source of truth) AND independently in the family-svc PATCH route:
 *   - the editor MUST be the author (`caregiverUserId`), else `forbidden`;
 *   - the edit MUST land within {@link CAREGIVER_EDIT_WINDOW_MS} of creation,
 *     else `window_expired`;
 *   - the PRIOR field values are snapshotted into `editHistory` before applying
 *     the new ones — an edit never silently overwrites without a trace.
 * `now` is injectable so tests can drive the window past expiry deterministically.
 */
export function updateCaregiverObservation(
  input: {
    id: string;
    tenantId: string;
    editorUserId: string;
    behaviour?: string;
    antecedent?: string;
    consequence?: string;
    durationMinutes?: number | null;
    location?: string;
    mood?: string | null;
  },
  now: number = Date.now(),
): CaregiverObservationEditResult {
  const current = getCaregiverObservation(input.id, input.tenantId);
  if (!current) return { ok: false, reason: "not_found" };
  if (current.caregiverUserId !== input.editorUserId) return { ok: false, reason: "forbidden" };
  const createdMs = new Date(current.createdAt).getTime();
  if (now - createdMs > CAREGIVER_EDIT_WINDOW_MS) return { ok: false, reason: "window_expired" };

  const priorSnapshot: import("./types").CaregiverObservationEdit = {
    editedAt: new Date(now).toISOString(),
    behaviour: current.behaviour,
    antecedent: current.antecedent,
    consequence: current.consequence,
    durationMinutes: current.durationMinutes,
    location: current.location,
    mood: current.mood,
  };
  const next: import("./types").CaregiverObservation = {
    ...current,
    behaviour: input.behaviour ?? current.behaviour,
    antecedent: input.antecedent ?? current.antecedent,
    consequence: input.consequence ?? current.consequence,
    durationMinutes:
      input.durationMinutes !== undefined ? input.durationMinutes : current.durationMinutes,
    location: input.location ?? current.location,
    mood: input.mood !== undefined ? input.mood : current.mood,
    updatedAt: new Date(now).toISOString(),
    editHistory: [...current.editHistory, priorSnapshot],
  };
  db().caregiverObservations.set(next.id, next);
  return { ok: true, observation: next };
}

// ---------------------------------------------------------------------------
// Sprint 11 — teacher IEP authoring + gradebook detail.
//
// upsertIepAiDraft persists the response from POST /api/ai/iep/draft
// so the teacher can review and progress the draft through the
// lifecycle (ai_draft → teacher_review → admin_approved → active).
// One row per learner; regenerations overwrite.
// ---------------------------------------------------------------------------

export async function upsertIepAiDraft(input: {
  tenantId: string;
  learnerId: string;
  sourceAttemptId?: string | null;
  draft: import("./types").IepAiDraftBody;
  model?: string | null;
  responsibleAi?: Record<string, unknown>;
}): Promise<import("./types").IepAiDraftRecord> {
  const clinical = getPersistence().clinical;
  const now = nowIso();
  const existing = await clinical.getDraftForLearner(input.learnerId, input.tenantId);
  if (existing) {
    // Regeneration resets the review lifecycle back to ai_draft.
    const updated: import("./types").IepAiDraftRecord = {
      ...existing,
      draft: input.draft,
      model: input.model ?? existing.model,
      responsibleAi: input.responsibleAi ?? existing.responsibleAi,
      generatedAt: now,
      updatedAt: now,
      status: "ai_draft",
      reviewedByUserId: null,
      reviewedAt: null,
      approvedByUserId: null,
      approvedAt: null,
    };
    return await clinical.upsertDraft(updated);
  }
  const rec: import("./types").IepAiDraftRecord = {
    id: newId("iep-draft"),
    tenantId: input.tenantId,
    learnerId: input.learnerId,
    sourceAttemptId: input.sourceAttemptId ?? null,
    status: "ai_draft",
    draft: input.draft,
    model: input.model ?? null,
    responsibleAi: input.responsibleAi ?? {},
    generatedAt: now,
    reviewedByUserId: null,
    reviewedAt: null,
    approvedByUserId: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  return await clinical.upsertDraft(rec);
}

export async function getIepAiDraft(
  learnerId: string,
  tenantId: string,
): Promise<import("./types").IepAiDraftRecord | null> {
  return await getPersistence().clinical.getDraftForLearner(learnerId, tenantId);
}

export async function listIepAiDraftsForReviewer(
  reviewerUserId: string,
  tenantId: string,
): Promise<import("./types").IepAiDraftRecord[]> {
  // Sprint 11: a teacher sees drafts for every learner on their roster.
  const reviewerLearners = await listLearnersForTeacher(reviewerUserId, tenantId);
  const learnerIds = reviewerLearners.map((l) => l.id);
  return await getPersistence().clinical.listDraftsForLearners(learnerIds, tenantId);
}

export async function progressIepAiDraft(
  id: string,
  tenantId: string,
  userId: string,
  next: import("./types").IepAiDraftStatus,
): Promise<import("./types").IepAiDraftRecord | null> {
  const clinical = getPersistence().clinical;
  const d = await clinical.getDraftById(id, tenantId);
  if (!d) return null;
  const allowed: Record<import("./types").IepAiDraftStatus, import("./types").IepAiDraftStatus[]> =
    {
      ai_draft: ["teacher_review", "archived"],
      teacher_review: ["admin_approved", "ai_draft", "archived"],
      admin_approved: ["active", "archived"],
      active: ["archived"],
      archived: [],
    };
  if (!allowed[d.status].includes(next)) return null;
  const now = nowIso();
  const updated: import("./types").IepAiDraftRecord = {
    ...d,
    status: next,
    updatedAt: now,
    reviewedByUserId: next === "teacher_review" ? userId : d.reviewedByUserId,
    reviewedAt: next === "teacher_review" ? now : d.reviewedAt,
    approvedByUserId: next === "admin_approved" ? userId : d.approvedByUserId,
    approvedAt: next === "admin_approved" ? now : d.approvedAt,
  };
  return await clinical.upsertDraft(updated);
}

// ---------------------------------------------------------------------------
// Teacher gradebook detail. Returns per-skill mastery summary across the
// learner's enrolled subjects so the teacher can see WHERE the learner
// is and WHERE they're stuck without scrolling through raw LessonRuns.
// ---------------------------------------------------------------------------

export interface GradebookRow {
  subjectId: string;
  subjectName: string;
  skillId: string;
  skillName: string;
  level: "introduced" | "developing" | "secure" | "mastered" | "unattempted";
  lastPracticedIso: string | null;
  attempts: number;
}

export interface GradebookDetail {
  learnerId: string;
  rows: GradebookRow[];
  summary: { mastered: number; secure: number; developing: number; introduced: number };
}

export async function getGradebookDetail(
  learnerId: string,
  tenantId: string,
): Promise<GradebookDetail> {
  const mastery = await getMasteryMap(learnerId, tenantId);
  const subjects = new Map((await listSubjects()).map((s) => [s.id, s]));
  const skills = new Map((await listSkills()).map((s) => [s.id, s]));

  // Count lesson runs per skill + last-practiced timestamp.
  const lastByskill = new Map<string, string>();
  const attemptsBySkill = new Map<string, number>();
  for (const lr of Array.from(db().lessonRuns.values())) {
    const t = lr as { learnerId?: string; tenantId?: string; skillId?: string; createdAt?: string };
    if (t.tenantId !== tenantId || t.learnerId !== learnerId || !t.skillId) continue;
    attemptsBySkill.set(t.skillId, (attemptsBySkill.get(t.skillId) ?? 0) + 1);
    const prev = lastByskill.get(t.skillId);
    if (!prev || (t.createdAt && t.createdAt > prev)) {
      if (t.createdAt) lastByskill.set(t.skillId, t.createdAt);
    }
  }

  const rows: GradebookRow[] = [];
  const entries = mastery?.skillMasteries ?? [];
  for (const m of entries) {
    const sk = skills.get(m.skillId);
    if (!sk) continue;
    const subj = subjects.get(sk.subjectId);
    if (!subj) continue;
    rows.push({
      subjectId: subj.id,
      subjectName: subj.name,
      skillId: sk.id,
      skillName: sk.name,
      level: m.level as GradebookRow["level"],
      lastPracticedIso: lastByskill.get(sk.id) ?? null,
      attempts: attemptsBySkill.get(sk.id) ?? 0,
    });
  }
  rows.sort((a, b) => {
    const order = { mastered: 0, secure: 1, developing: 2, introduced: 3, unattempted: 4 };
    return (
      (order[a.level] ?? 5) - (order[b.level] ?? 5) || a.subjectName.localeCompare(b.subjectName)
    );
  });
  const summary = {
    mastered: rows.filter((r) => r.level === "mastered").length,
    secure: rows.filter((r) => r.level === "secure").length,
    developing: rows.filter((r) => r.level === "developing").length,
    introduced: rows.filter((r) => r.level === "introduced").length,
  };
  return { learnerId, rows, summary };
}

// ---------------------------------------------------------------------------
// Sprint 12 — baseline pipeline observability.
//
// Rolls the in-memory mirror of the Sprint 4 baseline_item_audits
// table into the counts the platform admin dashboard renders. When
// the real postgres table is wired up the implementation moves to a
// SQL aggregator; the interface stays the same so callers don't
// flip-flop.
// ---------------------------------------------------------------------------

export interface BaselinePipelineMetrics {
  windowStartIso: string;
  windowEndIso: string;
  totalEvaluatedItems: number;
  /** % of evaluated items blocked by responsible-AI. */
  blockRatePct: number;
  /** % of shipped items that came from the fallback bank. */
  fallbackShareOfShippedPct: number;
  /** Histogram of recommendedAction values. */
  byRecommendedAction: Record<string, number>;
  /** Top violation codes by frequency. */
  topViolations: Array<{ code: string; count: number }>;
}

interface BaselineAuditLike {
  shipped?: string;
  source?: string;
  recommendedAction?: string;
  violations?: Array<{ code?: string }>;
  createdAt?: string;
}

export async function getBaselinePipelineMetrics(
  opts: { startIso?: string; endIso?: string } = {},
): Promise<BaselinePipelineMetrics> {
  const endIso = opts.endIso ?? new Date().toISOString();
  const startIso = opts.startIso ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  // Pull from whichever in-memory map exists. The store has not had a
  // dedicated baseline_item_audits map yet (the postgres table from
  // Sprint 4 is the production surface); for now we aggregate from
  // moderationEvents which captures the same shape during local dev.
  const rows: BaselineAuditLike[] = (await getPersistence().safety.listModerationEvents()).filter((m) => {
    const t = m as { createdAt?: string };
    const ms = new Date(t.createdAt ?? 0).getTime();
    return ms >= startMs && ms <= endMs;
  }) as BaselineAuditLike[];

  const byAction: Record<string, number> = {};
  const violationCounts = new Map<string, number>();
  let shippedFromFallback = 0;
  let shippedTotal = 0;
  let blocked = 0;
  for (const r of rows) {
    const action = r.recommendedAction ?? "allow";
    byAction[action] = (byAction[action] ?? 0) + 1;
    if (action === "block") blocked += 1;
    if (r.shipped === "yes") {
      shippedTotal += 1;
      if (r.source === "fallback") shippedFromFallback += 1;
    }
    for (const v of r.violations ?? []) {
      const code = v?.code;
      if (!code) continue;
      violationCounts.set(code, (violationCounts.get(code) ?? 0) + 1);
    }
  }

  const total = rows.length;
  const blockRatePct = total === 0 ? 0 : Math.round((blocked / total) * 100);
  const fallbackShareOfShippedPct =
    shippedTotal === 0 ? 0 : Math.round((shippedFromFallback / shippedTotal) * 100);
  const topViolations = Array.from(violationCounts.entries())
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    windowStartIso: startIso,
    windowEndIso: endIso,
    totalEvaluatedItems: total,
    blockRatePct,
    fallbackShareOfShippedPct,
    byRecommendedAction: byAction,
    topViolations,
  };
}
