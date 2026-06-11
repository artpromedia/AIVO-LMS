/**
 * Learner-profile read endpoint + adaptive baseline run-loop.
 *
 * Strategic backdrop: a traditional 20-question fixed-form baseline
 * disadvantages kids with reading difficulties, slow processing speed,
 * or test anxiety. This route exposes:
 *
 *   GET  /api/assessments/learner-profile/:learnerId
 *        — returns the most-recently-derived `LearningProfile` (modality
 *          fit, processing speed, frustration tolerance, attention
 *          pattern). The grade-level placement (theta) is one field;
 *          the profile is the more valuable artifact.
 *
 *   POST /api/assessments/adaptive-baseline/:learnerId/start
 *   POST /api/assessments/adaptive-baseline/:learnerId/respond
 *   POST /api/assessments/adaptive-baseline/:learnerId/finalize
 *        — fully adaptive run-loop backed by `@aivo/adaptive-baseline`.
 *          Adjusts difficulty after every item, stops once SE(θ) ≤
 *          0.35 (subject to MIN/MAX caps), and emits the
 *          `LearningProfile` on finalize.
 */
import { FastifyInstance } from "fastify";
import { learners, learnerProfiles, adaptiveBaselineSessions } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { eq, desc } from "drizzle-orm";
import {
  estimateSubjectThetas,
  shouldStop,
  type BaselineItem,
  type ItemResponse,
} from "@aivo/adaptive-baseline";
import {
  startRun,
  respondToItem,
  finalizeRun,
  serializeSession,
  hydrateSession,
  type SerializedRunSession,
} from "../services/adaptive-baseline-runner.js";
import { applyBaselineDeliveryLevel } from "../services/curriculum-alignment.js";

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Unauthorized" });
  }
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

async function loadLearner(db: any, learnerId: string) {
  let [learner] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
  if (!learner) {
    [learner] = await db.select().from(learners).where(eq(learners.userId, learnerId)).limit(1);
  }
  return learner ?? null;
}

function checkAccess(user: any, learner: any): boolean {
  if (user.role === "LEARNER" && user.sub !== learner.userId) return false;
  if (user.role === "PARENT" && learner.parentId !== user.sub) return false;
  return true;
}

