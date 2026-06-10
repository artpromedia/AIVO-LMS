/**
 * School overview read model — real counts and series for the school
 * dashboard (apps/web-admin/app/school). No mock reads: learners/teachers
 * come from the identity tables, class sizes from admin_classrooms, and the
 * activity series from lesson_runs, all scoped to the school tenant.
 */
import type { FastifyInstance } from "fastify";
import { adminClassrooms, learners, lessonRuns, users } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { and, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { trendWindowStart, utcDayKey } from "../lib/usage-trends.js";

const ACTIVITY_WINDOW_DAYS = 7;

const ALLOWED_ROLES = new Set(["SCHOOL_ADMIN", "DISTRICT_ADMIN", "PLATFORM_ADMIN"]);

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

export function registerSchoolOverviewRoutes(app: FastifyInstance, db: any) {
  app.get<{ Params: { schoolId: string } }>(
    "/admin/schools/:schoolId/overview",
    async (req, reply) => {
      const actor = await requireSchoolAdmin(req, reply);
      if (!actor) return;
      const { schoolId } = req.params;
      const now = new Date();
      const since = trendWindowStart(ACTIVITY_WINDOW_DAYS, now);

      const [
        [learnerTotal],
        [teacherTotal],
        [classTotal],
        gradeRows,
        classRows,
        runDayRows,
        recentRuns,
      ] = await Promise.all([
        db.select({ count: count() }).from(learners).where(eq(learners.tenantId, schoolId)),
        db
          .select({ count: count() })
          .from(users)
          .where(
            and(
              eq(users.tenantId, schoolId),
              eq(users.role, "TEACHER"),
              isNull(users.deactivatedAt),
            ),
          ),
        db
          .select({ count: count() })
          .from(adminClassrooms)
          .where(eq(adminClassrooms.schoolId, schoolId)),
        db
          .select({ grade: learners.gradeLevel, count: count() })
          .from(learners)
          .where(eq(learners.tenantId, schoolId))
          .groupBy(learners.gradeLevel),
        db
          .select({
            id: adminClassrooms.id,
            name: adminClassrooms.name,
            grade: adminClassrooms.grade,
            learnerIds: adminClassrooms.learnerIds,
          })
          .from(adminClassrooms)
          .where(eq(adminClassrooms.schoolId, schoolId)),
        db
          .select({
            day: sql<string>`substring(${lessonRuns.createdAt} from 1 for 10)`,
            count: count(),
          })
          .from(lessonRuns)
          .where(
            and(
              eq(lessonRuns.tenantId, schoolId),
              gte(lessonRuns.createdAt, since.toISOString()),
            ),
          )
          .groupBy(sql`substring(${lessonRuns.createdAt} from 1 for 10)`),
        db
          .select({
            id: lessonRuns.id,
            learnerId: lessonRuns.learnerId,
            status: lessonRuns.status,
            createdAt: lessonRuns.createdAt,
          })
          .from(lessonRuns)
          .where(eq(lessonRuns.tenantId, schoolId))
          .orderBy(desc(lessonRuns.createdAt))
          .limit(8),
      ]);

      // Continuous zero-filled 7-day activity window ending today (UTC).
      const runsByDay = new Map<string, number>(
        (runDayRows as Array<{ day: string; count: number }>).map((row) => [
          row.day,
          Number(row.count ?? 0),
        ]),
      );
      const activity = Array.from({ length: ACTIVITY_WINDOW_DAYS }, (_, index) => {
        const day = utcDayKey(new Date(since.getTime() + index * 24 * 60 * 60 * 1000));
        return { day, lessonRuns: runsByDay.get(day) ?? 0 };
      });

      // Learner names for the recent-activity table (best effort).
      const learnerIds = [
        ...new Set((recentRuns as Array<{ learnerId: string }>).map((row) => row.learnerId)),
      ];
      const nameRows = learnerIds.length
        ? await db
            .select({ id: learners.id, name: learners.name })
            .from(learners)
            .where(inArray(learners.id, learnerIds))
        : [];
      const nameById = new Map(
        (nameRows as Array<{ id: string; name: string }>).map((row) => [row.id, row.name]),
      );

      return {
        schoolId,
        generatedAt: now.toISOString(),
        windowDays: ACTIVITY_WINDOW_DAYS,
        counts: {
          learners: Number(learnerTotal?.count ?? 0),
          teachers: Number(teacherTotal?.count ?? 0),
          classes: Number(classTotal?.count ?? 0),
        },
        learnersByGrade: (gradeRows as Array<{ grade: string | null; count: number }>)
          .map((row) => ({ grade: row.grade ?? "Ungraded", count: Number(row.count ?? 0) }))
          .sort((a, b) => a.grade.localeCompare(b.grade, "en", { numeric: true })),
        classSizes: (classRows as Array<{ id: string; name: string; grade: string | null; learnerIds: string[] }>)
          .map((row) => ({
            id: row.id,
            name: row.name,
            grade: row.grade,
            learners: Array.isArray(row.learnerIds) ? row.learnerIds.length : 0,
          }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        activity,
        recent: (recentRuns as Array<{ id: string; learnerId: string; status: string; createdAt: string }>).map(
          (row) => ({
            id: row.id,
            learnerName: nameById.get(row.learnerId) ?? row.learnerId,
            status: row.status,
            createdAt: row.createdAt,
          }),
        ),
      };
    },
  );
}
