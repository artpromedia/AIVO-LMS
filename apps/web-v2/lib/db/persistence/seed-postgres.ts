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
} from "@aivo/db";
import { getStore } from "@/lib/db/store";
import { ensureSeeded } from "@/lib/db/seed";

function vals<T>(c: Map<string, T> | T[]): T[] {
  return Array.isArray(c) ? c : Array.from(c.values());
}

/** Insert in chunks; skip duplicates on a natural-key target. */
async function bulk<R extends Record<string, unknown>>(
  db: Database,
  table: any,
  rows: R[],
  conflictTarget?: any,
): Promise<number> {
  if (rows.length === 0) return 0;
  const CHUNK = 500;
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK);
    const q = db.insert(table).values(slice);
    await (conflictTarget
      ? q.onConflictDoNothing({ target: conflictTarget })
      : q.onConflictDoNothing());
    n += slice.length;
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
      vals(s.notifications).map((n: any) => ({
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
      vals(s.notificationDeliveries).map((d: any) => ({
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
      vals(s.auditLogs).map((l: any) => ({ tenantId: l.tenantId ?? null, data: l })),
    ),
  );
  await log(
    "users",
    await bulk(
      db,
      webUsers,
      vals(s.users).map((u: any) => ({ id: u.id, tenantId: u.tenantId ?? null, data: u })),
      webUsers.id,
    ),
  );
  await log(
    "memberships",
    await bulk(
      db,
      webMemberships,
      vals(s.memberships).map((m: any) => ({
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
      vals(s.learnerProfiles).map((l: any) => ({ id: l.id, tenantId: l.tenantId, data: l })),
      webLearnerProfiles.id,
    ),
  );
  await log(
    "parentLearnerRelationships",
    await bulk(
      db,
      webParentLearnerRelationships,
      vals(s.parentLearnerRelationships).map((r: any) => ({
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
      vals(s.parentAssessments).map((a: any) => ({
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
      vals(s.baselineAssessments).map((b: any) => ({
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
      vals(s.baselineQuestions).map((q: any) => ({ id: q.id, baselineId: q.baselineId, data: q })),
      webBaselineQuestions.id,
    ),
  );
  await log(
    "baselineAttempts",
    await bulk(
      db,
      webBaselineAttempts,
      vals(s.baselineAttempts).map((a: any) => ({
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
      vals(s.baselineItemResponseLogs).map((l: any) => ({
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
      vals(s.subjects).map((x: any) => ({ id: x.id, data: x })),
      webSubjects.id,
    ),
  );
  await log(
    "skills",
    await bulk(
      db,
      webSkills,
      vals(s.skills).map((x: any) => ({ id: x.id, subjectId: x.subjectId ?? null, data: x })),
      webSkills.id,
    ),
  );
  await log(
    "masteryMaps",
    await bulk(
      db,
      webMasteryMaps,
      vals(s.masteryMaps).map((m: any) => ({
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
      vals(s.skillMasteries).map((m: any) => ({
        id: m.id,
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
      vals(s.learningPaths).map((p: any) => ({
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
      vals(s.consentRecords).map((c: any) => ({
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
      vals(s.iepDocuments).map((d: any) => ({
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
      vals(s.ageGateRecords).map((r: any) => ({
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
      vals(s.policyVersions).map((p: any) => ({ id: p.id, data: p })),
      webPolicyVersions.id,
    ),
  );
  await log(
    "subprocessors",
    await bulk(
      db,
      webSubprocessors,
      vals(s.subprocessors).map((x: any) => ({ id: x.id, data: x })),
      webSubprocessors.id,
    ),
  );
  await log(
    "questWorlds",
    await bulk(
      db,
      webQuestWorlds,
      vals(s.questWorlds).map((w: any) => ({ id: w.id, data: w })),
      webQuestWorlds.id,
    ),
  );
  await log(
    "questChapters",
    await bulk(
      db,
      webQuestChapters,
      vals(s.questChapters).map((c: any) => ({ id: c.id, worldId: c.questWorldId, data: c })),
      webQuestChapters.id,
    ),
  );
  await log(
    "questProgress",
    await bulk(
      db,
      webQuestProgress,
      vals(s.questProgress).map((p: any) => ({
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
      vals(s.teacherAssignments).map((a: any) => ({
        id: a.id,
        teacherId: a.teacherId,
        tenantId: a.tenantId,
        data: a,
      })),
      webTeacherAssignments.id,
    ),
  );
  // schools / classrooms / enrollments — present in some seed profiles.
  const anyStore = s as any;
  if (anyStore.schools) {
    await log(
      "schools",
      await bulk(
        db,
        webSchools,
        vals(anyStore.schools).map((x: any) => ({ id: x.id, tenantId: x.tenantId, data: x })),
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
        vals(anyStore.classrooms).map((x: any) => ({ id: x.id, tenantId: x.tenantId, data: x })),
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
        vals(anyStore.enrollments).map((x: any) => ({
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
      vals(s.brainProfiles).map((p: any) => ({
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
      vals(s.lessonRuns).map((r: any) => ({
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
      vals(s.generatedLessonPlans).map((p: any) => ({
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
      vals(s.lessonInteractions).map((i: any) => ({
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
  await log(
    "lessonParentSummaries",
    await bulk(
      db,
      lessonParentSummaries,
      vals(s.parentLessonSummaries).map((x: any) => ({
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
