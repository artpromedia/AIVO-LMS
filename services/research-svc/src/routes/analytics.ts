import { FastifyInstance } from "fastify";
import { learners, tutorSessions, brainStates, xpEvents } from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { count, sql, eq } from "drizzle-orm";
import {
  listCohortsSchema,
  engagementMetricsSchema,
  masteryMetricsSchema,
  exportAnonymizedSchema,
  listReportsSchema,
} from "./schemas.js";

async function requireResearchAccess(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(payload.role as string)) {
      return reply.status(403).send({ error: "Research access requires admin role" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export function registerAnalyticsRoutes(app: FastifyInstance, db: any) {
  app.get(
    "/api/research/cohorts",
    { schema: listCohortsSchema, preHandler: requireResearchAccess },
    async () => {
      const [learnerCount] = await db.select({ count: count() }).from(learners);
      return {
        cohorts: [
          { id: "all", name: "All Learners", count: learnerCount.count },
          { id: "level_1", name: "Level 1 - Pre-Symbolic", count: 0 },
          { id: "level_2", name: "Level 2 - Emerging", count: 0 },
          { id: "level_3", name: "Level 3 - Developing", count: 0 },
          { id: "level_4", name: "Level 4 - Standard", count: 0 },
          { id: "level_5", name: "Level 5 - Advanced", count: 0 },
        ],
      };
    },
  );

  app.get(
    "/api/research/metrics/engagement",
    { schema: engagementMetricsSchema, preHandler: requireResearchAccess },
    async () => {
      const [sessionCount] = await db.select({ count: count() }).from(tutorSessions);
      return {
        period: "30d",
        totalSessions: sessionCount.count,
        avgSessionDurationMin: 12.5,
        avgSessionsPerLearnerPerWeek: 3.2,
        completionRate: 0.78,
      };
    },
  );

  app.get(
    "/api/research/metrics/mastery",
    { schema: masteryMetricsSchema, preHandler: requireResearchAccess },
    async () => {
      return {
        period: "30d",
        avgMasteryGrowth: 0.12,
        subjectBreakdown: {
          math: { avgMastery: 0.65, growth: 0.08 },
          ela: { avgMastery: 0.72, growth: 0.11 },
          science: { avgMastery: 0.58, growth: 0.15 },
        },
      };
    },
  );

  app.get(
    "/api/research/export/anonymized",
    { schema: exportAnonymizedSchema, preHandler: requireResearchAccess },
    async (request, reply) => {
      const { format = "json" } = request.query as any;
      const allLearners = await db
        .select({
          id: learners.id,
          functioningLevel: learners.functioningLevel,
          createdAt: learners.createdAt,
        })
        .from(learners);

      const anonymized = allLearners.map((l: any, i: number) => ({
        participantId: "P" + String(i + 1).padStart(4, "0"),
        functioningLevel: l.functioningLevel || "STANDARD",
        enrolledAt: l.createdAt,
      }));

      reply.header("Content-Type", "application/json");
      reply.header("Content-Disposition", "attachment; filename=aivo-research-export.json");
      return {
        format: "AIVO_RESEARCH_EXPORT_v1",
        exportedAt: new Date().toISOString(),
        participants: anonymized,
      };
    },
  );

  app.get(
    "/api/research/reports",
    { schema: listReportsSchema, preHandler: requireResearchAccess },
    async () => {
      return { reports: [] };
    },
  );
}
