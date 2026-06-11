import { FastifyInstance } from "fastify";
import { and, desc, eq } from "drizzle-orm";
import { therapistAssessments, learners, learnerTherapists } from "@aivo/db";
import { verifyJWT } from "@aivo/security";

/**
 * Therapist-led intake feeding the adaptive baseline generator
 * (adaptive-learning E2E Sprint 6). Mirrors the teacher pathway: therapist
 * input is OPTIONAL — the baseline still generates without it — so every
 * field except `learnerId` accepts partial submission and the LLM prompt
 * builder degrades gracefully when no row exists.
 *
 * Authorisation: only THERAPIST (with an ACCEPTED learner_therapists link),
 * SPED_LEAD within the learner's tenant, or PLATFORM_ADMIN may submit.
 * Parents intentionally cannot submit a therapist assessment on the
 * therapist's behalf.
 */

interface AuthClaims {
  sub: string;
  tenantId: string;
  role: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

const DISCIPLINES = new Set(["speech", "occupational", "behavioral", "physical", "other"]);

async function authenticate(req: any, reply: any): Promise<AuthClaims | null> {
  // Internal service-to-service bypass (same contract as learner-baseline):
  // the web-v2 BFF submits on behalf of a session-verified therapist after
  // enforcing caseload scope. The SERVICE principal carries no user sub, so
  // submittedBy stays null and the BFF passes the web identity in
  // additionalResponses for the audit trail.
  const internalToken = process.env.INTERNAL_SERVICE_TOKEN;
  const presented = req.headers["x-service-token"];
  if (internalToken && typeof presented === "string" && presented === internalToken) {
    return {
      sub: `service:${req.headers["x-internal-service"] || "unknown"}`,
      role: "SERVICE",
      tenantId: "*",
    };
  }

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

async function isTherapistOf(db: any, userSub: string, learnerId: string): Promise<boolean> {
  if (!isUuid(userSub) || !isUuid(learnerId)) return false;
  const rows = await db
    .select()
    .from(learnerTherapists)
    .where(
      and(
        eq(learnerTherapists.learnerId, learnerId),
        eq(learnerTherapists.therapistUserId, userSub),
        eq(learnerTherapists.status, "ACCEPTED"),
      ),
    );
  return rows.length > 0;
}

async function canSubmitTherapistAssessment(
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
  // Trusted internal caller — the BFF already verified the web session's
  // therapist role and caseload scope before proxying.
  if (claims.role === "SERVICE") return { allowed: true, tenantId: learner.tenantId };
  if (claims.role === "SPED_LEAD" && claims.tenantId === learner.tenantId) {
    return { allowed: true, tenantId: learner.tenantId };
  }
  if (claims.role === "THERAPIST" && (await isTherapistOf(db, claims.sub, learnerId))) {
    return { allowed: true, tenantId: learner.tenantId };
  }
  return { allowed: false, tenantId: learner.tenantId };
}

export async function registerTherapistAssessmentRoutes(app: FastifyInstance) {
  app.get(
    "/api/assessments/therapist/:learnerId/status",
    {
      schema: {
        tags: ["Therapist Assessment"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const { learnerId } = req.params as { learnerId: string };
      if (!isUuid(learnerId)) {
        return reply.status(400).send({ error: "Invalid learnerId" });
      }

      // Reads share the submit policy (authoring/admin roles). The baseline
      // pipeline reads service-internally, not via this route.
      const { allowed } = await canSubmitTherapistAssessment(db, claims, learnerId);
      if (!allowed) return reply.status(403).send({ error: "Forbidden" });

      const [row] = await db
        .select({
          id: therapistAssessments.id,
          completedAt: therapistAssessments.completedAt,
          createdAt: therapistAssessments.createdAt,
          therapyDiscipline: therapistAssessments.therapyDiscipline,
        })
        .from(therapistAssessments)
        .where(eq(therapistAssessments.learnerId, learnerId))
        .orderBy(desc(therapistAssessments.createdAt))
        .limit(1);

      return reply.send({
        // Therapist input is OPTIONAL — `completed` is for UI affordances
        // only, never a baseline gate.
        completed: !!row?.completedAt,
        assessmentId: row?.id || null,
        completedAt: row?.completedAt || null,
        therapyDiscipline: row?.therapyDiscipline || null,
      });
    },
  );

  app.post(
    "/api/assessments/therapist",
    {
      schema: {
        tags: ["Therapist Assessment"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          // Only learnerId is required — partial submissions welcome.
          required: ["learnerId"],
          properties: {
            learnerId: { type: "string" },
            therapyDiscipline: {
              type: "string",
              enum: ["speech", "occupational", "behavioral", "physical", "other"],
            },
            areasOfFocus: { type: "array", items: { type: "string" } },
            strengths: { type: "array", items: { type: "string" } },
            challenges: { type: "array", items: { type: "string" } },
            sensoryNotes: { type: "string" },
            communicationNotes: { type: "string" },
            regulationStrategies: { type: "array", items: { type: "string" } },
            recommendedAccommodations: { type: "array", items: { type: "string" } },
            observations: { type: "string" },
            additionalResponses: { type: "object" },
          },
        },
      },
    },
    async (req, reply) => {
      const claims = await authenticate(req, reply);
      if (!claims) return;
      const db = (app as any).db;
      const body = req.body as any;

      if (!isUuid(body.learnerId)) {
        return reply.status(400).send({ error: "Invalid learnerId" });
      }
      if (body.therapyDiscipline && !DISCIPLINES.has(body.therapyDiscipline)) {
        return reply.status(400).send({ error: "Invalid therapyDiscipline" });
      }

      const { allowed, tenantId } = await canSubmitTherapistAssessment(
        db,
        claims,
        body.learnerId,
      );
      if (!allowed || !tenantId) {
        return reply.status(403).send({
          error:
            "Only a connected therapist, SPED lead, or admin may submit a therapist assessment for this learner",
        });
      }

      const [assessment] = await db
        .insert(therapistAssessments)
        .values({
          tenantId,
          learnerId: body.learnerId,
          submittedBy: isUuid(claims.sub) ? claims.sub : null,
          therapyDiscipline: body.therapyDiscipline || null,
          areasOfFocus: Array.isArray(body.areasOfFocus) ? body.areasOfFocus : [],
          strengths: Array.isArray(body.strengths) ? body.strengths : [],
          challenges: Array.isArray(body.challenges) ? body.challenges : [],
          sensoryNotes: body.sensoryNotes || null,
          communicationNotes: body.communicationNotes || null,
          regulationStrategies: Array.isArray(body.regulationStrategies)
            ? body.regulationStrategies
            : [],
          recommendedAccommodations: Array.isArray(body.recommendedAccommodations)
            ? body.recommendedAccommodations
            : [],
          observations: body.observations || null,
          responses: body.additionalResponses || {},
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return reply.send({ assessment });
    },
  );
}
