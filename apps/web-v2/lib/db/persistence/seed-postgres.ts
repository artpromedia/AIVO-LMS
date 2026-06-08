/**
 * Postgres seed — mirrors the in-memory seed into the durable web_*
 * tables so a fresh `AIVO_PERSISTENCE=postgres` deployment starts with
 * the same reference + demo data as memory mode.
 *
 * Reuses `ensureSeeded()` (the single source of truth) and then bulk-
 * inserts the resulting domain objects via the same column mapping the
 * adapters use. Idempotent on natural-key tables (onConflictDoNothing);
 * intended to run once against a fresh database.
 *
 *   AIVO_SEED_DATABASE_URL=postgres://… pnpm --filter @aivo/web-v2 \
 *     exec tsx lib/db/persistence/seed-postgres.ts   (see db:seed:postgres)
 */
import type { Database } from "@aivo/db";
import type { PgColumn, PgTable } from "drizzle-orm/pg-core";
import {
  webNotifications,
  webNotificationDeliveries,
  webAuditLogs,
  webUsers,
  webMemberships,
  webLearnerProfiles,
  webParentLearnerRelationships,
  webParentAssessments,
  webBaselineAssessments,
  webBaselineQuestions,
  webBaselineAttempts,
  webBaselineTelemetry,
  webSubjects,
  webSkills,
  webMasteryMaps,
  webSkillMasteries,
  webLearningPaths,
  webConsentRecords,
  webIepDocuments,
  webAgeGateRecords,
  webPolicyVersions,
  webSubprocessors,
  webQuestWorlds,
  webQuestChapters,
  webQuestProgress,
  webSchools,
  webClassrooms,
  webEnrollments,
  webTeacherAssignments,
  learnerBrainProfiles,
  lessonRuns,
  generatedLessonPlans,
  lessonInteractions,
  lessonParentSummaries,
  webBillingAccounts,
  webAiBudgets,
  webAiCostEvents,
  webCoupons,
  webDailyBillingBatches,
  webIepAiDrafts,
  webSecurityControls,
  webControlEvidence,
  webRiskRegister,
  webIncidents,
  webIncidentTimeline,
  webVendors,
  webStatePrivacyRequirements,
  webStatePrivacyMappings,
  webVulnerabilityReports,
  webConsentVersions,
  webTermsAcceptances,
  webDataInventory,
  webDataRetentionPolicies,
  webDisclosureLogs,
  webDataExportRequests,
  webDataDeletionRequests,
  webIepDocAccessLogs,
} from "@aivo/db";
import { getStore } from "@/lib/db/store";
import { ensureSeeded } from "@/lib/db/seed";

function vals<T>(c: Map<string, T> | T[]): T[] {
  return Array.isArray(c) ? c : Array.from(c.values());
}

/**
 * Insert in chunks; skip duplicates on a natural-key target. Idempotent:
 * re-running against an already-seeded database is a no-op (every row
 * conflicts and is dropped). Returns the count of rows that actually
 * landed (via RETURNING), so a second pass reports `0` and callers /
 * tests can observe idempotency rather than the attempted count.
 */
async function bulk<R extends Record<string, unknown>>(
  db: Database,
  table: PgTable,
  rows: R[],
  conflictTarget?: PgColumn | PgColumn[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const CHUNK = 500;
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const q = db.insert(table).values(slice);
    const landed = await (conflictTarget
      ? q.onConflictDoNothing({ target: conflictTarget }).returning()
      : q.onConflictDoNothing().returning());
    n += (landed as unknown[]).length;
  }
  return n;
}

export interface SeedResult {
  inserted: Record<string, number>;
}

