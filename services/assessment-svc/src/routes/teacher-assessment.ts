import { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import {
  teacherAssessments,
  learners,
  learnerTeachers,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";

/**
 * Teacher-led intake feeding the adaptive baseline generator.
 *
 * The product requirement is that teacher input is OPTIONAL: the
 * baseline must still generate from parent assessment + (optional) IEP
 * + (optional) co-parent + (optional) teacher. So this route accepts
 * partial submissions — every field except `learnerId` is optional —
 * and the LLM prompt builder degrades gracefully when no row exists
 * for a learner.
 *
 * Authorisation: only TEACHER (with an ACCEPTED learner_teachers link),
 * SPED_LEAD, DISTRICT_ADMIN within the learner's tenant, or
 * PLATFORM_ADMIN may submit. Parents intentionally cannot submit a
 * teacher assessment on the teacher's behalf.
 */

interface AuthClaims {
  sub: string;
  tenantId: string;
  role: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

async function authenticate(req: any, reply: any): Promise<AuthClaims | null> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.code(401).send({ error: "Authentication required" });
    return null;
  }
  try {
    return (await verifyJWT(auth.slice(7))) as AuthClaims;
  } catch {
    reply.code(401).send({ error: "Invalid token" });
    return null;
  }
}

async function isTeacherOf(db: any, userSub: string, learnerId: string): Promise<boolean> {
  if (!isUuid(userSub) || !isUuid(learnerId)) return false;
  const rows = await db.select().from(learnerTeachers).where(
    and(
      eq(learnerTeachers.learnerId, learnerId),
      eq(learnerTeachers.teacherUserId, userSub),
      eq(learnerTeachers.status, "ACCEPTED"),
    ),
  );
  return rows.length > 0;
}

async function canSubmitTeacherAssessment(
  db: any,
  claims: AuthClaims,
  learnerId: string,
): Promise<{ allowed: boolean; tenantId: string | null }> {
  const [learner] = await db
    .select({ tenantId: learners.tenantId })
    .from(learners)
    .where(eq(learners.id, learnerId))
    .limit(1);
  if (!learner) return { allowed: false, tenantId: null };

  if (claims.role === "PLATFORM_ADMIN") return { allowed: true, tenantId: learner.tenantId };
  if (claims.role === "DISTRICT_ADMIN" && claims.tenantId === learner.tenantId) {
    return { allowed: true, tenantId: learner.tenantId };
  }
  if (claims.role === "SPED_LEAD" && claims.tenantId === learner.tenantId) {
    return { allowed: true, tenantId: learner.tenantId };
  }
  if (claims.role === "TEACHER" && (await isTeacherOf(db, claims.sub, learnerId))) {
    return { allowed: true, tenantId: learner.tenantId };
  }
  return { allowed: false, tenantId: learner.tenantId };
}

async function canReadTeacherAssessment(
  db: any,
  claims: AuthClaims,
  learnerId: string,
): Promise<boolean> {
  // Reads share the submit policy: the same authoring/admin roles can
  // see the row. The baseline pipeline reads via a service-internal
  // path, not via this route, so we don't need to widen here for it.
  const { allowed } = await canSubmitTeacherAssessment(db, claims, learnerId);
  return allowed;
}

export async function registerTeacherAssessmentRoutes(app: FastifyInstance) {
  app.get("/api/assessments/teacher/:learnerId/status", {
    schema: {
      tags: ["Teacher Assessment"],
      security: [{ bearerAuth: [] }],
      params: {
        type: "object",
        required: ["learnerId"],
        properties: { learnerId: { type: "string" } },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const { learnerId } = req.params as { learnerId: string };
    if (!isUuid(learnerId)) {
      return reply.status(400).send({ error: "Invalid learnerId" });
    }

    const allowed = await canReadTeacherAssessment(db, claims, learnerId);
    if (!allowed) return reply.status(403).send({ error: "Forbidden" });

    const [row] = await db
      .select({
        id: teacherAssessments.id,
        completedAt: teacherAssessments.completedAt,
        createdAt: teacherAssessments.createdAt,
        teacherRole: teacherAssessments.teacherRole,
      })
      .from(teacherAssessments)
      .where(eq(teacherAssessments.learnerId, learnerId))
      .orderBy(desc(teacherAssessments.createdAt))
      .limit(1);

    return reply.send({
      // Teacher input is OPTIONAL. The baseline generator does not
      // gate on this — we expose `completed` for UI affordances only.
      completed: !!row?.completedAt,
      assessmentId: row?.id || null,
      completedAt: row?.completedAt || null,
      teacherRole: row?.teacherRole || null,
    });
  });

  app.post("/api/assessments/teacher", {
    schema: {
      tags: ["Teacher Assessment"],
      security: [{ bearerAuth: [] }],
      body: {
        type: "object",
        // Only learnerId is required. Teachers may submit with whatever
        // partial information they have — strengths only, observations
        // only, etc. — and the prompt builder will surface whatever is
        // present without demanding a full intake.
        required: ["learnerId"],
        properties: {
          learnerId: { type: "string" },
          teacherRole: { type: "string", maxLength: 100 },
          gradeLevel: { type: "string", maxLength: 20 },
          subjectArea: { type: "string", maxLength: 100 },
          strengths: { type: "array", items: { type: "string" } },
          challenges: { type: "array", items: { type: "string" } },
          accommodations: { type: "array", items: { type: "string" } },
          observations: { type: "string" },
          recommendedFocusAreas: { type: "array", items: { type: "string" } },
          additionalResponses: { type: "object" },
        },
      },
    },
  }, async (req, reply) => {
    const claims = await authenticate(req, reply);
    if (!claims) return;
    const db = (app as any).db;
    const body = req.body as any;

    if (!isUuid(body.learnerId)) {
      return reply.status(400).send({ error: "Invalid learnerId" });
    }

    const { allowed, tenantId } = await canSubmitTeacherAssessment(
      db,
      claims,
      body.learnerId,
    );
    if (!allowed || !tenantId) {
      return reply.status(403).send({
        error: "Only an assigned teacher, SPED lead, or admin may submit a teacher assessment for this learner",
      });
    }

    const [assessment] = await db
      .insert(teacherAssessments)
      .values({
        tenantId,
        learnerId: body.learnerId,
        submittedBy: claims.sub,
        teacherRole: body.teacherRole || null,
        gradeLevel: body.gradeLevel || null,
        subjectArea: body.subjectArea || null,
        strengths: Array.isArray(body.strengths) ? body.strengths : [],
        challenges: Array.isArray(body.challenges) ? body.challenges : [],
        accommodations: Array.isArray(body.accommodations) ? body.accommodations : [],
        observations: body.observations || null,
        recommendedFocusAreas: Array.isArray(body.recommendedFocusAreas)
          ? body.recommendedFocusAreas
          : [],
        responses: body.additionalResponses || {},
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return reply.send({ assessment });
  });
}
