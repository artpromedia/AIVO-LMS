/**
 * Executive-function partner routes.
 *
 * Strategic backdrop: ADHD is fundamentally an executive-function
 * challenge. The agent quietly carries the planning load —
 *   • visually breaks tasks down into 4-step micro-plans,
 *   • surfaces "you've been stuck three minutes — want to try this
 *     differently?" prompts,
 *   • remembers what worked yesterday morning vs. afternoon.
 * This module is the persistence + run-loop API behind those features.
 *
 *   POST   /api/ef/breakdown            { learnerId, taskId, title, modalities? }
 *          → creates / replaces a breakdown via @aivo/executive-function
 *   GET    /api/ef/breakdown/:learnerId/:taskId
 *          → { breakdown, completedStepIds, nextStepPrompt }
 *   POST   /api/ef/breakdown/:id/step/:stepId/complete
 *          → records completion (optional dwellMs)
 *   POST   /api/ef/session-outcome      { learnerId, sessionOutcome }
 *          → ledger row used by best-window queries + the parent dashboard
 *   GET    /api/ef/best-window/:learnerId
 *          → { bestWindow, stats[] } (≥2 obs in bucket required to endorse)
 */
import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import {
  efTaskBreakdowns,
  efTaskStepProgress,
  efSessionOutcomes,
  learners,
} from "@aivo/db";
import {
  breakDownTask,
  bucketLocalHour,
  TimeOfDayMemory,
  nextStepPrompt,
  type TimeOfDay,
  type SessionOutcome,
  type TaskBreakdown,
  type MicroStep,
} from "@aivo/executive-function";
import { createLogger } from "@aivo/observability";

const logger = createLogger("tutor-svc.ef");

const VALID_TOD = new Set<TimeOfDay>([
  "early-morning",
  "morning",
  "midday",
  "afternoon",
  "evening",
]);

/** Per-subject 60-req/min token bucket on write paths. */
const RATE_BURST = 60;
const RATE_WINDOW_MS = 60_000;
const buckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(subject: string, now: number): boolean {
  const b = buckets.get(subject);
  if (!b || b.resetAt <= now) {
    buckets.set(subject, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_BURST) return false;
  b.count += 1;
  return true;
}

async function loadAuthorizedLearner(
  db: any,
  req: FastifyRequest,
  reply: FastifyReply,
  learnerId: string,
) {
  const auth = (req as any).auth;
  if (!auth?.sub) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }
  const [learner] = await db
    .select()
    .from(learners)
    .where(eq(learners.id, learnerId))
    .limit(1);
  if (!learner) {
    reply.code(404).send({ error: "Learner not found" });
    return null;
  }
  // Service tokens, learners reading their own data, and parents on
  // their kid's data are all allowed.
  if (auth.role === "service") return learner;
  if (auth.role === "LEARNER" && auth.sub === learner.userId) return learner;
  if (auth.role === "PARENT" && learner.parentId === auth.sub) return learner;
  if (auth.role === "TEACHER" || auth.role === "ADMIN") return learner;
  reply.code(403).send({ error: "Forbidden" });
  return null;
}

