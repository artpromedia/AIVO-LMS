import { FastifyInstance } from "fastify";
import { eq, desc } from "drizzle-orm";
import { selCheckins, breakActivities } from "@aivo/db";
import { authenticateRequest, requireSelfOrRole } from "../auth.js";
import { selCheckinSchema, getSelCheckinsByLearnerIdSchema, getSelExercisesByEmotionSchema, getBreaksCatalogSchema, breakLogSchema, getBreaksByLearnerIdSchema } from "./schemas.js";

const GUIDED_EXERCISES: Record<string, { title: string; steps: string[]; durationMinutes: number }[]> = {
  sad: [
    { title: "Rainbow Breathing", steps: ["Close your eyes", "Breathe in through your nose for 4 counts", "Hold for 2 counts", "Breathe out slowly for 6 counts", "Imagine a rainbow appearing with each breath", "Repeat 5 times"], durationMinutes: 3 },
    { title: "Gratitude Garden", steps: ["Think of 3 things you're grateful for", "Draw or imagine each one as a flower", "Describe the color of each flower", "Take a deep breath and smile"], durationMinutes: 5 },
  ],
  frustrated: [
    { title: "Volcano Calm-Down", steps: ["Stand up tall like a volcano", "Breathe in deeply — feel the 'lava' rising", "Now breathe out slowly and let the lava cool", "Shake out your hands", "Roll your shoulders", "The volcano is calm now!"], durationMinutes: 3 },
    { title: "Squeeze & Release", steps: ["Make tight fists with both hands", "Hold for 5 seconds", "Release and spread your fingers wide", "Squeeze your shoulders up to your ears", "Hold for 5 seconds", "Release and let them drop", "Repeat 3 times"], durationMinutes: 4 },
  ],
  tired: [
    { title: "Energy Boost Dance", steps: ["Stand up and stretch your arms high", "March in place for 10 counts", "Do 5 jumping jacks", "Wiggle your whole body", "Take 3 deep breaths", "You're energized!"], durationMinutes: 3 },
    { title: "Power Nap Visualization", steps: ["Rest your head on your arms", "Close your eyes", "Imagine floating on a cloud", "The cloud gently carries you over a beautiful forest", "Feel the warmth of the sun", "Open your eyes when you're ready"], durationMinutes: 5 },
  ],
  happy: [
    { title: "Share the Joy", steps: ["Think about why you're happy", "Draw a picture of your happy moment", "Share it with someone if you'd like", "Do a little celebration dance!"], durationMinutes: 3 },
  ],
  okay: [
    { title: "Mindful Moment", steps: ["Sit comfortably", "Name 5 things you can see", "Name 4 things you can touch", "Name 3 things you can hear", "Name 2 things you can smell", "Name 1 thing you can taste"], durationMinutes: 4 },
  ],
  excited: [
    { title: "Channel Your Energy", steps: ["Take 3 deep breaths", "Write down what you're excited about", "Set a small goal related to your excitement", "Do a quick stretch", "Ready to focus!"], durationMinutes: 3 },
  ],
};

const BREAK_ACTIVITIES_CATALOG = [
  { type: "breathing", name: "Box Breathing", description: "Breathe in 4 counts, hold 4, out 4, hold 4. Repeat 4 times.", durationSeconds: 60, trigger: "attention_low" },
  { type: "breathing", name: "Star Breathing", description: "Trace a star shape while breathing in on one line and out on the next.", durationSeconds: 90, trigger: "stress_high" },
  { type: "movement", name: "Desk Stretches", description: "Stretch arms, neck, and shoulders without leaving your seat.", durationSeconds: 120, trigger: "attention_low" },
  { type: "movement", name: "Animal Walks", description: "Bear walk, crab walk, frog jump — move like animals around your space!", durationSeconds: 180, trigger: "energy_high" },
  { type: "sensory", name: "Calm Corner", description: "Find a quiet spot. Listen to calming sounds for 2 minutes.", durationSeconds: 120, trigger: "overwhelm" },
  { type: "sensory", name: "Fidget Time", description: "Use a fidget tool, squeeze a stress ball, or play with putty.", durationSeconds: 120, trigger: "restless" },
  { type: "creative", name: "Quick Doodle", description: "Draw anything you want for 2 minutes. No rules!", durationSeconds: 120, trigger: "attention_low" },
  { type: "creative", name: "Story Starter", description: "Start a story with 'Once upon a time...' and write 3 sentences.", durationSeconds: 120, trigger: "attention_low" },
  { type: "mindfulness", name: "Body Scan", description: "Close your eyes. Notice how each part of your body feels, from toes to head.", durationSeconds: 180, trigger: "stress_high" },
  { type: "mindfulness", name: "Gratitude Check", description: "Think of 3 things you're grateful for right now.", durationSeconds: 60, trigger: "sad" },
];

