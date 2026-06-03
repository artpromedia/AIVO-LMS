import { FastifyInstance } from "fastify";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  iepGoals,
  therapyGoals,
  therapySessions,
  brainInsights,
  teacherInsights,
  learners,
  learnerTeachers,
  learnerCaregivers,
  learnerTherapists,
} from "@aivo/db";
import { authenticateRequest } from "../auth.js";
import { emitFamilyAudit } from "../lib/audit.js";
import {
  getIepGoalsSchema,
  getTherapyGoalsSchema,
  createTherapyGoalSchema,
  createTherapySessionSchema,
  createTeacherInsightSchema,
} from "./schemas.js";

/**
 * Top-level "across all my learners" read endpoints used by the web
 * caregiver / therapist dashboards (and tracked in Phase 4 backend gaps).
 *
 * The per-learner counterparts already live in `iep.ts` at
 * `/api/family/iep/:learnerId/goals`; those require parent ownership and
 * therefore cannot be reused by an invited caregiver or therapist who has
 * an accepted collaboration link but no parental ownership of the learner.
 *
 * Both endpoints respond with the shape the web pages already destructure:
 *
 *   { goals: Array<{
 *       id, learnerId, title, progressPct, targetDate?, status,
 *       category?       // therapy-goals only — domain mapped to category
 *     }>
 *   }
 */
