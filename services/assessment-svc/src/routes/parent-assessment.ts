import { FastifyInstance } from "fastify";
import { parentAssessments, learners, learnerFunctioningLevels, learnerCaregivers } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import { determineFunctioningLevel } from "../services/level-router.js";
import { emitAssessmentAudit } from "../lib/audit.js";

// True when `userId` is either the learner's primary parent or an
// ACCEPTED caregiver/co-parent on that learner. Co-parents need to take
// the parent assessment too — their answers may differ and should be
// captured so the AI tutor sees both perspectives.
async function isParentOrAcceptedCaregiver(
  db: any,
  userId: string,
  learnerId: string,
): Promise<boolean> {
  const [learner] = await db
    .select({ parentId: learners.parentId })
    .from(learners)
    .where(eq(learners.id, learnerId))
    .limit(1);
  if (!learner) return false;
  if (learner.parentId === userId) return true;
  const [cg] = await db
    .select({ id: learnerCaregivers.id })
    .from(learnerCaregivers)
    .where(
      and(
        eq(learnerCaregivers.learnerId, learnerId),
        eq(learnerCaregivers.caregiverUserId, userId),
        eq(learnerCaregivers.status, "ACCEPTED"),
      ),
    )
    .limit(1);
  return !!cg;
}

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ error: "Unauthorized" });
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function registerParentAssessmentRoutes(app: FastifyInstance) {
  app.get(
    "/api/assessments/parent/:learnerId/status",
    {
      schema: {
        tags: ["Parent Assessment"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: { learnerId: { type: "string" } },
          required: ["learnerId"],
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const { learnerId } = req.params as { learnerId: string };
      const user = (req as any).user;
      const userId = user?.sub || user?.userId || user?.id;

      const [learner] = await db
        .select({ id: learners.id, parentId: learners.parentId })
        .from(learners)
        .where(eq(learners.id, learnerId))
        .limit(1);

      // No learner row — return shaped empty status with 200 (see
      // learner-baseline.ts for rationale). The parent dashboard iterates
      // status fetches across cached learner ids and a stale id should
      // not surface as a console error.
      if (!learner) {
        return {
          completed: false,
          completedAt: null,
          assessmentId: null,
        };
      }
      const allowed = await isParentOrAcceptedCaregiver(db, userId, learnerId);
      if (!allowed) return reply.status(403).send({ error: "Forbidden" });

      const [row] = await db
        .select({
          id: parentAssessments.id,
          completedAt: parentAssessments.completedAt,
          createdAt: parentAssessments.createdAt,
        })
        .from(parentAssessments)
        .where(
          and(eq(parentAssessments.learnerId, learnerId), isNotNull(parentAssessments.completedAt)),
        )
        .orderBy(desc(parentAssessments.completedAt))
        .limit(1);

      return {
        completed: !!row,
        completedAt: row?.completedAt || null,
        assessmentId: row?.id || null,
      };
    },
  );

  app.post(
    "/api/assessments/parent",
    {
      schema: {
        tags: ["Parent Assessment"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["learnerId", "communicationMode", "deviceInteraction", "responseMethod"],
          properties: {
            learnerId: { type: "string" },
            communicationMode: {
              type: "string",
              enum: [
                "verbal",
                "limited_verbal",
                "non_verbal",
                "pre_symbolic",
                "aac_device",
                "sign_language",
              ],
            },
            deviceInteraction: {
              type: "string",
              enum: ["independent", "guided", "switch_access", "eye_gaze", "partner_assisted"],
            },
            responseMethod: {
              type: "string",
              enum: ["typing", "voice", "touch_select", "switch_scan", "partner_response"],
            },
            attentionSpan: {
              type: "string",
              enum: ["typical", "short", "very_short", "variable", "task_dependent"],
            },
            diagnoses: { type: "array", items: { type: "string" } },
            additionalResponses: { type: "object" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const body = req.body as any;

      const submitterId = user?.sub || user?.userId || user?.id;
      const allowed = await isParentOrAcceptedCaregiver(db, submitterId, body.learnerId);
      if (!allowed)
        throw {
          statusCode: 403,
          message:
            "Only the parent or an accepted caregiver can submit assessments for this learner",
        };

      // Tenant must follow the learner, not the submitter — caregivers may
      // belong to a different tenant than the learner's primary parent.
      const [learnerRow] = await db
        .select({ tenantId: learners.tenantId })
        .from(learners)
        .where(eq(learners.id, body.learnerId))
        .limit(1);
      const learnerTenantId = learnerRow?.tenantId || user.tenantId;

      const [assessment] = await db
        .insert(parentAssessments)
        .values({
          tenantId: learnerTenantId,
          learnerId: body.learnerId,
          submittedBy: submitterId,
          communicationMode: body.communicationMode,
          deviceInteraction: body.deviceInteraction,
          responseMethod: body.responseMethod,
          attentionSpan: body.attentionSpan,
          diagnoses: body.diagnoses || [],
          responses: body.additionalResponses || {},
          completedAt: new Date(),
        })
        .returning();

      const level = determineFunctioningLevel({
        communicationMode: body.communicationMode,
        deviceInteraction: body.deviceInteraction,
        responseMethod: body.responseMethod,
        attentionSpan: body.attentionSpan,
      });

      await db
        .update(learners)
        .set({ functioningLevel: level.level, communicationMode: body.communicationMode })
        .where(eq(learners.id, body.learnerId));

      await db.insert(learnerFunctioningLevels).values({
        learnerId: body.learnerId,
        level: level.level,
        determinedBy: "parent_assessment",
        parentSignals: {
          communicationMode: body.communicationMode,
          deviceInteraction: body.deviceInteraction,
          responseMethod: body.responseMethod,
        },
        confidence: level.confidence,
      });

      await emitAssessmentAudit({
        db,
        request: req,
        eventType: "PARENT_ASSESSMENT_SUBMITTED",
        tenantId: learnerTenantId,
        learnerId: body.learnerId,
        resourceId: assessment.id,
        details: {
          submittedBy: submitterId,
          functioningLevel: level.level,
          confidence: level.confidence,
          diagnosisCount: (body.diagnoses ?? []).length,
        },
      });

      return {
        assessment,
        functioningLevel: level,
      };
    },
  );
}