export function registerSelRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>
) {
  app.post("/api/engagement/sel/checkin", { schema: selCheckinSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const body = request.body as {
      learnerId: string;
      emotion: string;
      intensity?: number;
      notes?: string;
    };

    if (!requireSelfOrRole(claims, body.learnerId, "PARENT", "TEACHER", "PLATFORM_ADMIN")) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [checkin] = await db
      .insert(selCheckins)
      .values({
        learnerId: body.learnerId,
        emotion: body.emotion,
        intensity: body.intensity || 3,
        notes: body.notes,
        xpAwarded: 5,
      })
      .returning();

    const exercises = GUIDED_EXERCISES[body.emotion] || GUIDED_EXERCISES["okay"];

    return { checkin, suggestedExercises: exercises };
  });

  app.get("/api/engagement/sel/checkins/:learnerId", { schema: getSelCheckinsByLearnerIdSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as { learnerId: string };
    if (!requireSelfOrRole(claims, learnerId, "PARENT", "TEACHER", "CAREGIVER", "THERAPIST", "PLATFORM_ADMIN")) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const checkins = await db
      .select()
      .from(selCheckins)
      .where(eq(selCheckins.learnerId, learnerId))
      .orderBy(desc(selCheckins.createdAt))
      .limit(30);

    return checkins;
  });

  app.get("/api/engagement/sel/exercises/:emotion", { schema: getSelExercisesByEmotionSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { emotion } = request.params as { emotion: string };
    const exercises = GUIDED_EXERCISES[emotion] || GUIDED_EXERCISES["okay"];
    return exercises;
  });

  app.get("/api/engagement/breaks/catalog", { schema: getBreaksCatalogSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { trigger } = request.query as { trigger?: string };
    if (trigger) {
      return BREAK_ACTIVITIES_CATALOG.filter((a) => a.trigger === trigger);
    }
    return BREAK_ACTIVITIES_CATALOG;
  });

  app.post("/api/engagement/break/log", { schema: breakLogSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const body = request.body as {
      learnerId: string;
      activityType: string;
      durationSeconds?: number;
      trigger?: string;
    };

    if (!requireSelfOrRole(claims, body.learnerId, "PARENT", "TEACHER", "PLATFORM_ADMIN")) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const [activity] = await db
      .insert(breakActivities)
      .values({
        learnerId: body.learnerId,
        activityType: body.activityType,
        durationSeconds: body.durationSeconds || 0,
        trigger: body.trigger,
        xpAwarded: 5,
      })
      .returning();

    return activity;
  });

  app.get("/api/engagement/breaks/:learnerId", { schema: getBreaksByLearnerIdSchema }, async (request, reply) => {
    const claims = await authenticateRequest(request, reply);
    if (!claims) return;

    const { learnerId } = request.params as { learnerId: string };
    if (!requireSelfOrRole(claims, learnerId, "PARENT", "TEACHER", "CAREGIVER", "THERAPIST", "PLATFORM_ADMIN")) {
      return reply.status(403).send({ error: "Forbidden" });
    }

    const breaks = await db
      .select()
      .from(breakActivities)
      .where(eq(breakActivities.learnerId, learnerId))
      .orderBy(desc(breakActivities.createdAt))
      .limit(20);

    return breaks;
  });
}
