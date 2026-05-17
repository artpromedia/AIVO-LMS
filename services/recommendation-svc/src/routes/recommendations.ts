import type { FastifyInstance } from "fastify";
import type { TenantRole } from "@aivo/enterprise-core";
import { emitAuditEvent } from "@aivo/audit-svc";
import {
  applyRecommendation,
  type BrainProfile,
} from "../services/recommendation-effect-handlers.js";
import {
  RecommendationPolicyError,
  requireParentApproval,
} from "../services/recommendation-policy.js";
import type { ProfileRecommendation } from "../services/types.js";

const STORE = new Map<string, ProfileRecommendation>();
const PROFILES = new Map<string, BrainProfile>();

function ensureProfile(learnerId: string): BrainProfile {
  if (!PROFILES.has(learnerId)) {
    PROFILES.set(learnerId, {});
  }
  return PROFILES.get(learnerId)!;
}

export function seedRecommendationForTest(recommendation: ProfileRecommendation): void {
  STORE.set(recommendation.id, recommendation);
}

export function getProfileForTest(learnerId: string): BrainProfile {
  return ensureProfile(learnerId);
}

export function clearRecommendationStoreForTest(): void {
  STORE.clear();
  PROFILES.clear();
}

interface DecisionBody {
  actorRole: TenantRole;
  amendedValue?: unknown;
  reason?: string;
}

export function registerRecommendationRoutes(app: FastifyInstance): void {
  app.get<{ Params: { id: string } }>("/api/recommendations/:id", async (request, reply) => {
    const recommendation = STORE.get(request.params.id);
    if (!recommendation) return reply.code(404).send({ error: "Not found" });
    return recommendation;
  });

  app.post<{ Params: { id: string }; Body: DecisionBody }>(
    "/api/recommendations/:id/accept",
    async (request, reply) => {
      const recommendation = STORE.get(request.params.id);
      if (!recommendation) return reply.code(404).send({ error: "Not found" });
      try {
        requireParentApproval(request.body?.actorRole);
      } catch (error) {
        if (error instanceof RecommendationPolicyError) {
          return reply.code(403).send({ error: error.code });
        }
        throw error;
      }
      recommendation.status = "APPROVED";
      recommendation.updatedAt = new Date().toISOString();
      const profile = ensureProfile(recommendation.learnerId);
      const result = applyRecommendation(recommendation, profile);
      if (result.status === "APPLIED") {
        recommendation.status = "APPLIED";
        recommendation.appliedAt = result.appliedAt;
      } else {
        recommendation.status = "FAILED";
        recommendation.declineReason = result.reason;
      }
      // Sprint 09: audit emission.
      void emitAuditEvent({
        actorRole: request.body?.actorRole ?? "parent",
        action: "profile_recommendation_approved",
        resourceType: "profile_recommendation",
        resourceId: recommendation.id,
        learnerId: recommendation.learnerId,
        metadata: {
          recommendationType: recommendation.type,
          outcome: result.status,
        },
      });
      return { recommendation, result };
    },
  );

  app.post<{ Params: { id: string }; Body: DecisionBody }>(
    "/api/recommendations/:id/amend",
    async (request, reply) => {
      const recommendation = STORE.get(request.params.id);
      if (!recommendation) return reply.code(404).send({ error: "Not found" });
      try {
        requireParentApproval(request.body?.actorRole);
      } catch (error) {
        if (error instanceof RecommendationPolicyError) {
          return reply.code(403).send({ error: error.code });
        }
        throw error;
      }
      if (request.body?.amendedValue === undefined) {
        return reply.code(400).send({ error: "amendedValue is required" });
      }
      recommendation.status = "AMENDED";
      recommendation.amendedValue = request.body.amendedValue;
      recommendation.updatedAt = new Date().toISOString();
      const profile = ensureProfile(recommendation.learnerId);
      const result = applyRecommendation(recommendation, profile);
      if (result.status === "APPLIED") {
        recommendation.status = "APPLIED";
        recommendation.appliedAt = result.appliedAt;
      } else {
        recommendation.status = "FAILED";
        recommendation.declineReason = result.reason;
      }
      // Sprint 09: audit emission for amendment.
      void emitAuditEvent({
        actorRole: request.body?.actorRole ?? "parent",
        action: "profile_recommendation_amended",
        resourceType: "profile_recommendation",
        resourceId: recommendation.id,
        learnerId: recommendation.learnerId,
        metadata: {
          recommendationType: recommendation.type,
          outcome: result.status,
        },
      });
      return { recommendation, result };
    },
  );

  app.post<{ Params: { id: string }; Body: DecisionBody }>(
    "/api/recommendations/:id/decline",
    async (request, reply) => {
      const recommendation = STORE.get(request.params.id);
      if (!recommendation) return reply.code(404).send({ error: "Not found" });
      try {
        requireParentApproval(request.body?.actorRole);
      } catch (error) {
        if (error instanceof RecommendationPolicyError) {
          return reply.code(403).send({ error: error.code });
        }
        throw error;
      }
      recommendation.status = "DECLINED";
      recommendation.declineReason = request.body?.reason;
      recommendation.updatedAt = new Date().toISOString();
      // Sprint 09: audit emission for decline.
      void emitAuditEvent({
        actorRole: request.body?.actorRole ?? "parent",
        action: "profile_recommendation_declined",
        resourceType: "profile_recommendation",
        resourceId: recommendation.id,
        learnerId: recommendation.learnerId,
        reason: request.body?.reason,
        metadata: { recommendationType: recommendation.type },
      });
      return { recommendation };
    },
  );
}
