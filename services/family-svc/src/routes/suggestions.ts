import { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { brainRecommendations, learnerCaregivers } from "@aivo/db";
import type { ContributorRole, RecommendationSuggestedPayload } from "@aivo/events";
import { EVENTS } from "@aivo/events";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import { emitFamilyAudit } from "../lib/audit.js";
import { getRealtimeBus } from "../realtime/bus.js";

/**
 * Teacher / caregiver "suggested adjustment" route (Sprint 5, G1/G2).
 *
 * A teacher-on-roster or accepted caregiver/therapist can PROPOSE an
 * adjustment for a learner. It is recorded as a PENDING recommendation
 * routed to the parent for approval — it NEVER mutates brain state
 * directly. This preserves COPPA / parent authority while letting the
 * care team's input improve service to the learner.
 */

// Allowed suggestion types → the brain_recommendations enum value used.
export const SUGGESTION_TYPE_MAP: Record<string, string> = {
  tutor_strategy: "tutor_suggestion",
  accommodation: "accommodation_add",
  goal: "goal_suggestion",
  pacing: "path_adjustment",
  sensory: "accommodation_add",
  self_regulation: "accommodation_add",
};

export function mapSuggestionType(suggestionType: string | undefined): string {
  return SUGGESTION_TYPE_MAP[suggestionType ?? "tutor_strategy"] ?? "tutor_suggestion";
}

export function contributorRoleFromClaims(role: string | undefined): ContributorRole {
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

async function verifyContributorAccess(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  tenantId: string,
  userId: string,
  learnerId: string,
  role?: string,
): Promise<boolean> {
  if (role === "PLATFORM_ADMIN") return true;
  if (await verifyParentOwnership(db, tenantId, userId, learnerId)) return true;
  const accepted = await db
    .select()
    .from(learnerCaregivers)
    .where(
      and(
        eq(learnerCaregivers.learnerId, learnerId),
        eq(learnerCaregivers.caregiverUserId, userId),
        eq(learnerCaregivers.status, "ACCEPTED"),
      ),
    );
  return accepted.length > 0;
}

export async function registerSuggestionRoutes(app: FastifyInstance) {
  const db = (app as unknown as { db: ReturnType<typeof import("@aivo/db").createDb> }).db;

  app.post("/api/family/suggestions", async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const body = request.body as {
      learnerId?: string;
      suggestionType?: string;
      title?: string;
      rationale?: string;
      proposedValue?: unknown;
    };

    if (!body.learnerId || !body.title || !body.rationale) {
      return reply.status(400).send({ error: "learnerId, title and rationale are required" });
    }

    const hasAccess = await verifyContributorAccess(db, claims.tenantId, claims.sub, body.learnerId, claims.role);
    if (!hasAccess) {
      // Non-roster teacher / non-accepted caregiver cannot suggest.
      return reply.status(403).send({ error: "Access denied" });
    }

    const recType = mapSuggestionType(body.suggestionType);
    const contributorRole = contributorRoleFromClaims(claims.role);
    const tenantId = claims.tenantId || claims.sub;

    // Create a PENDING recommendation for the parent to approve. The
    // contributing source/role is recorded as provenance; brain state is
    // NOT touched here — only parent approval applies effects downstream.
    const [rec] = await db
      .insert(brainRecommendations)
      .values({
        tenantId,
        learnerId: body.learnerId,
        type: recType as (typeof brainRecommendations.type)["_"]["data"],
        status: "PENDING",
        title: body.title.slice(0, 255),
        description: body.rationale,
        payload: { proposedValue: body.proposedValue ?? null },
        evidence: {
          contributorRole,
          contributorUserId: claims.sub,
          rationale: body.rationale,
        },
        sourceSignals: [
          {
            source: `${contributorRole}_suggestion`,
            contributorRole,
            suggestedByUserId: claims.sub,
            summary: body.rationale.slice(0, 240),
          },
        ],
      })
      .returning();

    await emitFamilyAudit({
      db,
      request,
      eventType: "CAREGIVER_SUGGESTION_SUBMITTED",
      tenantId,
      learnerId: body.learnerId,
      resourceId: rec.id,
      details: { contributorRole, recommendationType: recType, title: rec.title },
    });

    // Typed domain event for downstream consumers (recommendation-svc v2
    // dashboard). The recommendation row above is the authoritative record.
    const event: RecommendationSuggestedPayload = {
      recommendationId: rec.id,
      learnerId: body.learnerId,
      suggestedByUserId: claims.sub,
      suggestedByRole: contributorRole,
      recommendationType: recType,
      title: rec.title,
      rationale: body.rationale,
    };
    try {
      const bus = await getRealtimeBus();
      await bus.publish(EVENTS.RECOMMENDATION_SUGGESTED, event);
    } catch (err) {
      request.log.warn({ err }, "failed to publish recommendation.suggested");
    }

    return reply.status(201).send({
      id: rec.id,
      status: rec.status,
      requiresParentApproval: true,
      suggestedByRole: contributorRole,
    });
  });
}
