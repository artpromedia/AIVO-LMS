import { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { sensoryProfiles } from "@aivo/db";
import { eq } from "drizzle-orm";
import {
  assessmentsSensoryProfileSchema,
  getAssessmentsSensoryProfileByLearnerIdSchema,
} from "./schemas.js";

export async function registerSensoryProfileRoutes(app: FastifyInstance) {
  const db = (app as any).db;

  app.post(
    "/api/assessments/sensory-profile",
    { schema: assessmentsSensoryProfileSchema },
    async (req, reply) => {
      let auth: any = null;
      try {
        auth = await verifyJWT(req.headers.authorization?.replace("Bearer ", "") || "");
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      if (!auth) return reply.status(401).send({ error: "Unauthorized" });

      const { learnerId, visual, auditory, tactile, vestibular, proprioceptive, notes } =
        req.body as any;
      if (!learnerId) return reply.status(400).send({ error: "learnerId required" });

      const validValues = ["hyper", "hypo", "typical"];
      for (const [field, val] of Object.entries({
        visual,
        auditory,
        tactile,
        vestibular,
        proprioceptive,
      })) {
        if (val && !validValues.includes(val as string)) {
          return reply.status(400).send({ error: `${field} must be one of: hyper, hypo, typical` });
        }
      }

      const existing = await db
        .select()
        .from(sensoryProfiles)
        .where(eq(sensoryProfiles.learnerId, learnerId))
        .limit(1);

      if (existing.length > 0) {
        await db
          .update(sensoryProfiles)
          .set({
            visual: visual || "typical",
            auditory: auditory || "typical",
            tactile: tactile || "typical",
            vestibular: vestibular || "typical",
            proprioceptive: proprioceptive || "typical",
            notes: notes || null,
            updatedAt: new Date(),
          })
          .where(eq(sensoryProfiles.learnerId, learnerId));

        return { status: "updated", learnerId };
      }

      const [profile] = await db
        .insert(sensoryProfiles)
        .values({
          learnerId,
          visual: visual || "typical",
          auditory: auditory || "typical",
          tactile: tactile || "typical",
          vestibular: vestibular || "typical",
          proprioceptive: proprioceptive || "typical",
          notes: notes || null,
        })
        .returning();

      return { status: "created", profile };
    },
  );

  app.get(
    "/api/assessments/sensory-profile/:learnerId",
    { schema: getAssessmentsSensoryProfileByLearnerIdSchema },
    async (req, reply) => {
      let auth: any = null;
      try {
        auth = await verifyJWT(req.headers.authorization?.replace("Bearer ", "") || "");
      } catch {
        return reply.status(401).send({ error: "Unauthorized" });
      }
      if (!auth) return reply.status(401).send({ error: "Unauthorized" });

      const { learnerId } = req.params as any;
      const [profile] = await db
        .select()
        .from(sensoryProfiles)
        .where(eq(sensoryProfiles.learnerId, learnerId))
        .limit(1);

      if (!profile) return reply.status(200).send({ profile: null });
      return profile;
    },
  );
}
