import { FastifyInstance } from "fastify";
import { eq, and, or, asc, sql } from "drizzle-orm";
import {
  quests,
  questProgress,
  xpEvents,
  virtualCurrency,
  currencyTransactions,
  learners,
} from "@aivo/db";
import { authenticateRequest } from "../auth.js";

/**
 * Resolve the canonical `learners.id` for a request.
 *
 * Frontend historically passes `user.id` (users.id) as the "learnerId" because
 * the auth provider only exposes the user object. `learners.id` is different
 * from `users.id`, so we accept either form and resolve to the canonical
 * `learners.id`. Falls back to `claims.sub -> learners.userId` when no input
 * is supplied. Returns `null` if no matching learner row exists.
 */
async function resolveLearnerId(
  db: ReturnType<typeof import("@aivo/db").createDb>,
  candidate: string | undefined | null,
  authUserId: string | undefined | null,
): Promise<string | null> {
  const id = candidate || authUserId;
  if (!id) return null;
  const [row] = await db
    .select({ id: learners.id })
    .from(learners)
    .where(or(eq(learners.id, id), eq(learners.userId, id)))
    .limit(1);
  return row?.id ?? null;
}
import { QUEST_WORLDS, resolveQuestWorld } from "../quest-worlds.js";
import {
  getQuestsWorldsSchema,
  getQuestsWorldBySlugSchema,
  getQuestsByWorldKeySchema,
  getQuestsChapterByQuestIdSchema,
  getQuestsProgressByLearnerIdSchema,
  questsStartSchema,
  questsCompleteSchema,
} from "./schemas.js";