export function registerEfRoutes(app: FastifyInstance, db: any): void {
  // ====================================================================
  // POST /api/ef/breakdown — create or replace a breakdown for a task.
  // ====================================================================
  app.post(
    "/api/ef/breakdown",
    {
      schema: {
        tags: ["Executive Function"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["learnerId", "taskId", "title"],
          properties: {
            learnerId: { type: "string" },
            taskId: { type: "string", maxLength: 128 },
            title: { type: "string", maxLength: 255 },
            modalities: {
              type: "array",
              maxItems: 4,
              items: {
                type: "string",
                enum: ["visual", "auditory", "kinesthetic", "reading"],
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = (req as any).auth;
      if (!auth?.sub) return reply.code(401).send({ error: "Unauthorized" });
      if (!rateLimit(auth.sub, Date.now())) {
        return reply.code(429).send({ error: "Too many requests" });
      }
      const body = req.body as {
        learnerId: string;
        taskId: string;
        title: string;
        modalities?: ("visual" | "auditory" | "kinesthetic" | "reading")[];
      };
      const learner = await loadAuthorizedLearner(db, req, reply, body.learnerId);
      if (!learner) return;

      // The EF package's generic 4-step plan already attaches the
      // standard modality icons (read → reading, restate → auditory,
      // do → kinesthetic, check → visual). The optional `modalities`
      // input narrows the generic plan to just the modalities the
      // learner can use; if the entire generic plan is filtered out
      // we fall back to the unfiltered plan.
      const breakdown: TaskBreakdown = (() => {
        const base = breakDownTask({ taskId: body.taskId, title: body.title });
        if (!body.modalities || body.modalities.length === 0) return base;
        const allow = new Set(body.modalities);
        const narrowed = base.steps.filter(
          (s) => !s.modality || allow.has(s.modality),
        );
        if (narrowed.length === 0) return base;
        return {
          taskId: base.taskId,
          steps: narrowed,
          totalWeight: narrowed.reduce((a, s) => a + s.weight, 0),
        };
      })();

      // Replace any prior breakdown for this (learner, task) pair so
      // each task has at most one canonical plan.
      await db
        .delete(efTaskBreakdowns)
        .where(
          and(
            eq(efTaskBreakdowns.learnerId, learner.id),
            eq(efTaskBreakdowns.taskId, body.taskId),
          ),
        );
      const [row] = await db
        .insert(efTaskBreakdowns)
        .values({
          tenantId: learner.tenantId,
          learnerId: learner.id,
          taskId: body.taskId,
          title: body.title,
          totalWeight: breakdown.totalWeight,
          steps: breakdown.steps,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      return reply.code(201).send({
        id: row.id,
        learnerId: learner.id,
        taskId: row.taskId,
        title: row.title,
        totalWeight: row.totalWeight,
        steps: row.steps,
      });
    },
  );

  // ====================================================================
  // GET /api/ef/breakdown/:learnerId/:taskId
  // ====================================================================
  app.get<{ Params: { learnerId: string; taskId: string } }>(
    "/api/ef/breakdown/:learnerId/:taskId",
    {
      schema: {
        tags: ["Executive Function"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId", "taskId"],
          properties: {
            learnerId: { type: "string" },
            taskId: { type: "string" },
          },
        },
      },
    },
    async (req, reply) => {
      const { learnerId, taskId } = req.params;
      const learner = await loadAuthorizedLearner(db, req, reply, learnerId);
      if (!learner) return;

      const [row] = await db
        .select()
        .from(efTaskBreakdowns)
        .where(
          and(
            eq(efTaskBreakdowns.learnerId, learner.id),
            eq(efTaskBreakdowns.taskId, taskId),
          ),
        )
        .limit(1);
      if (!row) return reply.code(404).send({ error: "No breakdown" });

      const completed = await db
        .select()
        .from(efTaskStepProgress)
        .where(eq(efTaskStepProgress.breakdownId, row.id));
      const completedStepIds = completed.map((c: any) => c.stepId as string);

      const breakdown: TaskBreakdown = {
        taskId: row.taskId,
        steps: row.steps as MicroStep[],
        totalWeight: row.totalWeight,
      };
      const prompt = nextStepPrompt({
        breakdown,
        completedStepIds,
      });

      return reply.send({
        id: row.id,
        learnerId: learner.id,
        taskId: row.taskId,
        title: row.title,
        breakdown,
        completedStepIds,
        nextStepPrompt: prompt,
      });
    },
  );

  // ====================================================================
  // POST /api/ef/breakdown/:id/step/:stepId/complete
  // ====================================================================
  app.post<{ Params: { id: string; stepId: string } }>(
    "/api/ef/breakdown/:id/step/:stepId/complete",
    {
      schema: {
        tags: ["Executive Function"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id", "stepId"],
          properties: {
            id: { type: "string" },
            stepId: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: { dwellMs: { type: "integer", minimum: 0, maximum: 86_400_000 } },
        },
      },
    },
    async (req, reply) => {
      const auth = (req as any).auth;
      if (!auth?.sub) return reply.code(401).send({ error: "Unauthorized" });
      if (!rateLimit(auth.sub, Date.now())) {
        return reply.code(429).send({ error: "Too many requests" });
      }
      const { id, stepId } = req.params;
      const body = (req.body ?? {}) as { dwellMs?: number };

      const [breakdown] = await db
        .select()
        .from(efTaskBreakdowns)
        .where(eq(efTaskBreakdowns.id, id))
        .limit(1);
      if (!breakdown) return reply.code(404).send({ error: "No breakdown" });
      const learner = await loadAuthorizedLearner(
        db,
        req,
        reply,
        breakdown.learnerId,
      );
      if (!learner) return;

      // Reject step IDs that aren't in the persisted plan — defends
      // against junk that would otherwise pollute completion analytics.
      const steps = breakdown.steps as MicroStep[];
      if (!steps.some((s) => s.id === stepId)) {
        return reply.code(400).send({ error: "Unknown step id" });
      }

      try {
        await db.insert(efTaskStepProgress).values({
          breakdownId: id,
          stepId,
          completedAt: new Date(),
          dwellMs: typeof body.dwellMs === "number" ? body.dwellMs : null,
        });
      } catch (err: any) {
        // Idempotent: a duplicate (breakdownId, stepId) is fine — the
        // unique index in 0027 enforces no double-credit.
        if (!String(err?.message ?? "").includes("duplicate")) {
          logger.error("ef step complete failed", { err: String(err?.message ?? err), id, stepId });
          return reply.code(500).send({ error: "Internal" });
        }
      }
      return reply.code(204).send();
    },
  );

  // ====================================================================
  // POST /api/ef/session-outcome
  // ====================================================================
  app.post(
    "/api/ef/session-outcome",
    {
      schema: {
        tags: ["Executive Function"],
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["learnerId", "outcome"],
          properties: {
            learnerId: { type: "string" },
            outcome: {
              type: "object",
              required: ["accuracy"],
              properties: {
                startedAt: { type: "string" },
                localHour: { type: "integer", minimum: 0, maximum: 23 },
                subject: { type: "string", maxLength: 64 },
                modality: {
                  type: "string",
                  enum: ["visual", "auditory", "kinesthetic", "reading"],
                },
                accuracy: { type: "number", minimum: 0, maximum: 1 },
                frustrationRate: { type: "number", minimum: 0, maximum: 1 },
                attentionMinutes: { type: "integer", minimum: 0, maximum: 1440 },
              },
            },
          },
        },
      },
    },
    async (req, reply) => {
      const auth = (req as any).auth;
      if (!auth?.sub) return reply.code(401).send({ error: "Unauthorized" });
      if (!rateLimit(auth.sub, Date.now())) {
        return reply.code(429).send({ error: "Too many requests" });
      }
      const body = req.body as {
        learnerId: string;
        outcome: {
          startedAt?: string;
          localHour?: number;
          subject?: string;
          modality?: string;
          accuracy: number;
          frustrationRate?: number;
          attentionMinutes?: number;
        };
      };
      const learner = await loadAuthorizedLearner(db, req, reply, body.learnerId);
      if (!learner) return;

      const startedAt = body.outcome.startedAt
        ? new Date(body.outcome.startedAt)
        : new Date();
      if (Number.isNaN(startedAt.getTime())) {
        return reply.code(400).send({ error: "Invalid startedAt" });
      }
      const hour =
        typeof body.outcome.localHour === "number"
          ? body.outcome.localHour
          : startedAt.getHours();
      const tod = bucketLocalHour(hour);

      const [row] = await db
        .insert(efSessionOutcomes)
        .values({
          tenantId: learner.tenantId,
          learnerId: learner.id,
          startedAt,
          timeOfDay: tod,
          subject: body.outcome.subject ?? null,
          modality: body.outcome.modality ?? null,
          accuracy: body.outcome.accuracy,
          frustrationRate: body.outcome.frustrationRate ?? 0,
          attentionMinutes: body.outcome.attentionMinutes ?? 0,
        })
        .returning();
      return reply.code(201).send({ id: row.id, timeOfDay: tod });
    },
  );

  // ====================================================================
  // GET /api/ef/best-window/:learnerId
  // ====================================================================
  app.get<{ Params: { learnerId: string } }>(
    "/api/ef/best-window/:learnerId",
    {
      schema: {
        tags: ["Executive Function"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
      },
    },
    async (req, reply) => {
      const { learnerId } = req.params;
      const learner = await loadAuthorizedLearner(db, req, reply, learnerId);
      if (!learner) return;

      const rows = await db
        .select()
        .from(efSessionOutcomes)
        .where(eq(efSessionOutcomes.learnerId, learner.id))
        .orderBy(desc(efSessionOutcomes.startedAt))
        .limit(500);

      const memory = TimeOfDayMemory.fromJSON(
        rows
          .filter((r: any) => VALID_TOD.has(r.timeOfDay))
          .map((r: any): SessionOutcome => ({
            timeOfDay: r.timeOfDay,
            dayOfWeek:
              r.startedAt instanceof Date
                ? r.startedAt.getDay()
                : new Date(r.startedAt).getDay(),
            accuracy: r.accuracy,
            frustrationRate: r.frustrationRate,
            attentionMinutes: r.attentionMinutes,
          })),
      );

      return reply.send({
        learnerId: learner.id,
        bestWindow: memory.bestWindow(),
        stats: memory.stats(),
        n: rows.length,
      });
    },
  );
}
