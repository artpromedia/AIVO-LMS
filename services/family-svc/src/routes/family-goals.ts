import { FastifyInstance } from "fastify";
import { eq, and, desc, inArray } from "drizzle-orm";
import {
  iepGoals,
  therapyGoals,
  learners,
  learnerTeachers,
  learnerCaregivers,
  learnerTherapists,
} from "@aivo/db";
import { authenticateRequest } from "../auth.js";
import { getIepGoalsSchema, getTherapyGoalsSchema } from "./schemas.js";

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
}
