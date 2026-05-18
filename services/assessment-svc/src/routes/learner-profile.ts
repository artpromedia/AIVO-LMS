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
  initBaseline,
  pickNextItem,
  recordResponse,
  shouldStop,
  finalize,
  type BaselineItem,
  type BaselineState,
  type ItemResponse,
} from "@aivo/adaptive-baseline";

interface SerializedState {
  theta: number;
  infoSum: number;
  administered: ItemResponse[];
  coveredSkills: string[];
  readingDifficulty: boolean;
}

function serialize(s: BaselineState): SerializedState {
  return {
    theta: s.theta,
    infoSum: s.infoSum,
    administered: s.administered,
    coveredSkills: [...s.coveredSkills],
    readingDifficulty: s.readingDifficulty,
  };
}

function hydrate(s: SerializedState): BaselineState {
  return {
    theta: s.theta,
    infoSum: s.infoSum,
    administered: s.administered,
    coveredSkills: new Set(s.coveredSkills),
    readingDifficulty: !!s.readingDifficulty,
  };
}

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

      const state = initBaseline({
        readingDifficulty: body.readingDifficulty,
        priorTheta: body.priorTheta,
      });
      const bank = Array.isArray(body.bank) ? body.bank : [];
      const nextItem = bank.length > 0 ? pickNextItem(state, bank) : null;

      const [row] = await db
        .insert(adaptiveBaselineSessions)
        .values({
          tenantId: learner.tenantId,
          learnerId: learner.id,
          status: "in_progress",
          state: serialize(state),
        })
        .returning();

      return reply.send({
        sessionId: row.id,
        learnerId: learner.id,
        nextItem,
        stop: shouldStop(state),
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

      const state = hydrate(row.state as SerializedState);
      const next = recordResponse({
        state,
        item: body.item,
        response: body.response,
      });
      const stop = shouldStop(next);
      const bank = Array.isArray(body.bank) ? body.bank : [];
      const nextItem = !stop.stop && bank.length > 0 ? pickNextItem(next, bank) : null;

      await db
        .update(adaptiveBaselineSessions)
        .set({ state: serialize(next), updatedAt: new Date() })
        .where(eq(adaptiveBaselineSessions.id, row.id));

      return reply.send({ sessionId: row.id, nextItem, stop, theta: next.theta });
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

      const state = hydrate(row.state as SerializedState);
      const result = finalize(state, body.bank);

      await db
        .update(adaptiveBaselineSessions)
        .set({
          state: serialize(state),
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

      return reply.send({
        sessionId: row.id,
        finalTheta: result.finalTheta,
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
      const state = hydrate(row.state as SerializedState);
      return reply.send({
        active: true,
        sessionId: row.id,
        startedAt: row.startedAt,
        theta: state.theta,
        itemsAdministered: state.administered.length,
        stop: shouldStop(state),
      });
    },
  );
}