export function registerQuestRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>,
) {
  app.get(
    "/api/engagement/quests/worlds",
    { schema: getQuestsWorldsSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;
      return QUEST_WORLDS;
    },
  );

  app.get(
    "/api/engagement/quests/worlds/:slug",
    { schema: getQuestsWorldBySlugSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { slug } = request.params as { slug: string };
      const world = resolveQuestWorld(slug);
      if (!world) {
        return reply.status(404).send({ error: "quest_world_not_found", slug });
      }
      return world;
    },
  );

  app.get(
    "/api/engagement/quests/:worldKey",
    { schema: getQuestsByWorldKeySchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { worldKey } = request.params as { worldKey: string };
      const world = resolveQuestWorld(worldKey);
      if (!world) {
        return reply.status(404).send({ error: "quest_world_not_found", worldKey });
      }
      const rows = await db
        .select()
        .from(quests)
        .where(eq(quests.worldKey, world.key))
        .orderBy(asc(quests.chapterNumber));
      return { world, quests: rows };
    },
  );

  app.get(
    "/api/engagement/quests/chapter/:questId",
    { schema: getQuestsChapterByQuestIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { questId } = request.params as { questId: string };
      const [quest] = await db.select().from(quests).where(eq(quests.id, questId));
      if (!quest) {
        return reply.status(404).send({ error: "quest_not_found", questId });
      }
      const world = resolveQuestWorld(quest.worldKey);
      return { quest, world };
    },
  );

  app.get(
    "/api/engagement/quests/progress/:learnerId",
    { schema: getQuestsProgressByLearnerIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId: rawLearnerId } = request.params as { learnerId: string };
      const resolvedLearnerId = await resolveLearnerId(db, rawLearnerId, claims.sub);
      if (!resolvedLearnerId) {
        // No learner record yet (e.g., parent viewing before learner is created)
        return [];
      }
      const progress = await db
        .select()
        .from(questProgress)
        .where(eq(questProgress.learnerId, resolvedLearnerId));

      return progress;
    },
  );

  app.post(
    "/api/engagement/quests/start",
    { schema: questsStartSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId: rawLearnerId, questId } = request.body as {
        learnerId: string;
        questId: string;
      };
      if (!rawLearnerId || !questId) {
        return (reply as any).status(400).send({ error: "learnerId and questId required" });
      }

      const learnerId = await resolveLearnerId(db, rawLearnerId, claims.sub);
      if (!learnerId) {
        return (reply as any).status(404).send({ error: "learner_not_found" });
      }

      const [quest] = await db.select().from(quests).where(eq(quests.id, questId));
      if (!quest) {
        return (reply as any).status(404).send({ error: "quest_not_found", questId });
      }

      const [existing] = await db
        .select()
        .from(questProgress)
        .where(and(eq(questProgress.learnerId, learnerId), eq(questProgress.questId, questId)));

      if (existing) {
        // Re-entering an in-progress quest is allowed and idempotent;
        // re-entering a completed quest just returns the completion row so
        // the client can route to the world detail without an error.
        return { progress: existing, quest };
      }

      const [progress] = await db
        .insert(questProgress)
        .values({ learnerId, questId, status: "IN_PROGRESS" })
        .returning();

      return { progress, quest };
    },
  );

  app.post(
    "/api/engagement/quests/complete",
    { schema: questsCompleteSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const {
        learnerId: rawLearnerId,
        questId,
        score,
      } = request.body as {
        learnerId: string;
        questId: string;
        score: number;
      };

      if (!rawLearnerId || !questId) {
        return (reply as any).status(400).send({ error: "learnerId and questId required" });
      }
      if (typeof score !== "number" || score < 0 || score > 100) {
        return (reply as any).status(400).send({ error: "score must be 0-100" });
      }

      const learnerId = await resolveLearnerId(db, rawLearnerId, claims.sub);
      if (!learnerId) {
        return (reply as any).status(404).send({ error: "learner_not_found" });
      }

      const [quest] = await db.select().from(quests).where(eq(quests.id, questId));
      if (!quest) {
        return (reply as any).status(404).send({ error: "quest_not_found", questId });
      }

      const [existing] = await db
        .select()
        .from(questProgress)
        .where(and(eq(questProgress.learnerId, learnerId), eq(questProgress.questId, questId)));

      if (!existing) {
        return (reply as any).status(400).send({ error: "quest_not_started" });
      }

      // Idempotent: if already completed, return the existing record without
      // double-awarding XP/coins.
      if (existing.status === "COMPLETED") {
        return {
          completed: true,
          score: existing.score ?? score,
          xpAwarded: 0,
          coinAwarded: 0,
          alreadyCompleted: true,
        };
      }

      await db
        .update(questProgress)
        .set({
          status: "COMPLETED",
          score,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(questProgress.learnerId, learnerId), eq(questProgress.questId, questId)));

      const xpAmount = quest.xpReward ?? 50;
      const coinAmount = quest.coinReward ?? 10;
      const tenantId = claims.tenantId || claims.sub;

      await db.insert(xpEvents).values({
        tenantId,
        learnerId,
        eventType: "quest_completed",
        xpAmount,
        metadata: { questId, worldKey: quest.worldKey, chapterNumber: quest.chapterNumber, score },
      });

      if (coinAmount > 0) {
        const [wallet] = await db
          .select()
          .from(virtualCurrency)
          .where(eq(virtualCurrency.learnerId, learnerId));
        if (wallet) {
          await db
            .update(virtualCurrency)
            .set({
              coins: sql`${virtualCurrency.coins} + ${coinAmount}`,
              totalCoinsEarned: sql`${virtualCurrency.totalCoinsEarned} + ${coinAmount}`,
              updatedAt: new Date(),
            })
            .where(eq(virtualCurrency.learnerId, learnerId));
        } else {
          await db.insert(virtualCurrency).values({
            learnerId,
            coins: coinAmount,
            totalCoinsEarned: coinAmount,
          });
        }
        await db.insert(currencyTransactions).values({
          learnerId,
          currencyType: "coins",
          amount: coinAmount,
          reason: "quest_completed",
          referenceId: questId,
        });
      }

      return {
        completed: true,
        score,
        xpAwarded: xpAmount,
        coinAwarded: coinAmount,
        alreadyCompleted: false,
      };
    },
  );
}