export async function registerFamilyGoalsRoutes(app: FastifyInstance) {
  const db = (
    app as unknown as {
      db: ReturnType<typeof import("@aivo/db").createDb>;
    }
  ).db;

  /**
   * Resolve every learnerId visible to the caller via:
   *   - parent ownership (`learners.parent_id`)
   *   - accepted teacher / caregiver / therapist collaboration link
   * PLATFORM_ADMIN sees the entire tenant catalogue.
   */
  async function getAccessibleLearnerIds(
    userSub: string,
    role: string,
    tenantId: string,
  ): Promise<string[]> {
    if (role === "PLATFORM_ADMIN") {
      const rows = await db
        .select({ id: learners.id })
        .from(learners)
        .where(eq(learners.tenantId, tenantId));
      return rows.map((r) => r.id);
    }
    const ids = new Set<string>();
    const ownedRows = await db
      .select({ id: learners.id })
      .from(learners)
      .where(eq(learners.parentId, userSub));
    for (const r of ownedRows) ids.add(r.id);

    const teacherRows = await db
      .select({ learnerId: learnerTeachers.learnerId })
      .from(learnerTeachers)
      .where(
        and(eq(learnerTeachers.teacherUserId, userSub), eq(learnerTeachers.status, "ACCEPTED")),
      );
    for (const r of teacherRows) ids.add(r.learnerId);

    const caregiverRows = await db
      .select({ learnerId: learnerCaregivers.learnerId })
      .from(learnerCaregivers)
      .where(
        and(
          eq(learnerCaregivers.caregiverUserId, userSub),
          eq(learnerCaregivers.status, "ACCEPTED"),
        ),
      );
    for (const r of caregiverRows) ids.add(r.learnerId);

    const therapistRows = await db
      .select({ learnerId: learnerTherapists.learnerId })
      .from(learnerTherapists)
      .where(
        and(
          eq(learnerTherapists.therapistUserId, userSub),
          eq(learnerTherapists.status, "ACCEPTED"),
        ),
      );
    for (const r of therapistRows) ids.add(r.learnerId);

    return Array.from(ids);
  }

  app.get("/api/family/iep-goals", { schema: getIepGoalsSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const learnerIds = await getAccessibleLearnerIds(claims.sub, claims.role, claims.tenantId);
    if (learnerIds.length === 0) return { goals: [] };

    const rows = await db
      .select()
      .from(iepGoals)
      .where(inArray(iepGoals.learnerId, learnerIds))
      .orderBy(desc(iepGoals.createdAt));

    const goals = rows.map((g) => ({
      id: g.id,
      learnerId: g.learnerId,
      title: g.goalText,
      // currentProgress is an integer 0–100 in iep_goals.
      progressPct: typeof g.currentProgress === "number" ? g.currentProgress : 0,
      // Per-goal IEP target dates aren't on the row today; fall back to the
      // updated timestamp so the UI has *something* sortable. The dashboards
      // tolerate `targetDate?` being absent.
      targetDate: undefined,
      status: g.status ?? "active",
    }));

    return { goals };
  });

  app.get(
    "/api/family/therapy-goals",
    { schema: getTherapyGoalsSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const learnerIds = await getAccessibleLearnerIds(claims.sub, claims.role, claims.tenantId);
      if (learnerIds.length === 0) return { goals: [] };

      const rows = await db
        .select()
        .from(therapyGoals)
        .where(inArray(therapyGoals.learnerId, learnerIds))
        .orderBy(desc(therapyGoals.createdAt));

      const goals = rows.map((g) => {
        // therapy_goals.current_progress is varchar — accept "75%", "75",
        // "in progress", etc. and project to a 0–100 integer.
        let progressPct = 0;
        if (typeof g.currentProgress === "string") {
          const match = g.currentProgress.match(/(\d+(?:\.\d+)?)/);
          if (match) {
            const parsed = Math.round(parseFloat(match[1]));
            progressPct = Math.max(0, Math.min(100, parsed));
          }
        }
        return {
          id: g.id,
          learnerId: g.learnerId,
          title: g.goalText,
          // Therapy domain (e.g. "speech", "occupational") maps to the
          // `category` field the dashboards render as a pill.
          category: g.domain ?? "general",
          progressPct,
          targetDate: undefined,
          status: g.status ?? "active",
        };
      });

      return { goals };
    },
  );

  app.post(
    "/api/family/therapy-goals",
    { schema: createTherapyGoalSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId, goalText, domain } = (request.body as any) || {};
      const text = typeof goalText === "string" ? goalText.trim() : "";
      if (!learnerId || !text) {
        return reply.code(400).send({ error: "learnerId and goalText are required" });
      }

      const learnerIds = await getAccessibleLearnerIds(claims.sub, claims.role, claims.tenantId);
      if (!learnerIds.includes(learnerId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const [row] = await db
        .insert(therapyGoals)
        .values({
          tenantId: claims.tenantId,
          learnerId,
          goalText: text,
          domain: typeof domain === "string" && domain ? domain : null,
          currentProgress: "0%",
          status: "active",
        })
        .returning();

      return reply.send({
        goal: {
          id: row.id,
          learnerId: row.learnerId,
          title: row.goalText,
          category: row.domain ?? "general",
          progressPct: 0,
          status: row.status ?? "active",
        },
      });
    },
  );

  /**
   * Record a therapy session note (SOAP-style). Persists into therapy_sessions
   * so the note survives — previously the mobile therapist screen faked a save.
   * Access mirrors therapy-goals: parent ownership or an accepted collaboration
   * link to the learner (PLATFORM_ADMIN sees the tenant).
   */
  app.post(
    "/api/family/therapy-sessions",
    { schema: createTherapySessionSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const body = (request.body as Record<string, unknown>) || {};
      const learnerId = typeof body.learnerId === "string" ? body.learnerId : "";
      const outcome = typeof body.outcome === "string" ? body.outcome.trim() : "";
      if (!learnerId || !outcome) {
        return reply.code(400).send({ error: "learnerId and outcome are required" });
      }

      const learnerIds = await getAccessibleLearnerIds(claims.sub, claims.role, claims.tenantId);
      if (!learnerIds.includes(learnerId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      // Resolve the caller's therapist link to this learner when they have one
      // (therapist_id is a nullable FK — parents/admins record with null).
      const [link] = await db
        .select({ id: learnerTherapists.id })
        .from(learnerTherapists)
        .where(
          and(
            eq(learnerTherapists.learnerId, learnerId),
            eq(learnerTherapists.therapistUserId, claims.sub),
            eq(learnerTherapists.status, "ACCEPTED"),
          ),
        )
        .limit(1);

      const sessionDate =
        typeof body.sessionDate === "string" && body.sessionDate
          ? new Date(body.sessionDate)
          : new Date();
      const goalsAddressed = Array.isArray(body.goalIds) ? body.goalIds : [];
      const duration =
        typeof body.durationMinutes === "number" ? `${body.durationMinutes} min` : null;

      const [row] = await db
        .insert(therapySessions)
        .values({
          tenantId: claims.tenantId,
          learnerId,
          therapistId: link?.id ?? null,
          sessionDate,
          notes: outcome,
          goalsAddressed,
          // Structured SOAP-ish detail the note form captures.
          progressUpdates: {
            skillTargeted: typeof body.skillTargeted === "string" ? body.skillTargeted : "",
            method: typeof body.method === "string" ? body.method : "",
            recommendations: typeof body.recommendations === "string" ? body.recommendations : "",
          },
          duration,
        })
        .returning();

      await emitFamilyAudit({
        db,
        request,
        eventType: "THERAPY_SESSION_RECORDED",
        tenantId: claims.tenantId,
        learnerId,
        resourceId: row.id,
        details: { therapistLinked: Boolean(link?.id) },
      });

      return reply.code(201).send({ session: row });
    },
  );

  /**
   * Record a teacher's qualitative insight about a learner. The handler
   * writes to the dedicated `teacher_insights` table (the canonical record)
   * AND mirrors the row into `brain_insights` (source = "teacher") so the
   * existing learner-brain-profile readers (recommendations, etc.) keep
   * working without a migration sweep. Previously the mobile teacher
   * screen faked a save.
   */
  app.post(
    "/api/family/teacher-insights",
    { schema: createTeacherInsightSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const body = (request.body as Record<string, unknown>) || {};
      const learnerId = typeof body.learnerId === "string" ? body.learnerId : "";
      const insightText = typeof body.insightText === "string" ? body.insightText.trim() : "";
      if (!learnerId || !insightText) {
        return reply.code(400).send({ error: "learnerId and insightText are required" });
      }

      const learnerIds = await getAccessibleLearnerIds(claims.sub, claims.role, claims.tenantId);
      if (!learnerIds.includes(learnerId)) {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const domain =
        typeof body.domain === "string" && body.domain ? body.domain : null;

      // Canonical write: dedicated teacher_insights row, tenant-scoped.
      const [row] = await db
        .insert(teacherInsights)
        .values({
          tenantId: claims.tenantId,
          learnerId,
          teacherUserId: claims.sub,
          insightText,
          domain,
        })
        .returning();

      // Mirror into brain_insights so existing readers (recommendations,
      // learner brain profile) see it without a separate migration.
      await db
        .insert(brainInsights)
        .values({
          learnerId,
          source: "teacher",
          sourceUserId: claims.sub,
          insightText,
          domain,
        });

      await emitFamilyAudit({
        db,
        request,
        eventType: "TEACHER_INSIGHT_SUBMITTED",
        tenantId: claims.tenantId,
        learnerId,
        resourceId: row.id,
        details: { domain: row.domain ?? null, mirrored: "brain_insights" },
      });

      return reply.code(201).send({ insight: row });
    },
  );
}
