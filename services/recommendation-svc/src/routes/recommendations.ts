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
import {
  InMemoryRecommendationStore,
  ProfileStore,
  type RecommendationStore,
} from "../services/recommendation-store.js";
import {
  persistAppliedRecommendation,
  type DbLike,
} from "../services/apply-persistence.js";

// Module-level defaults used when no store is injected (dev/tests). The
// test seed/clear helpers operate on these so callers that don't wire a
// Postgres store keep working exactly as before. Exported so the candidate
// route shares the same in-memory instance (a generated candidate must be
// retrievable by the accept/amend/decline routes).
export const defaultStore = new InMemoryRecommendationStore();
const defaultProfiles = new ProfileStore();

export function seedRecommendationForTest(recommendation: ProfileRecommendation): void {
  defaultStore.seed(recommendation);
}

export function getProfileForTest(learnerId: string): BrainProfile {
  return defaultProfiles.ensure(learnerId);
}

export function clearRecommendationStoreForTest(): void {
  defaultStore.clear();
  defaultProfiles.clear();
}

interface DecisionBody {
  actorRole: TenantRole;
  amendedValue?: unknown;
  reason?: string;
}

export interface RecommendationRouteDeps {
  store?: RecommendationStore;
  profiles?: ProfileStore;
  /**
   * Drizzle handle for durable effect writes (learners / brain_states /
   * learner_profiles). Absent only in dev/in-memory mode — then applied
   * effects are profile-store-only and a warning is logged per decision.
   */
  db?: DbLike;
}

export function registerRecommendationRoutes(
  app: FastifyInstance,
  deps: RecommendationRouteDeps = {},
): void {
  const store = deps.store ?? defaultStore;
  const profiles = deps.profiles ?? defaultProfiles;
  const db = deps.db ?? null;

  /** Durable write for an APPLIED effect; downgrades to FAILED on miss. */
  async function persistEffect(
    recommendation: ProfileRecommendation,
    log: { info: (o: object, m?: string) => void; warn: (o: object, m?: string) => void },
  ): Promise<{ ok: boolean; reason?: string }> {
    if (!db) {
      log.warn(
        {
          event: "recommendation.persistence_skipped",
          recommendationId: recommendation.id,
          type: recommendation.type,
        },
        "no db wired (dev/in-memory mode); applied effect not durably persisted",
      );
      return { ok: true };
    }
    const outcome = await persistAppliedRecommendation(db, log, recommendation);
    return outcome.ok ? { ok: true } : { ok: false, reason: outcome.reason };
  }

  app.get<{ Params: { id: string } }>("/api/recommendations/:id", async (request, reply) => {
    const recommendation = await store.get(request.params.id);
    if (!recommendation) return reply.code(404).send({ error: "Not found" });
    return recommendation;
  });

  // List a learner's recommendations, newest first, optionally filtered by
  // status (e.g. ?status=PENDING for the parent approval panel). The BFF
  // enforces the parent/learner scope; tenant scoping mirrors the candidate
  // route (enterprise auth hook or explicit caller context).
  app.get<{ Params: { learnerId: string }; Querystring: { status?: string } }>(
    "/api/recommendations/learner/:learnerId",
    async (request) => {
      const all = await store.listByLearner(request.params.learnerId);
      const status = request.query?.status;
      const filtered = status ? all.filter((r) => r.status === status) : all;
      filtered.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return { recommendations: filtered };
    },
  );

  app.post<{ Params: { id: string }; Body: DecisionBody }>(
    "/api/recommendations/:id/accept",
    async (request, reply) => {
      const recommendation = await store.get(request.params.id);
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
      const profile = profiles.ensure(recommendation.learnerId);
      const result = applyRecommendation(recommendation, profile);
      if (result.status === "APPLIED") {
        const persisted = await persistEffect(recommendation, request.log);
        if (persisted.ok) {
          recommendation.status = "APPLIED";
          recommendation.appliedAt = result.appliedAt;
        } else {
          recommendation.status = "FAILED";
          recommendation.declineReason = persisted.reason;
        }
      } else {
        recommendation.status = "FAILED";
        recommendation.declineReason = result.reason;
      }
      await store.update(recommendation.id, {
        status: recommendation.status,
        appliedAt: recommendation.appliedAt,
        declineReason: recommendation.declineReason,
        updatedAt: recommendation.updatedAt,
      });
      if (result.snapshot && recommendation.status === "APPLIED") {
        await store.recordSnapshot(result.snapshot, recommendation.id);
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
      const recommendation = await store.get(request.params.id);
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
      const profile = profiles.ensure(recommendation.learnerId);
      const result = applyRecommendation(recommendation, profile);
      if (result.status === "APPLIED") {
        const persisted = await persistEffect(recommendation, request.log);
        if (persisted.ok) {
          recommendation.status = "APPLIED";
          recommendation.appliedAt = result.appliedAt;
        } else {
          recommendation.status = "FAILED";
          recommendation.declineReason = persisted.reason;
        }
      } else {
        recommendation.status = "FAILED";
        recommendation.declineReason = result.reason;
      }
      await store.update(recommendation.id, {
        status: recommendation.status,
        amendedValue: recommendation.amendedValue,
        appliedAt: recommendation.appliedAt,
        declineReason: recommendation.declineReason,
        updatedAt: recommendation.updatedAt,
      });
      if (result.snapshot && recommendation.status === "APPLIED") {
        await store.recordSnapshot(result.snapshot, recommendation.id);
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
      const recommendation = await store.get(request.params.id);
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
      await store.update(recommendation.id, {
        status: recommendation.status,
        declineReason: recommendation.declineReason,
        updatedAt: recommendation.updatedAt,
      });
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
