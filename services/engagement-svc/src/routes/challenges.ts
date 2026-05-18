import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { challenges, challengeParticipants } from "@aivo/db";
import { authenticateRequest } from "../auth.js";
import {
  challengesCreateSchema,
  challengesJoinSchema,
  challengesByChallengeIdAnswerSchema,
  getChallengesByChallengeIdSchema,
  getChallengesLearnerByLearnerIdSchema,
} from "./schemas.js";

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function registerChallengeRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>,
) {
  app.post(
    "/api/engagement/challenges/create",
    { schema: challengesCreateSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const body = request.body as {
        challengeType: string;
        subject?: string;
        title: string;
        maxParticipants?: number;
        createdBy: string;
      };

      const tenantId = claims.tenantId || claims.sub;

      const [challenge] = await db
        .insert(challenges)
        .values({
          tenantId,
          challengeType: body.challengeType,
          subject: body.subject,
          title: body.title,
          inviteCode: generateInviteCode(),
          maxParticipants: body.maxParticipants || 2,
          createdBy: body.createdBy,
        })
        .returning();

      await db.insert(challengeParticipants).values({
        challengeId: challenge.id,
        learnerId: body.createdBy,
      });

      return challenge;
    },
  );

  app.post(
    "/api/engagement/challenges/join",
    { schema: challengesJoinSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { inviteCode, learnerId } = request.body as {
        inviteCode: string;
        learnerId: string;
      };

      const [challenge] = await db
        .select()
        .from(challenges)
        .where(eq(challenges.inviteCode, inviteCode));

      if (!challenge) return reply.status(404).send({ error: "Challenge not found" });
      if (challenge.status !== "WAITING") {
        return reply.status(400).send({ error: "Challenge already started or ended" });
      }

      const participants = await db
        .select()
        .from(challengeParticipants)
        .where(eq(challengeParticipants.challengeId, challenge.id));

      if (participants.length >= (challenge.maxParticipants || 2)) {
        return reply.status(400).send({ error: "Challenge is full" });
      }

      const alreadyJoined = participants.find((p) => p.learnerId === learnerId);
      if (alreadyJoined) return reply.status(400).send({ error: "Already joined" });

      await db.insert(challengeParticipants).values({
        challengeId: challenge.id,
        learnerId,
      });

      if (participants.length + 1 >= (challenge.maxParticipants || 2)) {
        await db
          .update(challenges)
          .set({ status: "ACTIVE", startsAt: new Date() })
          .where(eq(challenges.id, challenge.id));
      }

      return { joined: true, challengeId: challenge.id };
    },
  );

  app.post(
    "/api/engagement/challenges/:challengeId/answer",
    { schema: challengesByChallengeIdAnswerSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { challengeId } = request.params as { challengeId: string };
      const { learnerId, correct } = request.body as {
        learnerId: string;
        correct: boolean;
      };

      const points = correct ? 10 : 0;

      const [current] = await db
        .select()
        .from(challengeParticipants)
        .where(
          and(
            eq(challengeParticipants.challengeId, challengeId),
            eq(challengeParticipants.learnerId, learnerId),
          ),
        );

      if (!current) return reply.status(404).send({ error: "Participant not found" });

      const updateData: Record<string, number> = {
        score: (current.score || 0) + points,
        answersTotal: (current.answersTotal || 0) + 1,
      };
      if (correct) {
        updateData.answersCorrect = (current.answersCorrect || 0) + 1;
      }

      await db
        .update(challengeParticipants)
        .set(updateData)
        .where(
          and(
            eq(challengeParticipants.challengeId, challengeId),
            eq(challengeParticipants.learnerId, learnerId),
          ),
        );

      const allParticipants = await db
        .select()
        .from(challengeParticipants)
        .where(eq(challengeParticipants.challengeId, challengeId));

      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
      const questionCount = Array.isArray(challenge?.questionBank)
        ? (challenge.questionBank as unknown[]).length
        : 10;

      const allDone = allParticipants.every((p) => {
        const total = p.learnerId === learnerId ? updateData.answersTotal : p.answersTotal || 0;
        return total >= questionCount;
      });

      if (allDone && challenge?.status === "ACTIVE") {
        await db
          .update(challenges)
          .set({ status: "COMPLETED", endsAt: new Date() })
          .where(eq(challenges.id, challengeId));
      }

      return { scored: points, newScore: updateData.score, challengeCompleted: allDone };
    },
  );

  app.get(
    "/api/engagement/challenges/:challengeId",
    { schema: getChallengesByChallengeIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { challengeId } = request.params as { challengeId: string };
      const [challenge] = await db.select().from(challenges).where(eq(challenges.id, challengeId));

      if (!challenge) return reply.status(404).send({ error: "Not found" });

      const participants = await db
        .select()
        .from(challengeParticipants)
        .where(eq(challengeParticipants.challengeId, challengeId))
        .orderBy(desc(challengeParticipants.score));

      return { challenge, participants };
    },
  );

  app.get(
    "/api/engagement/challenges/learner/:learnerId",
    { schema: getChallengesLearnerByLearnerIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as { learnerId: string };
      const participations = await db
        .select()
        .from(challengeParticipants)
        .where(eq(challengeParticipants.learnerId, learnerId));

      const challengeIds = participations.map((p) => p.challengeId);
      if (challengeIds.length === 0) return [];

      const result = [];
      for (const cid of challengeIds) {
        const [c] = await db.select().from(challenges).where(eq(challenges.id, cid));
        if (c) result.push(c);
      }

      return result;
    },
  );
}