export async function seedPostgres(db: Database): Promise<SeedResult> {
  ensureSeeded();
  const s = getStore();
  const inserted: Record<string, number> = {};
  const log = async (name: string, count: number) => {
    inserted[name] = count;
  };

  await log(
    "notifications",
    await bulk(
      db,
      webNotifications,
      vals(s.notifications).map((n) => ({
        id: n.id,
        tenantId: n.tenantId,
        userId: n.userId,
        readAt: n.readAt ?? null,
        createdAt: n.createdAt,
        data: n,
      })),
      webNotifications.id,
    ),
  );
  await log(
    "notificationDeliveries",
    await bulk(
      db,
      webNotificationDeliveries,
      vals(s.notificationDeliveries).map((d) => ({
        id: d.id,
        notificationId: d.notificationId,
        data: d,
      })),
      webNotificationDeliveries.id,
    ),
  );
  await log(
    "audit",
    await bulk(
      db,
      webAuditLogs,
      vals(s.auditLogs).map((l) => ({ tenantId: l.tenantId ?? null, data: l })),
    ),
  );
  await log(
    "users",
    await bulk(
      db,
      webUsers,
      vals(s.users).map((u) => ({
        id: u.id,
        tenantId: (u as { tenantId?: string | null }).tenantId ?? null,
        data: u,
      })),
      webUsers.id,
    ),
  );
  await log(
    "memberships",
    await bulk(
      db,
      webMemberships,
      vals(s.memberships).map((m) => ({
        userId: m.userId,
        tenantId: m.tenantId,
        createdAt: m.createdAt,
        data: m,
      })),
    ),
  );
  await log(
    "learnerProfiles",
    await bulk(
      db,
      webLearnerProfiles,
      vals(s.learnerProfiles).map((l) => ({ id: l.id, tenantId: l.tenantId, data: l })),
      webLearnerProfiles.id,
    ),
  );
  await log(
    "parentLearnerRelationships",
    await bulk(
      db,
      webParentLearnerRelationships,
      vals(s.parentLearnerRelationships).map((r) => ({
        id: r.id,
        parentUserId: r.parentUserId,
        learnerId: r.learnerId,
        tenantId: r.tenantId,
        data: r,
      })),
      webParentLearnerRelationships.id,
    ),
  );
  await log(
    "parentAssessments",
    await bulk(
      db,
      webParentAssessments,
      vals(s.parentAssessments).map((a) => ({
        id: a.id,
        learnerId: a.learnerId,
        tenantId: a.tenantId,
        data: a,
      })),
      webParentAssessments.id,
    ),
  );
  await log(
    "baselineAssessments",
    await bulk(
      db,
      webBaselineAssessments,
      vals(s.baselineAssessments).map((b) => ({
        id: b.id,
        learnerId: b.learnerId,
        tenantId: b.tenantId,
        data: b,
      })),
      webBaselineAssessments.id,
    ),
  );
  await log(
    "baselineQuestions",
    await bulk(
      db,
      webBaselineQuestions,
      vals(s.baselineQuestions).map((q) => ({ id: q.id, baselineId: q.baselineId, data: q })),
      webBaselineQuestions.id,
    ),
  );
  await log(
    "baselineAttempts",
    await bulk(
      db,
      webBaselineAttempts,
      vals(s.baselineAttempts).map((a) => ({
        id: a.id,
        baselineId: a.baselineId,
        tenantId: a.tenantId,
        questionId: a.questionId,
        learnerId: a.learnerId,
        data: a,
      })),
      webBaselineAttempts.id,
    ),
  );
  await log(
    "baselineTelemetry",
    await bulk(
      db,
      webBaselineTelemetry,
      vals(s.baselineItemResponseLogs).map((l) => ({
        tenantId: l.tenantId,
        learnerId: l.learnerId ?? null,
        data: l,
      })),
    ),
  );
  await log(
    "subjects",
    await bulk(
      db,
      webSubjects,
      vals(s.subjects).map((x) => ({ id: x.id, data: x })),
      webSubjects.id,
    ),
  );
  await log(
    "skills",
    await bulk(
      db,
      webSkills,
      vals(s.skills).map((x) => ({ id: x.id, subjectId: x.subjectId ?? null, data: x })),
      webSkills.id,
    ),
  );
  await log(
    "masteryMaps",
    await bulk(
      db,
      webMasteryMaps,
      vals(s.masteryMaps).map((m) => ({
        id: m.id,
        learnerId: m.learnerId,
        tenantId: m.tenantId,
        data: m,
      })),
      webMasteryMaps.id,
    ),
  );
  await log(
    "skillMasteries",
    await bulk(
      db,
      webSkillMasteries,
      vals(s.skillMasteries).map((m) => ({
        id: (m as { id?: string }).id,
        learnerId: m.learnerId,
        tenantId: m.tenantId,
        data: m,
      })),
      webSkillMasteries.id,
    ),
  );
  await log(
    "learningPaths",
    await bulk(
      db,
      webLearningPaths,
      vals(s.learningPaths).map((p) => ({
        id: p.id,
        learnerId: p.learnerId,
        tenantId: p.tenantId,
        data: p,
      })),
      webLearningPaths.id,
    ),
  );
  await log(
    "consentRecords",
    await bulk(
      db,
      webConsentRecords,
      vals(s.consentRecords).map((c) => ({
        id: c.id,
        parentUserId: c.parentUserId,
        learnerId: c.learnerId ?? null,
        tenantId: c.tenantId,
        data: c,
      })),
      webConsentRecords.id,
    ),
  );
  await log(
    "iepDocuments",
    await bulk(
      db,
      webIepDocuments,
      vals(s.iepDocuments).map((d) => ({
        id: d.id,
        learnerId: d.learnerId,
        tenantId: d.tenantId,
        data: d,
      })),
      webIepDocuments.id,
    ),
  );
  await log(
    "ageGateRecords",
    await bulk(
      db,
      webAgeGateRecords,
      vals(s.ageGateRecords).map((r) => ({
        learnerId: r.learnerId,
        tenantId: r.tenantId,
        data: r,
      })),
      webAgeGateRecords.learnerId,
    ),
  );
  await log(
    "policyVersions",
    await bulk(
      db,
      webPolicyVersions,
      vals(s.policyVersions).map((p) => ({ id: p.id, data: p })),
      webPolicyVersions.id,
    ),
  );
  await log(
    "subprocessors",
    await bulk(
      db,
      webSubprocessors,
      vals(s.subprocessors).map((x) => ({ id: x.id, data: x })),
      webSubprocessors.id,
    ),
  );
  await log(
    "questWorlds",
    await bulk(
      db,
      webQuestWorlds,
      vals(s.questWorlds).map((w) => ({ id: w.id, data: w })),
      webQuestWorlds.id,
    ),
  );
  await log(
    "questChapters",
    await bulk(
      db,
      webQuestChapters,
      vals(s.questChapters).map((c) => ({ id: c.id, worldId: c.questWorldId, data: c })),
      webQuestChapters.id,
    ),
  );
  await log(
    "questProgress",
    await bulk(
      db,
      webQuestProgress,
      vals(s.questProgress).map((p) => ({
        id: p.id,
        learnerId: p.learnerId,
        tenantId: p.tenantId,
        data: p,
      })),
      webQuestProgress.id,
    ),
  );
  await log(
    "teacherAssignments",
    await bulk(
      db,
      webTeacherAssignments,
      vals(s.teacherAssignments).map((a) => ({
        id: a.id,
        teacherId: a.teacherId,
        tenantId: a.tenantId,
        data: a,
      })),
      webTeacherAssignments.id,
    ),
  );
  // schools / classrooms / enrollments — present in some seed profiles.
  type SchoolRow = { id: string; tenantId: string };
  type EnrollmentRow = { id: string; classroomId: string; tenantId: string };
  const anyStore = s as typeof s & {
    schools?: Map<string, SchoolRow> | SchoolRow[];
    classrooms?: Map<string, SchoolRow> | SchoolRow[];
    enrollments?: Map<string, EnrollmentRow> | EnrollmentRow[];
  };
  if (anyStore.schools) {
    await log(
      "schools",
      await bulk(
        db,
        webSchools,
        vals(anyStore.schools).map((x) => ({ id: x.id, tenantId: x.tenantId, data: x })),
        webSchools.id,
      ),
    );
  }
  if (anyStore.classrooms) {
    await log(
      "classrooms",
      await bulk(
        db,
        webClassrooms,
        vals(anyStore.classrooms).map((x) => ({ id: x.id, tenantId: x.tenantId, data: x })),
        webClassrooms.id,
      ),
    );
  }
  if (anyStore.enrollments) {
    await log(
      "enrollments",
      await bulk(
        db,
        webEnrollments,
        vals(anyStore.enrollments).map((x) => ({
          id: x.id,
          classroomId: x.classroomId,
          tenantId: x.tenantId,
          data: x,
        })),
        webEnrollments.id,
      ),
    );
  }
  await log(
    "brainProfiles",
    await bulk(
      db,
      learnerBrainProfiles,
      vals(s.brainProfiles).map((p) => ({
        id: p.id,
        learnerId: p.learnerId,
        tenantId: p.tenantId,
        approvalStatus: p.approvalStatus,
        cloneStage: p.cloneStage,
        approvedByParent: p.approvedByParent,
        clonedAt: p.clonedAt ?? null,
        generatedAt: p.generatedAt,
        updatedAt: p.updatedAt,
        state: p.state,
      })),
      learnerBrainProfiles.id,
    ),
  );
  await log(
    "lessonRuns",
    await bulk(
      db,
      lessonRuns,
      vals(s.lessonRuns).map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        learnerId: r.learnerId,
        subjectId: r.subjectId,
        skillId: r.skillId,
        source: r.source,
        sourceRefId: r.sourceRefId,
        tutorPersona: r.tutorPersona,
        lessonPlanId: r.lessonPlanId,
        status: r.status,
        retryCount: r.retryCount ?? 0,
        failureReason: r.failureReason,
        startedAt: r.startedAt,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        snapshots: {
          learnerContextSnapshot: r.learnerContextSnapshot,
          masterySnapshot: r.masterySnapshot,
          accommodationSnapshot: r.accommodationSnapshot,
          brainStateSnapshot: r.brainStateSnapshot,
        },
      })),
      lessonRuns.id,
    ),
  );
  await log(
    "generatedLessonPlans",
    await bulk(
      db,
      generatedLessonPlans,
      vals(s.generatedLessonPlans).map((p) => ({
        id: p.id,
        tenantId: p.tenantId,
        lessonRunId: p.lessonRunId,
        data: p,
      })),
      generatedLessonPlans.id,
    ),
  );
  await log(
    "lessonInteractions",
    await bulk(
      db,
      lessonInteractions,
      vals(s.lessonInteractions).map((i) => ({
        id: i.id,
        lessonRunId: i.lessonRunId,
        learnerId: i.learnerId,
        tenantId: i.tenantId,
        stepKind: i.stepKind,
        stepRefId: i.stepRefId ?? null,
        response: i.response ?? null,
        isCorrect: i.isCorrect ?? null,
        skipped: i.skipped ?? false,
        occurredAt: i.occurredAt,
      })),
      lessonInteractions.id,
    ),
  );
  // ── Sprint 2: web-owned billing / AI-cost rows ──────────────────────
  await log(
    "billingAccounts",
    await bulk(
      db,
      webBillingAccounts,
      vals(s.billingAccounts).map((b) => ({
        id: b.id,
        tenantId: b.tenantId,
        createdAt: b.createdAt,
        data: b,
      })),
      webBillingAccounts.id,
    ),
  );
  await log(
    "aiBudgets",
    await bulk(
      db,
      webAiBudgets,
      vals(s.aiBudgets).map((b) => ({ tenantId: b.tenantId, updatedAt: b.updatedAt, data: b })),
      webAiBudgets.tenantId,
    ),
  );
  await log(
    "aiCostEvents",
    await bulk(
      db,
      webAiCostEvents,
      vals(s.aiCostEvents).map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        occurredAt: e.occurredAt,
        data: e,
      })),
      webAiCostEvents.id,
    ),
  );
  await log(
    "coupons",
    await bulk(
      db,
      webCoupons,
      vals(s.coupons).map((c) => ({ id: c.id, code: c.code, createdAt: c.createdAt, data: c })),
      webCoupons.id,
    ),
  );
  await log(
    "dailyBillingBatches",
    await bulk(
      db,
      webDailyBillingBatches,
      vals(s.dailyBillingBatches).map((b) => ({ id: b.id, runDate: b.runDate, data: b })),
      webDailyBillingBatches.id,
    ),
  );
  // ── Sprint 3: web-owned IEP AI-draft review inbox ───────────────────
  await log(
    "iepAiDrafts",
    await bulk(
      db,
      webIepAiDrafts,
      vals(s.iepAiDrafts).map((d) => ({
        id: d.id,
        learnerId: d.learnerId,
        tenantId: d.tenantId,
        updatedAt: d.updatedAt,
        data: d,
      })),
      webIepAiDrafts.id,
    ),
  );
  // ── Sprint 4: web-owned security / SOC 2 / privacy-matrix artifacts ──
  await log(
    "securityControls",
    await bulk(
      db,
      webSecurityControls,
      vals(s.securityControls).map((x) => ({ id: x.id, data: x })),
      webSecurityControls.id,
    ),
  );
  await log(
    "controlEvidence",
    await bulk(
      db,
      webControlEvidence,
      vals(s.securityControlEvidence).map((x) => ({ id: x.id, controlId: x.controlId, data: x })),
      webControlEvidence.id,
    ),
  );
  await log(
    "riskRegister",
    await bulk(
      db,
      webRiskRegister,
      vals(s.riskRegister).map((x) => ({ id: x.id, data: x })),
      webRiskRegister.id,
    ),
  );
  await log(
    "incidents",
    await bulk(
      db,
      webIncidents,
      vals(s.incidents).map((x) => ({ id: x.id, data: x })),
      webIncidents.id,
    ),
  );
  await log(
    "incidentTimeline",
    await bulk(
      db,
      webIncidentTimeline,
      vals(s.incidentTimelineEvents).map((x) => ({ id: x.id, incidentId: x.incidentId, data: x })),
      webIncidentTimeline.id,
    ),
  );
  await log(
    "vendors",
    await bulk(
      db,
      webVendors,
      vals(s.vendors).map((x) => ({ id: x.id, data: x })),
      webVendors.id,
    ),
  );
  await log(
    "statePrivacyRequirements",
    await bulk(
      db,
      webStatePrivacyRequirements,
      vals(s.statePrivacyRequirements).map((x) => ({ id: x.id, data: x })),
      webStatePrivacyRequirements.id,
    ),
  );
  await log(
    "statePrivacyMappings",
    await bulk(
      db,
      webStatePrivacyMappings,
      vals(s.statePrivacyMappings).map((x) => ({ id: x.id, requirementId: x.requirementId, data: x })),
      webStatePrivacyMappings.id,
    ),
  );
  await log(
    "vulnerabilityReports",
    await bulk(
      db,
      webVulnerabilityReports,
      vals(s.vulnerabilityReports).map((x) => ({ id: x.id, data: x })),
      webVulnerabilityReports.id,
    ),
  );
  // ── Sprint 5: web-owned privacy / DSAR / terms artifacts ────────────
  await log(
    "consentVersions",
    await bulk(
      db,
      webConsentVersions,
      vals(s.consentVersions).map((x) => ({ id: x.id, data: x })),
      webConsentVersions.id,
    ),
  );
  await log(
    "termsAcceptances",
    await bulk(
      db,
      webTermsAcceptances,
      vals(s.termsAcceptances).map((x) => ({ id: x.id, data: x })),
      webTermsAcceptances.id,
    ),
  );
  await log(
    "dataInventory",
    await bulk(
      db,
      webDataInventory,
      vals(s.dataInventory).map((x) => ({ id: x.id, data: x })),
      webDataInventory.id,
    ),
  );
  await log(
    "dataRetentionPolicies",
    await bulk(
      db,
      webDataRetentionPolicies,
      vals(s.dataRetentionPolicies).map((x) => ({ id: x.id, data: x })),
      webDataRetentionPolicies.id,
    ),
  );
  await log(
    "disclosureLogs",
    await bulk(
      db,
      webDisclosureLogs,
      vals(s.disclosureLogs).map((x) => ({ id: x.id, tenantId: x.tenantId, data: x })),
      webDisclosureLogs.id,
    ),
  );
  await log(
    "dataExportRequests",
    await bulk(
      db,
      webDataExportRequests,
      vals(s.dataExportRequests).map((x) => ({ id: x.id, data: x })),
      webDataExportRequests.id,
    ),
  );
  await log(
    "dataDeletionRequests",
    await bulk(
      db,
      webDataDeletionRequests,
      vals(s.dataDeletionRequests).map((x) => ({ id: x.id, data: x })),
      webDataDeletionRequests.id,
    ),
  );
  await log(
    "iepDocAccessLogs",
    await bulk(
      db,
      webIepDocAccessLogs,
      vals(s.iepDocumentAccessLogs).map((x) => ({
        id: x.id,
        learnerId: x.learnerId,
        tenantId: x.tenantId,
        data: x,
      })),
      webIepDocAccessLogs.id,
    ),
  );
  await log(
    "lessonParentSummaries",
    await bulk(
      db,
      lessonParentSummaries,
      vals(s.parentLessonSummaries).map((x) => ({
        id: x.id,
        lessonRunId: x.lessonRunId,
        tenantId: x.tenantId,
        learnerId: x.learnerId,
        data: x,
      })),
      lessonParentSummaries.id,
    ),
  );

  return { inserted };
}
