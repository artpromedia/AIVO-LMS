import { FastifyInstance } from "fastify";
import { eq, or, and, desc, sql } from "drizzle-orm";
import { siblingLinks, leaderboardEntries, xpEvents } from "@aivo/db";
import { authenticateRequest, requireSelfOrRole } from "../auth.js";
import {
  siblingsLinkSchema,
  getSiblingsByLearnerIdSchema,
  getSiblingsByLearnerIdLeaderboardSchema,
  deleteSiblingsUnlinkSchema,
} from "./schemas.js";

export function registerSiblingRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>,
) {
  app.post(
    "/api/engagement/siblings/link",
    { schema: siblingsLinkSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerAId, learnerBId, familyLeaderboard } = request.body as {
        learnerAId: string;
        learnerBId: string;
        familyLeaderboard?: boolean;
      };

      if (!requireSelfOrRole(claims, learnerAId, "PARENT", "PLATFORM_ADMIN")) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const existing = await db
        .select()
        .from(siblingLinks)
        .where(
          or(
            and(eq(siblingLinks.learnerAId, learnerAId), eq(siblingLinks.learnerBId, learnerBId)),
            and(eq(siblingLinks.learnerAId, learnerBId), eq(siblingLinks.learnerBId, learnerAId)),
          ),
        );

      if (existing.length > 0) {
        return reply.status(400).send({ error: "Sibling link already exists" });
      }

      const [link] = await db
        .insert(siblingLinks)
        .values({
          learnerAId,
          learnerBId,
          familyLeaderboard: familyLeaderboard ?? true,
        })
        .returning();

      return link;
    },
  );

  app.get(
    "/api/engagement/siblings/:learnerId",
    { schema: getSiblingsByLearnerIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as { learnerId: string };
      if (!requireSelfOrRole(claims, learnerId, "PARENT", "PLATFORM_ADMIN")) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const links = await db
        .select()
        .from(siblingLinks)
        .where(or(eq(siblingLinks.learnerAId, learnerId), eq(siblingLinks.learnerBId, learnerId)));

      const siblingIds = links.map((l) =>
        l.learnerAId === learnerId ? l.learnerBId : l.learnerAId,
      );

      return { siblings: siblingIds, links };
    },
  );

  app.get(
    "/api/engagement/siblings/:learnerId/leaderboard",
    { schema: getSiblingsByLearnerIdLeaderboardSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as { learnerId: string };
      if (!requireSelfOrRole(claims, learnerId, "PARENT", "PLATFORM_ADMIN")) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      const links = await db
        .select()
        .from(siblingLinks)
        .where(
          and(
            or(eq(siblingLinks.learnerAId, learnerId), eq(siblingLinks.learnerBId, learnerId)),
            eq(siblingLinks.familyLeaderboard, true),
          ),
        );

      const familyIds = new Set<string>([learnerId]);
      links.forEach((l) => {
        familyIds.add(l.learnerAId);
        familyIds.add(l.learnerBId);
      });

      const results = [];
      for (const id of familyIds) {
        const [xpResult] = await db
          .select({ total: sql<number>`COALESCE(SUM(${xpEvents.xpAmount}), 0)` })
          .from(xpEvents)
          .where(eq(xpEvents.learnerId, id));
        results.push({ learnerId: id, totalXp: Number(xpResult.total) });
      }

      results.sort((a, b) => b.totalXp - a.totalXp);
      return results;
    },
  );

  app.delete(
    "/api/engagement/siblings/unlink",
    { schema: deleteSiblingsUnlinkSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerAId, learnerBId } = request.body as {
        learnerAId: string;
        learnerBId: string;
      };

      if (!requireSelfOrRole(claims, learnerAId, "PARENT", "PLATFORM_ADMIN")) {
        return reply.status(403).send({ error: "Forbidden" });
      }

      await db
        .delete(siblingLinks)
        .where(
          or(
            and(eq(siblingLinks.learnerAId, learnerAId), eq(siblingLinks.learnerBId, learnerBId)),
            and(eq(siblingLinks.learnerAId, learnerBId), eq(siblingLinks.learnerBId, learnerAId)),
          ),
        );

      return { unlinked: true };
    },
  );
}
