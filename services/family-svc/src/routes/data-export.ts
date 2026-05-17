import { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import {
  learners, sensoryProfiles, iepProfiles, iepGoals, learnerFunctioningLevels,
  brainStates, brainStateSnapshots, brainRecommendations, functionalMilestones,
  parentReportedEvents, lessonSessions, gradebookEntries, tutorSessions,
  homeworkAssignments, homeworkSessions, transitionPlans, languageProfiles,
  xpEvents, badges, streaks, virtualCurrency,
} from "@aivo/db";
import { eq } from "drizzle-orm";
import { getDataExportByLearnerIdSchema } from "./schemas.js";

export async function registerDataExportRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.get("/api/family/data-export/:learnerId", { schema: getDataExportByLearnerIdSchema }, async (req, reply) => {
    const auth = await verifyJWT(req.headers.authorization?.replace("Bearer ", "") || "");
    if (!auth) return reply.status(401).send({ error: "Unauthorized" });

    const { learnerId } = req.params as any;

    const [learner] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
    if (!learner) return reply.status(404).send({ error: "Learner not found" });

    if (learner.parentId !== auth.sub && !["PLATFORM_ADMIN"].includes(auth.role)) {
      return reply.status(403).send({ error: "Only the parent can export learner data" });
    }

    const [sensory] = await db.select().from(sensoryProfiles).where(eq(sensoryProfiles.learnerId, learnerId)).limit(1);
    const [iep] = await db.select().from(iepProfiles).where(eq(iepProfiles.learnerId, learnerId)).limit(1);
    const goals = await db.select().from(iepGoals).where(eq(iepGoals.learnerId, learnerId));
    const [functioning] = await db.select().from(learnerFunctioningLevels).where(eq(learnerFunctioningLevels.learnerId, learnerId)).limit(1);
    const [brain] = await db.select().from(brainStates).where(eq(brainStates.learnerId, learnerId)).limit(1);
    const snapshots = await db.select().from(brainStateSnapshots).where(eq(brainStateSnapshots.learnerId, learnerId));
    const recommendations = await db.select().from(brainRecommendations).where(eq(brainRecommendations.learnerId, learnerId));
    const milestones = await db.select().from(functionalMilestones).where(eq(functionalMilestones.learnerId, learnerId));
    const events = await db.select().from(parentReportedEvents).where(eq(parentReportedEvents.learnerId, learnerId));
    const sessions = await db.select().from(lessonSessions).where(eq(lessonSessions.learnerId, learnerId));
    const grades = await db.select().from(gradebookEntries).where(eq(gradebookEntries.learnerId, learnerId));
    const tutorSess = await db.select().from(tutorSessions).where(eq(tutorSessions.learnerId, learnerId));
    const hwAssignments = await db.select().from(homeworkAssignments).where(eq(homeworkAssignments.learnerId, learnerId));
    const hwSessions = await db.select().from(homeworkSessions).where(eq(homeworkSessions.learnerId, learnerId));
    const [transition] = await db.select().from(transitionPlans).where(eq(transitionPlans.learnerId, learnerId)).limit(1);
    const [langProfile] = await db.select().from(languageProfiles).where(eq(languageProfiles.learnerId, learnerId)).limit(1);
    const xp = await db.select().from(xpEvents).where(eq(xpEvents.learnerId, learnerId));
    const learnerBadges = await db.select().from(badges).where(eq(badges.learnerId, learnerId));
    const [streak] = await db.select().from(streaks).where(eq(streaks.learnerId, learnerId)).limit(1);
    const [currency] = await db.select().from(virtualCurrency).where(eq(virtualCurrency.learnerId, learnerId)).limit(1);

    const exportData = {
      exportedAt: new Date().toISOString(),
      format: "AIVO_GDPR_EXPORT_v1",
      learner: {
        profile: learner,
        sensoryProfile: sensory || null,
        functioningLevel: functioning || null,
        languageProfile: langProfile || null,
      },
      brain: {
        currentState: brain || null,
        snapshots,
        recommendations,
        milestones,
        parentReportedEvents: events,
      },
      iep: {
        profile: iep || null,
        goals,
      },
      learning: {
        lessonSessions: sessions,
        gradebook: grades,
        tutorSessions: tutorSess,
      },
      homework: {
        assignments: hwAssignments,
        sessions: hwSessions,
      },
      engagement: {
        xpEvents: xp,
        badges: learnerBadges,
        streak: streak || null,
        currency: currency || null,
      },
      transitionPlan: transition || null,
    };

    reply.header("Content-Type", "application/json");
    reply.header("Content-Disposition", `attachment; filename="aivo-export-${learnerId}.json"`);
    return exportData;
  });
}
