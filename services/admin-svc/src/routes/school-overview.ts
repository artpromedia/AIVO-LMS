/**
 * School overview read model — real counts, completion, IEP, rostering, and
 * per-class metrics for the school dashboard (apps/web-admin/app/school). No
 * mock reads: every figure is aggregated from the identity/learning tables
 * scoped to the school tenant.
 */
import type { FastifyInstance } from "fastify";
import {
  adminClassrooms,
  gradebookEntries,
  iepGoals,
  iepProfiles,
  learnerImportJobs,
  learners,
  lessonSessions,
  teacherLessonAssignments,
  users,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { and, count, desc, eq, gte, isNull } from "drizzle-orm";
import { utcDayKey } from "../lib/usage-trends.js";

/** Window used for the term-progress trend + completion rate. */
const TERM_WINDOW_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const ALLOWED_ROLES = new Set(["SCHOOL_ADMIN", "DISTRICT_ADMIN", "PLATFORM_ADMIN"]);

/**
 * Functioning level → display label + stable ordering. This is the real,
 * truthful "support type" breakdown for a school (the platform's 5 functioning
 * levels), not a fabricated General-Ed / Reading / Speech split.
 */
const FUNCTIONING_LEVELS: Array<{ key: string; label: string }> = [
  { key: "STANDARD", label: "Standard" },
  { key: "SUPPORTED", label: "Supported" },
  { key: "LOW_VERBAL", label: "Low verbal" },
  { key: "NON_VERBAL", label: "Non-verbal" },
  { key: "PRE_SYMBOLIC", label: "Pre-symbolic" },
];

/**
 * RBAC: allowed for SCHOOL_ADMIN, DISTRICT_ADMIN, PLATFORM_ADMIN.
 * Note: finer school-ownership scoping (which `:schoolId` a caller may read) is
 * enforced at the BFF/identity layer — the web-admin BFF only ever calls this
 * with the caller's own `session.tenantId`. Mirrors the classroom routes.
 */
async function requireSchoolAdmin(req: any, reply: any) {
  const auth = req.headers.authorization as string | undefined;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "missing_bearer_token" });
    return null;
  }
  try {
    const payload = (await verifyJWT(auth.slice(7).trim())) as { sub: string; role: string };
    if (!ALLOWED_ROLES.has(payload.role)) {
      reply.code(403).send({ error: "forbidden", required_roles: [...ALLOWED_ROLES] });
      return null;
    }
    return payload;
  } catch {
    reply.code(401).send({ error: "invalid_token" });
    return null;
  }
}

/** Class health from its strongest available signal (mastery, then completion). */
function classStatus(metric: number | null): "on_track" | "at_risk" | "needs_support" | "no_data" {
  if (metric === null) return "no_data";
  if (metric >= 75) return "on_track";
  if (metric >= 60) return "at_risk";
  return "needs_support";
}

/** Gradebook mastery is stored 0..1; tolerate already-scaled 0..100 values. */
function toPct(score: number): number {
  return score <= 1 ? score * 100 : score;
}

