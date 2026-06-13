import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { caregiverObservations, learnerCaregivers } from "@aivo/db";
import type { CaregiverObservationCreatedPayload, ContributorRole } from "@aivo/events";
import { EVENTS } from "@aivo/events";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import { getObservationsSchema, observationsSchema, updateObservationSchema } from "./schemas.js";
import { emitFamilyAudit } from "../lib/audit.js";
import { getRealtimeBus } from "../realtime/bus.js";

/** Author-only edit window for caregiver observations (Sprint C-10). */
const EDIT_WINDOW_MS = 15 * 60 * 1000;

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
  tenantId: string,
  userId: string,
  learnerId: string,
  role?: string,
): Promise<boolean> {
  if (role === "PLATFORM_ADMIN") return true;

  const isParent = await verifyParentOwnership(db, tenantId, userId, learnerId);
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

    const hasAccess = await verifyLearnerAccess(db, claims.tenantId, claims.sub, learnerId, claims.role);
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

    const hasAccess = await verifyLearnerAccess(db, claims.tenantId, claims.sub, body.learnerId, claims.role);
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
    try {
      const bus = await getRealtimeBus();
      await bus.publish(EVENTS.CAREGIVER_OBSERVATION_CREATED, event);
    } catch (err) {
      // Best-effort: a bus outage must not fail the observation write.
      request.log.warn({ err }, "failed to publish caregiver.observation.created");
    }

    return obs;
  });

  // Author-only edit within a 15-minute window (Sprint C-10). The author may
  // correct an observation they just logged; after 15 minutes it is immutable.
  // Enforcement is server-side (Trust rule):
  //   - the editor MUST be the original author (`submittedBy`), else 403;
  //   - the edit MUST land within 15 min of creation, else 409;
  //   - the PRIOR field values are written to the audit detail before the
  //     overwrite, so a correction never erases history without a trace.
  app.patch(
    "/api/family/observations/:id",
    { schema: updateObservationSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { id } = request.params as { id: string };
      const body = request.body as {
        notes?: string;
        category?: string;
        mood?: string | null;
      };

      const [existing] = await db
        .select()
        .from(caregiverObservations)
        .where(eq(caregiverObservations.id, id))
        .limit(1);

      if (!existing) {
        return reply.status(404).send({ error: "Observation not found" });
      }

      // Ownership: only the author may edit. Platform admins are intentionally
      // NOT granted an edit bypass here — an observation is a first-person
      // record; an admin override would falsify authorship.
      if (existing.submittedBy !== claims.sub) {
        return reply.status(403).send({ error: "Only the author may edit this observation" });
      }

      // 15-minute window from creation.
      const createdMs = new Date(existing.createdAt as unknown as string).getTime();
      if (Date.now() - createdMs > EDIT_WINDOW_MS) {
        return reply.status(409).send({
          error: "The 15-minute window to edit this observation has passed.",
          code: "edit_window_expired",
        });
      }

      const nextNotes = typeof body.notes === "string" ? body.notes : existing.notes;
      if (!nextNotes || !nextNotes.trim()) {
        return reply.status(400).send({ error: "notes cannot be empty" });
      }
      const nextCategory =
        typeof body.category === "string" && body.category.trim()
          ? body.category
          : existing.category;
      const nextMood = body.mood === undefined ? existing.mood : body.mood || null;

      const [updated] = await db
        .update(caregiverObservations)
        .set({ notes: nextNotes, category: nextCategory, mood: nextMood })
        .where(eq(caregiverObservations.id, id))
        .returning();

      // Append-only history: the prior values live in the audit detail so the
      // edit is fully traceable (the table itself is overwrite-in-place).
      await emitFamilyAudit({
        db,
        request,
        eventType: "CAREGIVER_OBSERVATION_EDITED",
        tenantId: existing.tenantId,
        learnerId: existing.learnerId,
        resourceId: id,
        details: {
          previous: {
            notes: existing.notes,
            category: existing.category,
            mood: existing.mood,
          },
          editedBy: claims.sub,
        },
      });

      return updated;
    },
  );
}
