/**
 * Baseline item calibration analytics.
 *
 * Read-only aggregations over the real append-only Postgres table
 * `baseline_item_response_logs` (@aivo/db). Replaces the in-memory placeholder
 * the legacy web-v2 admin used. Surfaced in the web-admin platform console.
 *
 *   GET /api/admin-svc/baseline/metrics?days=30          — headline + by-difficulty
 *   GET /api/admin-svc/baseline/recalibration?days=90    — per-item calibration
 *
 * The recalibration view flags items whose observed correct-rate (p-value)
 * diverges from the band the item was seeded into — candidates for re-banding.
 */
import { FastifyInstance } from "fastify";
import { and, gte, sql } from "drizzle-orm";
import { baselineItemResponseLogs as logs } from "@aivo/db";
import { verifyJWT } from "@aivo/security";

async function requirePlatformAdmin(req: any, reply: any): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "Missing authorization header" });
    return false;
  }
  try {
    const payload = await verifyJWT<any>(auth.slice(7));
    if (payload.role !== "PLATFORM_ADMIN") {
      reply.status(403).send({ error: "Platform admin access required" });
      return false;
    }
    req.user = payload;
    return true;
  } catch {
    reply.status(401).send({ error: "Invalid token" });
    return false;
  }
}

function windowDays(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.min(Math.floor(n), 365) : 30;
}

function cutoff(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

// Expected correct-rate (p-value) target per difficulty band. Observed rates
// far from these suggest the item is mis-banded.
const BAND_TARGET: Record<string, number> = {
  foundational: 0.85,
  approaching: 0.7,
  grade_level: 0.55,
  stretch: 0.4,
};

export function registerBaselineRoutes(app: FastifyInstance, db: any): void {
  app.get<{ Querystring: { days?: string } }>(
    "/api/admin-svc/baseline/metrics",
    { schema: { tags: ["baseline"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const days = windowDays(req.query.days);
      const since = cutoff(days);

      const [totals] = await db
        .select({
          responses: sql<number>`count(*)`,
          correct: sql<number>`sum(case when ${logs.correct} then 1 else 0 end)`,
          skipped: sql<number>`sum(case when ${logs.skipped} then 1 else 0 end)`,
          learners: sql<number>`count(distinct ${logs.learnerId})`,
          baselines: sql<number>`count(distinct ${logs.baselineId})`,
          items: sql<number>`count(distinct ${logs.itemKey})`,
          avgLatencyMs: sql<number>`coalesce(avg(${logs.latencyMs}), 0)`,
        })
        .from(logs)
        .where(gte(logs.recordedAt, since));

      const byDifficulty = await db
        .select({
          difficulty: logs.difficulty,
          responses: sql<number>`count(*)`,
          pCorrect: sql<number>`avg(case when ${logs.correct} then 1.0 else 0.0 end)`,
          pSkipped: sql<number>`avg(case when ${logs.skipped} then 1.0 else 0.0 end)`,
        })
        .from(logs)
        .where(gte(logs.recordedAt, since))
        .groupBy(logs.difficulty);

      const responses = num(totals?.responses);
      return {
        windowDays: days,
        totals: {
          responses,
          correct: num(totals?.correct),
          skipped: num(totals?.skipped),
          correctRate: responses ? num(totals?.correct) / responses : 0,
          skipRate: responses ? num(totals?.skipped) / responses : 0,
          learners: num(totals?.learners),
          baselines: num(totals?.baselines),
          items: num(totals?.items),
          avgLatencyMs: Math.round(num(totals?.avgLatencyMs)),
        },
        byDifficulty: byDifficulty.map((row: any) => ({
          difficulty: String(row.difficulty),
          responses: num(row.responses),
          pCorrect: num(row.pCorrect),
          pSkipped: num(row.pSkipped),
        })),
      };
    },
  );

  app.get<{ Querystring: { days?: string; minSample?: string } }>(
    "/api/admin-svc/baseline/recalibration",
    { schema: { tags: ["baseline"], security: [{ bearerAuth: [] }] } },
    async (req, reply) => {
      if (!(await requirePlatformAdmin(req, reply))) return;
      const days = windowDays(req.query.days);
      const since = cutoff(days);
      const minSample = Math.max(1, Math.min(Number(req.query.minSample) || 20, 1000));

      const rows = await db
        .select({
          itemKey: logs.itemKey,
          skillId: logs.skillId,
          subjectId: logs.subjectId,
          difficulty: logs.difficulty,
          samples: sql<number>`count(*)`,
          pCorrect: sql<number>`avg(case when ${logs.correct} then 1.0 else 0.0 end)`,
          seedTheta: sql<number>`avg(${logs.difficultyTheta})`,
        })
        .from(logs)
        .where(gte(logs.recordedAt, since))
        .groupBy(logs.itemKey, logs.skillId, logs.subjectId, logs.difficulty)
        .having(sql`count(*) >= ${minSample}`)
        .orderBy(sql`count(*) desc`)
        .limit(200);

      const items = rows.map((row: any) => {
        const difficulty = String(row.difficulty);
        const pCorrect = num(row.pCorrect);
        const target = BAND_TARGET[difficulty] ?? 0.55;
        const divergence = pCorrect - target;
        // Flag items more than 20 points off their band target.
        const recommend =
          Math.abs(divergence) >= 0.2 ? (divergence > 0 ? "harder" : "easier") : "ok";
        return {
          itemKey: String(row.itemKey),
          skillId: String(row.skillId),
          subjectId: String(row.subjectId),
          difficulty,
          samples: num(row.samples),
          pCorrect,
          seedTheta: num(row.seedTheta),
          targetPCorrect: target,
          divergence,
          recommendation: recommend,
        };
      });

      return { windowDays: days, minSample, items };
    },
  );
}