export function registerSchoolOverviewRoutes(app: FastifyInstance, db: any) {
  app.get<{ Params: { schoolId: string } }>(
    "/admin/schools/:schoolId/overview",
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;
      const { schoolId } = req.params;
      const now = new Date();
      const termSince = new Date(now.getTime() - (TERM_WINDOW_DAYS - 1) * DAY_MS);
      termSince.setUTCHours(0, 0, 0, 0);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * DAY_MS);
      const todayKey = utcDayKey(now);

      const [
        learnerRows,
        teacherRows,
        classRows,
        sessionRows,
        gradebookRows,
        iepLearnerRows,
        [iepGoalRow],
        assignmentRows,
        importRows,
      ] = await Promise.all([
        db
          .select({
            id: learners.id,
            functioningLevel: learners.functioningLevel,
            createdAt: learners.createdAt,
          })
          .from(learners)
          .where(eq(learners.tenantId, schoolId)),
        db
          .select({ id: users.id, name: users.name })
          .from(users)
          .where(
            and(
              eq(users.tenantId, schoolId),
              eq(users.role, "TEACHER"),
              isNull(users.deactivatedAt),
            ),
          ),
        db
          .select({
            id: adminClassrooms.id,
            name: adminClassrooms.name,
            grade: adminClassrooms.grade,
            teacherIds: adminClassrooms.teacherIds,
            learnerIds: adminClassrooms.learnerIds,
            createdAt: adminClassrooms.createdAt,
          })
          .from(adminClassrooms)
          .where(eq(adminClassrooms.schoolId, schoolId)),
        db
          .select({
            learnerId: lessonSessions.learnerId,
            status: lessonSessions.status,
            startedAt: lessonSessions.startedAt,
          })
          .from(lessonSessions)
          .where(and(eq(lessonSessions.tenantId, schoolId), gte(lessonSessions.startedAt, termSince))),
        db
          .select({ learnerId: gradebookEntries.learnerId, masteryScore: gradebookEntries.masteryScore })
          .from(gradebookEntries)
          .where(eq(gradebookEntries.tenantId, schoolId)),
        db
          .select({ learnerId: iepProfiles.learnerId })
          .from(iepProfiles)
          .innerJoin(learners, eq(iepProfiles.learnerId, learners.id))
          .where(eq(learners.tenantId, schoolId)),
        db
          .select({ count: count() })
          .from(iepGoals)
          .innerJoin(learners, eq(iepGoals.learnerId, learners.id))
          .where(and(eq(learners.tenantId, schoolId), eq(iepGoals.status, "active"))),
        db
          .select({
            learnerIds: teacherLessonAssignments.learnerIds,
            dueDate: teacherLessonAssignments.dueDate,
          })
          .from(teacherLessonAssignments)
          .where(
            and(
              eq(teacherLessonAssignments.tenantId, schoolId),
              eq(teacherLessonAssignments.status, "active"),
            ),
          ),
        db
          .select({
            jobId: learnerImportJobs.jobId,
            status: learnerImportJobs.status,
            progress: learnerImportJobs.progress,
            errors: learnerImportJobs.errors,
            createdAt: learnerImportJobs.createdAt,
          })
          .from(learnerImportJobs)
          .where(eq(learnerImportJobs.schoolId, schoolId))
          .orderBy(desc(learnerImportJobs.createdAt))
          .limit(6),
      ]);

      const teacherMap = new Map<string, string>(
        (teacherRows as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]),
      );

      // Lesson-session rollups: school-wide completion, per-day trend, per-learner.
      let schoolCompleted = 0;
      let schoolTotal = 0;
      const sessByLearner = new Map<string, { c: number; t: number }>();
      const sessByDay = new Map<string, { c: number; t: number }>();
      for (const s of sessionRows as Array<{ learnerId: string; status: string | null; startedAt: Date | string }>) {
        const done = s.status === "COMPLETED";
        schoolTotal += 1;
        if (done) schoolCompleted += 1;
        const lb = sessByLearner.get(s.learnerId) ?? { c: 0, t: 0 };
        lb.t += 1;
        if (done) lb.c += 1;
        sessByLearner.set(s.learnerId, lb);
        const day = utcDayKey(new Date(s.startedAt));
        const dayBucket = sessByDay.get(day) ?? { c: 0, t: 0 };
        dayBucket.t += 1;
        if (done) dayBucket.c += 1;
        sessByDay.set(day, dayBucket);
      }
      const completionRate = schoolTotal > 0 ? Math.round((schoolCompleted / schoolTotal) * 100) : 0;

      // Continuous zero-filled completion trend across the term window (UTC).
      const termTrend = Array.from({ length: TERM_WINDOW_DAYS }, (_, index) => {
        const day = utcDayKey(new Date(termSince.getTime() + index * DAY_MS));
        const bucket = sessByDay.get(day);
        return { day, completionRate: bucket && bucket.t > 0 ? Math.round((bucket.c / bucket.t) * 100) : 0 };
      });

      // Per-learner mastery (averaged across the learner's gradebook skills).
      const masteryByLearner = new Map<string, { sum: number; count: number }>();
      for (const g of gradebookRows as Array<{ learnerId: string; masteryScore: number | null }>) {
        // Skip rows with no recorded mastery so they don't drag averages to 0.
        if (g.masteryScore === null || g.masteryScore === undefined) continue;
        const m = masteryByLearner.get(g.learnerId) ?? { sum: 0, count: 0 };
        m.sum += toPct(Number(g.masteryScore));
        m.count += 1;
        masteryByLearner.set(g.learnerId, m);
      }

      const iepSet = new Set(
        (iepLearnerRows as Array<{ learnerId: string }>).map((row) => row.learnerId),
      );

      // Assignments still due (real future due dates, school-scoped, active only).
      const dueAssignments = (assignmentRows as Array<{ learnerIds: unknown; dueDate: string | null }>).filter(
        (a) => {
          const due = a.dueDate ? String(a.dueDate).slice(0, 10) : null;
          return due !== null && due >= todayKey;
        },
      );

      // Support breakdown by functioning level (real, ordered).
      const flCount = new Map<string, number>();
      for (const l of learnerRows as Array<{ functioningLevel: string | null }>) {
        const key = l.functioningLevel ?? "STANDARD";
        flCount.set(key, (flCount.get(key) ?? 0) + 1);
      }
      const supportBreakdown = FUNCTIONING_LEVELS.filter((f) => (flCount.get(f.key) ?? 0) > 0).map((f) => ({
        label: f.label,
        count: flCount.get(f.key) ?? 0,
      }));

      const newLearners30d = (learnerRows as Array<{ createdAt: Date | string }>).filter(
        (l) => new Date(l.createdAt) >= thirtyDaysAgo,
      ).length;
      const newClasses30d = (classRows as Array<{ createdAt: Date | string }>).filter(
        (c) => new Date(c.createdAt) >= thirtyDaysAgo,
      ).length;

      // Per-class metrics.
      const classes = (
        classRows as Array<{
          id: string;
          name: string;
          grade: string | null;
          teacherIds: string[] | null;
          learnerIds: string[] | null;
          createdAt: Date | string;
        }>
      )
        .map((c) => {
          const ids = Array.isArray(c.learnerIds) ? c.learnerIds : [];
          const idSet = new Set(ids);

          let masterySum = 0;
          let masteryCount = 0;
          let completed = 0;
          let totalSessions = 0;
          let iepLearners = 0;
          for (const id of ids) {
            const m = masteryByLearner.get(id);
            if (m && m.count > 0) {
              masterySum += m.sum / m.count;
              masteryCount += 1;
            }
            const s = sessByLearner.get(id);
            if (s) {
              completed += s.c;
              totalSessions += s.t;
            }
            if (iepSet.has(id)) iepLearners += 1;
          }
          const avgMastery = masteryCount > 0 ? Math.round(masterySum / masteryCount) : null;
          const classCompletion = totalSessions > 0 ? Math.round((completed / totalSessions) * 100) : null;

          let assignmentsDue = 0;
          for (const a of dueAssignments) {
            const al = Array.isArray(a.learnerIds) ? (a.learnerIds as string[]) : [];
            if (al.some((x) => idSet.has(x))) assignmentsDue += 1;
          }

          const teacherName =
            Array.isArray(c.teacherIds) && c.teacherIds.length > 0
              ? teacherMap.get(c.teacherIds[0]) ?? null
              : null;

          return {
            id: c.id,
            name: c.name,
            grade: c.grade,
            teacherName,
            learners: ids.length,
            avgMastery,
            assignmentsDue,
            iepLearners,
            completionRate: classCompletion,
            status: classStatus(avgMastery ?? classCompletion),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      // Rostering: learners assigned to at least one class vs. unassigned.
      const assignedSet = new Set<string>();
      for (const c of classRows as Array<{ learnerIds: string[] | null }>) {
        for (const id of Array.isArray(c.learnerIds) ? c.learnerIds : []) assignedSet.add(id);
      }
      const totalLearners = (learnerRows as Array<{ id: string }>).length;
      let complete = 0;
      for (const l of learnerRows as Array<{ id: string }>) {
        if (assignedSet.has(l.id)) complete += 1;
      }
      const rostering = { total: totalLearners, complete, unassigned: totalLearners - complete };

      const recentImports = (
        importRows as Array<{
          jobId: string;
          status: string;
          progress: unknown;
          errors: string[] | null;
          createdAt: Date | string;
        }>
      ).map((r) => {
        const progress = (r.progress && typeof r.progress === "object" ? r.progress : {}) as Record<
          string,
          unknown
        >;
        return {
          jobId: r.jobId,
          status: String(r.status),
          total: Number(progress.total ?? 0),
          errors: Array.isArray(r.errors) ? r.errors.length : 0,
          createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
        };
      });

      return {
        schoolId,
        generatedAt: now.toISOString(),
        windowDays: TERM_WINDOW_DAYS,
        counts: {
          learners: totalLearners,
          teachers: (teacherRows as unknown[]).length,
          classes: (classRows as unknown[]).length,
        },
        completionRate,
        activeIepGoals: Number(iepGoalRow?.count ?? 0),
        newLearners30d,
        newClasses30d,
        supportBreakdown,
        termTrend,
        classes,
        rostering,
        recentImports,
      };
    },
  );
}
