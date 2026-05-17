import { FastifyInstance } from "fastify";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import { transitionPlans } from "@aivo/db";
import { eq } from "drizzle-orm";
import { transitionByLearnerIdSchema, getTransitionByLearnerIdSchema } from "./schemas.js";

export async function registerTransitionRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.post("/api/family/transition/:learnerId", { schema: transitionByLearnerIdSchema }, async (req, reply) => {
    const claims = await authenticateRequest(req, reply);
    if (!claims) return;

    const { learnerId } = req.params as any;
    const isOwner = await verifyParentOwnership(db, claims.sub, learnerId);
    if (!isOwner && claims.role !== "admin") {
      return reply.status(403).send({ error: "Not authorized for this learner" });
    }

    const body = req.body as any;
    const existing = await db.select().from(transitionPlans).where(eq(transitionPlans.learnerId, learnerId)).limit(1);

    if (existing.length > 0) {
      await db.update(transitionPlans)
        .set({
          vocationalInterests: body.vocationalInterests || existing[0].vocationalInterests,
          vocationalAptitude: body.vocationalAptitude || existing[0].vocationalAptitude,
          independentLiving: body.independentLiving || existing[0].independentLiving,
          communityParticipation: body.communityParticipation || existing[0].communityParticipation,
          selfAdvocacy: body.selfAdvocacy || existing[0].selfAdvocacy,
          postSecondaryPlanning: body.postSecondaryPlanning || existing[0].postSecondaryPlanning,
          annualGoals: body.annualGoals || existing[0].annualGoals,
          startAge: body.startAge || existing[0].startAge,
          updatedAt: new Date(),
        })
        .where(eq(transitionPlans.learnerId, learnerId));
      return { status: "updated", learnerId };
    }

    const [plan] = await db.insert(transitionPlans).values({
      learnerId,
      tenantId: claims.tenantId || claims.sub,
      vocationalInterests: body.vocationalInterests || [],
      vocationalAptitude: body.vocationalAptitude || {},
      independentLiving: body.independentLiving || {},
      communityParticipation: body.communityParticipation || {},
      selfAdvocacy: body.selfAdvocacy || {},
      postSecondaryPlanning: body.postSecondaryPlanning || {},
      annualGoals: body.annualGoals || [],
      startAge: body.startAge || 14,
    }).returning();

    return { status: "created", plan };
  });

  app.get("/api/family/transition/:learnerId", { schema: getTransitionByLearnerIdSchema }, async (req, reply) => {
    const claims = await authenticateRequest(req, reply);
    if (!claims) return;

    const { learnerId } = req.params as any;
    const isOwner = await verifyParentOwnership(db, claims.sub, learnerId);
    if (!isOwner && claims.role !== "admin") {
      return reply.status(403).send({ error: "Not authorized for this learner" });
    }

    const [plan] = await db.select().from(transitionPlans).where(eq(transitionPlans.learnerId, learnerId)).limit(1);
    if (!plan) return reply.status(404).send({ error: "No transition plan found" });
    return plan;
  });
}
