/**
 * Special-interest signal CRUD for the parent dashboard.
 *
 * Strategic backdrop: most platforms treat learners' deep, focused
 * interests as distractions to overcome. We treat them as the engine.
 * This route is the persistence + intake surface that feeds the
 * `@aivo/special-interest-engine` scoring + theme picker.
 *
 *   GET    /api/family/interests/:learnerId
 *          → { signals: LearnerInterestSignal[], scored: ScoredInterest[], topTheme }
 *   POST   /api/family/interests/:learnerId
 *          { slug, source?, polarity?, confidence?, note? } → 201
 *   DELETE /api/family/interests/:learnerId/:signalId  → 204
 */
import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { learnerInterestSignals } from "@aivo/db";
import {
  scoreInterests,
  pickTheme,
  type LearnerInterestSignal,
  type LearnerInterestProfile,
} from "@aivo/special-interest-engine";
import { authenticateRequest, verifyParentOwnership } from "../auth.js";
import {
  getInterestsByLearnerIdSchema,
  interestsByLearnerIdSchema,
  deleteInterestsByLearnerIdBySignalIdSchema,
} from "./schemas.js";

const VALID_SOURCES = new Set([
  "caregiver_intake",
  "iep_signal",
  "engagement",
  "self_report",
  "system",
]);

const SLUG_REGEX = /^[a-z0-9][a-z0-9_-]{0,63}$/;

/**
 * Per-subject 60-req/min token bucket on the write paths. The read
 * path is GET-only and not amplified.
 */
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

export async function registerInterestRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get(
    "/api/family/interests/:learnerId",
    { schema: getInterestsByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      const { learnerId } = req.params as { learnerId: string };
      const owns = await verifyParentOwnership(db, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const rows = await db
        .select()
        .from(learnerInterestSignals)
        .where(eq(learnerInterestSignals.learnerId, learnerId))
        .orderBy(desc(learnerInterestSignals.observedAt));

      const signals: LearnerInterestSignal[] = rows.map((r: any) => ({
        slug: r.slug,
        source: r.source,
        polarity: r.polarity,
        confidence: r.confidence,
        observedAt: (r.observedAt instanceof Date
          ? r.observedAt.toISOString()
          : r.observedAt) as string,
      }));
      const profile: LearnerInterestProfile = { learnerId, signals };
      const scored = scoreInterests(profile);
      const topTheme = pickTheme(profile);

      return {
        learnerId,
        signals: rows.map((r: any) => ({
          id: r.id,
          slug: r.slug,
          source: r.source,
          polarity: r.polarity,
          confidence: r.confidence,
          observedAt: r.observedAt,
          note: r.note,
        })),
        scored,
        topTheme: topTheme ? { slug: topTheme.slug, label: topTheme.label } : null,
      };
    },
  );

  app.post(
    "/api/family/interests/:learnerId",
    { schema: interestsByLearnerIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      if (!rateLimit(auth.sub, Date.now())) {
        return reply.code(429).send({ error: "Too many requests" });
      }
      const { learnerId } = req.params as { learnerId: string };
      const owns = await verifyParentOwnership(db, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const body = (req.body ?? {}) as {
        slug?: string;
        source?: string;
        polarity?: number;
        confidence?: number;
        note?: string;
      };

      const slug = typeof body.slug === "string" ? body.slug.toLowerCase().trim() : "";
      if (!SLUG_REGEX.test(slug)) {
        return reply.code(400).send({ error: "Invalid slug" });
      }
      const source = body.source ?? "caregiver_intake";
      if (!VALID_SOURCES.has(source)) {
        return reply.code(400).send({ error: "Invalid source" });
      }
      const polarity = body.polarity ?? 1;
      if (polarity !== -1 && polarity !== 0 && polarity !== 1) {
        return reply.code(400).send({ error: "Polarity must be -1, 0, or 1" });
      }
      const confidence =
        typeof body.confidence === "number" && body.confidence >= 0 && body.confidence <= 1
          ? body.confidence
          : 1;
      // Cap free-text note length so a single signal cannot bloat the row.
      const note =
        typeof body.note === "string" && body.note.length > 0 ? body.note.slice(0, 500) : null;

      const [row] = await db
        .insert(learnerInterestSignals)
        .values({
          // Pull tenantId via the learner the parent already passed
          // ownership against; verifyParentOwnership has loaded it.
          tenantId: (await getLearnerTenantId(db, learnerId)) as string,
          learnerId,
          slug,
          source,
          polarity,
          confidence,
          observedAt: new Date(),
          note,
          recordedBy: auth.sub,
        })
        .returning();

      return reply.code(201).send({
        id: row.id,
        slug: row.slug,
        source: row.source,
        polarity: row.polarity,
        confidence: row.confidence,
        observedAt: row.observedAt,
        note: row.note,
      });
    },
  );

  app.delete(
    "/api/family/interests/:learnerId/:signalId",
    { schema: deleteInterestsByLearnerIdBySignalIdSchema },
    async (req: any, reply: any) => {
      const auth = await authenticateRequest(req, reply);
      if (!auth) return;
      if (!rateLimit(auth.sub, Date.now())) {
        return reply.code(429).send({ error: "Too many requests" });
      }
      const { learnerId, signalId } = req.params as {
        learnerId: string;
        signalId: string;
      };
      const owns = await verifyParentOwnership(db, auth.sub, learnerId);
      if (!owns) return reply.code(403).send({ error: "Forbidden" });

      const result = await db
        .delete(learnerInterestSignals)
        .where(
          and(
            eq(learnerInterestSignals.id, signalId),
            eq(learnerInterestSignals.learnerId, learnerId),
          ),
        );
      // drizzle-orm/postgres returns no count by default; we rely on
      // the upstream ownership check to constrain the delete.
      void result;
      return reply.code(204).send();
    },
  );
}

async function getLearnerTenantId(db: any, learnerId: string): Promise<string | null> {
  const { learners } = await import("@aivo/db");
  const [row] = await db
    .select({ tenantId: learners.tenantId })
    .from(learners)
    .where(eq(learners.id, learnerId))
    .limit(1);
  return row?.tenantId ?? null;
}
