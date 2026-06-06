import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { caregiverObservations, learnerCaregivers } from "@aivo/db";
import type { CaregiverObservationCreatedPayload, ContributorRole } from "@aivo/events";
import { EVENTS } from "@aivo/events";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import { getObservationsSchema, observationsSchema } from "./schemas.js";
import { emitFamilyAudit } from "../lib/audit.js";

function contributorRoleFromClaims(role: string | undefined): ContributorRole {
  switch ((role ?? "").toUpperCase()) {
    case "TEACHER":
      return "teacher";
    case "THERAPIST":
      return "therapist";
    case "PARENT":
    case "GUARDIAN":
      return "parent";
    default:
      return "caregiver";
  }
}

async function verifyLearnerAccess(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  userId: string,
  learnerId: string,
  role?: string,
): Promise<boolean> {
  if (role === "PLATFORM_ADMIN") return true;

  const isParent = await verifyParentOwnership(db, userId, learnerId);
  if (isParent) return true;

  const caregiver = await db
    .select()
    .from(learnerCaregivers)
    .where(
      and(
        eq(learnerCaregivers.learnerId, learnerId),
        eq(learnerCaregivers.caregiverUserId, userId),
        eq(learnerCaregivers.status, "ACCEPTED"),
      ),
    );
  return caregiver.length > 0;
}

export async function registerObservationRoutes(app: FastifyInstance) {
  const db = (app as unknown as { db: ReturnType<typeof import("@aivo/db").createDb> }).db;

  app.get("/api/family/observations", { schema: getObservationsSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.query as { learnerId?: string };
    if (!learnerId) {
      return reply.status(400).send({ error: "learnerId required" });
    }

    const hasAccess = await verifyLearnerAccess(db, claims.sub, learnerId, claims.role);
    if (!hasAccess) {
      return reply.status(403).send({ error: "Access denied" });
    }

    const obs = await db
      .select()
      .from(caregiverObservations)
      .where(eq(caregiverObservations.learnerId, learnerId))
      .orderBy(desc(caregiverObservations.date))
      .limit(50);

    return { observations: obs };
  });

  app.post("/api/family/observations", { schema: observationsSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const body = request.body as {
      learnerId: string;
      category?: string;
      notes: string;
      mood?: string;
      date?: string;
    };

    if (!body.learnerId || !body.notes) {
      return reply.status(400).send({ error: "learnerId and notes required" });
    }

    const hasAccess = await verifyLearnerAccess(db, claims.sub, body.learnerId, claims.role);
    if (!hasAccess) {
      return reply.status(403).send({ error: "Access denied" });
    }

    const tenantId = claims.tenantId || claims.sub;

    const [obs] = await db
      .insert(caregiverObservations)
      .values({
        tenantId,
        learnerId: body.learnerId,
        submittedBy: claims.sub,
        category: body.category || "General",
        notes: body.notes,
        mood: body.mood || null,
        date: body.date ? new Date(body.date) : new Date(),
      })
      .returning();

    await emitFamilyAudit({
      db,
      request,
      eventType: "PARENT_OBSERVATION_SUBMITTED",
      tenantId,
      learnerId: body.learnerId,
      resourceId: obs.id,
      details: {
        category: obs.category,
        submittedBy: claims.sub,
        mood: body.mood ?? null,
      },
    });

    // Domain event consumed by recommendation-svc to derive learner signals
    // (observation-signal-transformer) → parent-approval recommendations.
    const event: CaregiverObservationCreatedPayload = {
      observationId: obs.id,
      learnerId: body.learnerId,
      contributorUserId: claims.sub,
      contributorRole: contributorRoleFromClaims(claims.role),
      category: obs.category,
      notes: body.notes,
      mood: body.mood ?? null,
      observedAt: (obs.date instanceof Date ? obs.date : new Date()).toISOString(),
    };
    request.log.info(
      { event: EVENTS.CAREGIVER_OBSERVATION_CREATED, payload: event },
      "caregiver observation created",
    );

    return obs;
  });
}
