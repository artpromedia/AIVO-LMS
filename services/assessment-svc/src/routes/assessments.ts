import { FastifyInstance } from "fastify";
import { assessmentAttempts, assessmentResponses } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { eq } from "drizzle-orm";

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ error: "Unauthorized" });
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export async function registerAssessmentRoutes(app: FastifyInstance) {
  app.post(
    "/api/assessments",
    {
      schema: {
        tags: ["Assessments"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["learnerId", "type", "mode"],
          properties: {
            learnerId: { type: "string" },
            type: { type: "string" },
            mode: {
              type: "string",
              enum: [
                "STANDARD",
                "MODIFIED",
                "PICTURE_BASED",
                "SWITCH_SCAN",
                "PARTNER_ASSISTED",
                "OBSERVATIONAL",
              ],
            },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const body = req.body as any;

      const [attempt] = await db
        .insert(assessmentAttempts)
        .values({
          tenantId: user.tenantId,
          learnerId: body.learnerId,
          type: body.type,
          mode: body.mode,
          status: "IN_PROGRESS",
          startedAt: new Date(),
        })
        .returning();

      return attempt;
    },
  );

  app.post(
    "/api/assessments/:id/responses",
    {
      schema: {
        tags: ["Assessments"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["questionId", "response"],
          properties: {
            questionId: { type: "string" },
            domain: { type: "string" },
            response: { type: "object" },
            correct: { type: "integer" },
            responseTimeMs: { type: "integer" },
            confidence: { type: "number" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const { id } = req.params as any;
      const body = req.body as any;

      const [resp] = await db
        .insert(assessmentResponses)
        .values({
          attemptId: id,
          questionId: body.questionId,
          domain: body.domain,
          response: body.response,
          correct: body.correct,
          responseTimeMs: body.responseTimeMs,
          confidence: body.confidence,
        })
        .returning();

      return resp;
    },
  );

  app.post(
    "/api/assessments/:id/complete",
    {
      schema: { tags: ["Assessments"], security: [{ bearerAuth: [] }] },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const { id } = req.params as any;

      const responses = await db
        .select()
        .from(assessmentResponses)
        .where(eq(assessmentResponses.attemptId, id));

      const domainScores: Record<string, { correct: number; total: number }> = {};
      for (const r of responses) {
        const domain = r.domain || "general";
        if (!domainScores[domain]) domainScores[domain] = { correct: 0, total: 0 };
        domainScores[domain].total++;
        if (r.correct === 1) domainScores[domain].correct++;
      }

      const [attempt] = await db
        .update(assessmentAttempts)
        .set({
          status: "COMPLETED",
          completedAt: new Date(),
          domainScores,
        })
        .where(eq(assessmentAttempts.id, id))
        .returning();

      return { attempt, domainScores };
    },
  );

  app.get(
    "/api/assessments/learner/:learnerId",
    {
      schema: { tags: ["Assessments"], security: [{ bearerAuth: [] }] },
      preHandler: authenticate,
    },
    async (req) => {
      const db = (app as any).db;
      const { learnerId } = req.params as any;
      return db
        .select()
        .from(assessmentAttempts)
        .where(eq(assessmentAttempts.learnerId, learnerId));
    },
  );
}