export async function registerLearnerProfileRoutes(app: FastifyInstance) {
  // ====================================================================
  // GET /api/assessments/learner-profile/:learnerId
  // ====================================================================
  app.get(
    "/api/assessments/learner-profile/:learnerId",
    {
      schema: {
        tags: ["Learner Profile"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };

      const learner = await loadLearner(db, learnerId);
      if (!learner) return reply.status(404).send({ error: "Learner not found" });
      if (!checkAccess(user, learner)) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const [profile] = await db
        .select()
        .from(learnerProfiles)
        .where(eq(learnerProfiles.learnerId, learner.id))
        .limit(1);

      if (!profile) {
        return reply.status(404).send({
          error: "no_profile",
          message: "No baseline learning profile on file for this learner.",
        });
      }

      return reply.send({
        learnerId: learner.id,
        thetaPlacement: profile.thetaPlacement,
        subjectThetas: profile.subjectThetas ?? null,
        modalityFit: profile.modalityFit,
        processingSpeedMs: profile.processingSpeedMs,
        frustrationRate: profile.frustrationRate,
        attentionRunLength: profile.attentionRunLength,
        frustrationTolerance: profile.frustrationTolerance,
        itemsAdministered: profile.itemsAdministered,
        baselineCompletedAt: profile.baselineCompletedAt,
      });
    },
  );

  // ====================================================================
  // POST /api/assessments/adaptive-baseline/:learnerId/start
  // ====================================================================
  app.post(
    "/api/assessments/adaptive-baseline/:learnerId/start",
    {
      schema: {
        tags: ["Adaptive Baseline"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
        body: {
          type: "object",
          properties: {
            readingDifficulty: { type: "boolean" },
            priorTheta: { type: "number" },
            bank: { type: "array" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };
      const body = (req.body ?? {}) as {
        readingDifficulty?: boolean;
        priorTheta?: number;
        bank?: BaselineItem[];
      };

      const learner = await loadLearner(db, learnerId);
      if (!learner) return reply.status(404).send({ error: "Learner not found" });
      if (!checkAccess(user, learner)) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const bank = Array.isArray(body.bank) ? body.bank : [];
      // Re-baseline seeding (Sprint 4): when the caller doesn't supply a
      // prior, a learner with a completed baseline starts from their current
      // θ estimate instead of 0 — the run converges faster and never serves
      // wildly mis-leveled openers.
      let priorTheta = body.priorTheta;
      if (priorTheta === undefined) {
        const [profileRow] = await db
          .select({ thetaPlacement: learnerProfiles.thetaPlacement })
          .from(learnerProfiles)
          .where(eq(learnerProfiles.learnerId, learner.id))
          .limit(1);
        if (profileRow && Number.isFinite(profileRow.thetaPlacement)) {
          priorTheta = profileRow.thetaPlacement;
        }
      }
      const { session, nextItem, stop } = startRun({
        bank,
        readingDifficulty: body.readingDifficulty,
        priorTheta,
      });

      const [row] = await db
        .insert(adaptiveBaselineSessions)
        .values({
          tenantId: learner.tenantId,
          learnerId: learner.id,
          status: "in_progress",
          state: serializeSession(session),
        })
        .returning();

      return reply.send({
        sessionId: row.id,
        learnerId: learner.id,
        nextItem,
        stop,
      });
    },
  );

  // ====================================================================
  // POST /api/assessments/adaptive-baseline/:learnerId/respond
  // ====================================================================
  app.post(
    "/api/assessments/adaptive-baseline/:learnerId/respond",
    {
      schema: {
        tags: ["Adaptive Baseline"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["sessionId", "item", "response"],
          properties: {
            sessionId: { type: "string" },
            item: { type: "object" },
            response: { type: "object" },
            bank: { type: "array" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };
      const body = req.body as {
        sessionId: string;
        item: BaselineItem;
        response: ItemResponse;
        bank?: BaselineItem[];
      };

      const learner = await loadLearner(db, learnerId);
      if (!learner) return reply.status(404).send({ error: "Learner not found" });
      if (!checkAccess(user, learner)) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const [row] = await db
        .select()
        .from(adaptiveBaselineSessions)
        .where(eq(adaptiveBaselineSessions.id, body.sessionId))
        .limit(1);
      if (!row) return reply.status(404).send({ error: "Session not found" });
      if (row.learnerId !== learner.id) {
        return reply.status(403).send({ error: "Session does not belong to learner" });
      }
      if (row.status !== "in_progress") {
        return reply.status(409).send({ error: "Session already completed" });
      }

      const session = hydrateSession(row.state as SerializedRunSession);
      const bank = Array.isArray(body.bank) ? body.bank : [];
      // Accept the legacy `{ item, response }` body and the leaner
      // `{ itemId, correct, ... }` form; the item is re-resolved from the
      // server-supplied bank either way so difficulty cannot be spoofed.
      const itemId = (body as any).itemId ?? body.item?.id;
      const resp = (body.response ?? {}) as Partial<ItemResponse>;
      if (typeof itemId !== "string") {
        return reply.status(400).send({ error: "itemId (or item.id) is required" });
      }

      const outcome = respondToItem({
        session,
        itemId,
        correct: !!resp.correct,
        bank,
        responseTimeMs: resp.responseTimeMs,
        affect: resp.affect,
        consumedModality: resp.consumedModality,
      });
      if (!outcome.ok) {
        return reply.status(409).send({ error: "response_rejected", reason: outcome.reason });
      }

      await db
        .update(adaptiveBaselineSessions)
        .set({ state: serializeSession(outcome.session), updatedAt: new Date() })
        .where(eq(adaptiveBaselineSessions.id, row.id));

      return reply.send({
        sessionId: row.id,
        nextItem: outcome.nextItem,
        stop: outcome.stop,
        theta: outcome.theta,
      });
    },
  );

  // ====================================================================
  // POST /api/assessments/adaptive-baseline/:learnerId/finalize
  // ====================================================================
  app.post(
    "/api/assessments/adaptive-baseline/:learnerId/finalize",
    {
      schema: {
        tags: ["Adaptive Baseline"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["sessionId", "bank"],
          properties: {
            sessionId: { type: "string" },
            bank: { type: "array" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };
      const body = req.body as { sessionId: string; bank: BaselineItem[] };

      const learner = await loadLearner(db, learnerId);
      if (!learner) return reply.status(404).send({ error: "Learner not found" });
      if (!checkAccess(user, learner)) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const [row] = await db
        .select()
        .from(adaptiveBaselineSessions)
        .where(eq(adaptiveBaselineSessions.id, body.sessionId))
        .limit(1);
      if (!row) return reply.status(404).send({ error: "Session not found" });
      if (row.learnerId !== learner.id) {
        return reply.status(403).send({ error: "Session does not belong to learner" });
      }

      const session = hydrateSession(row.state as SerializedRunSession);
      const result = finalizeRun(session, body.bank);
      // Per-subject θ (Wave C, G1): replay the run grouped by the bank's
      // subjectId tags. Empty when the bank is untagged or no subject
      // reached the minimum item count — consumers fall back to overall θ.
      const subjectThetas = estimateSubjectThetas(session.state, body.bank ?? []);
      const hasSubjectThetas = Object.keys(subjectThetas).length > 0;

      await db
        .update(adaptiveBaselineSessions)
        .set({
          state: serializeSession(session),
          status: "completed",
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(adaptiveBaselineSessions.id, row.id));

      // Upsert into the canonical learner_profiles artifact.
      await db
        .insert(learnerProfiles)
        .values({
          tenantId: learner.tenantId,
          learnerId: learner.id,
          attemptId: null,
          thetaPlacement: result.profile.thetaPlacement,
          subjectThetas: hasSubjectThetas ? subjectThetas : null,
          modalityFit: result.profile.modalityFit,
          processingSpeedMs: result.profile.processingSpeedMs,
          frustrationRate: result.profile.frustrationRate,
          attentionRunLength: result.profile.attentionRunLength,
          frustrationTolerance: result.profile.frustrationTolerance,
          itemsAdministered: result.itemsAdministered,
          baselineCompletedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: learnerProfiles.learnerId,
          set: {
            thetaPlacement: result.profile.thetaPlacement,
            ...(hasSubjectThetas ? { subjectThetas } : {}),
            modalityFit: result.profile.modalityFit,
            processingSpeedMs: result.profile.processingSpeedMs,
            frustrationRate: result.profile.frustrationRate,
            attentionRunLength: result.profile.attentionRunLength,
            frustrationTolerance: result.profile.frustrationTolerance,
            itemsAdministered: result.itemsAdministered,
            baselineCompletedAt: new Date(),
            updatedAt: new Date(),
          },
        });

      // A finalized run satisfies any outstanding rebaseline request.
      await db
        .update(learnerProfiles)
        .set({ rebaselineRequestedAt: null })
        .where(eq(learnerProfiles.learnerId, learner.id));

      // Persist the θ-derived delivery level onto curriculum_alignment (the
      // learners row + latest brain state) so lesson generation targets the
      // learner's actual placement — per subject when the run split
      // (Wave C, G1). Non-fatal by contract — logs on failure.
      await applyBaselineDeliveryLevel(db, req.log, {
        learnerId: learner.id,
        theta: result.profile.thetaPlacement,
        subjectThetas: hasSubjectThetas ? subjectThetas : null,
      });

      return reply.send({
        sessionId: row.id,
        finalTheta: result.finalTheta,
        subjectThetas: hasSubjectThetas ? subjectThetas : null,
        itemsAdministered: result.itemsAdministered,
        learningProfile: result.profile,
      });
    },
  );

  // ====================================================================
  // GET /api/assessments/adaptive-baseline/:learnerId/active
  // Returns the most-recent in-progress session, if any (so the client
  // can resume a baseline that was interrupted).
  // ====================================================================
  app.get(
    "/api/assessments/adaptive-baseline/:learnerId/active",
    {
      schema: {
        tags: ["Adaptive Baseline"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };

      const learner = await loadLearner(db, learnerId);
      if (!learner) return reply.status(404).send({ error: "Learner not found" });
      if (!checkAccess(user, learner)) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const [row] = await db
        .select()
        .from(adaptiveBaselineSessions)
        .where(eq(adaptiveBaselineSessions.learnerId, learner.id))
        .orderBy(desc(adaptiveBaselineSessions.updatedAt))
        .limit(1);

      if (!row || row.status !== "in_progress") {
        return reply.send({ active: false });
      }
      const session = hydrateSession(row.state as SerializedRunSession);
      return reply.send({
        active: true,
        sessionId: row.id,
        startedAt: row.startedAt,
        theta: session.state.theta,
        itemsAdministered: session.state.administered.length,
        lastServedItemId: session.lastServedItemId,
        stop: shouldStop(session.state),
      });
    },
  );
}
