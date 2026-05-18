import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { lessonPlans } from "@aivo/db";
import { authenticateRequest, requireRole } from "../auth.js";
import {
  lessonPlansCreateSchema,
  lessonPlansGenerateSchema,
  getLessonPlansTeacherSchema,
  getLessonPlansLearnerByLearnerIdSchema,
  getLessonPlansByPlanIdSchema,
  updateLessonPlansByPlanIdSchema,
} from "./schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`engagement-svc: ${name} must be set in production`);
  return devDefault;
}
const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3004");
const BRAIN_SVC_URL = requireUrl("BRAIN_SVC_URL", "http://localhost:3002");

export function registerLessonPlanRoutes(
  app: FastifyInstance,
  db: ReturnType<typeof import("@aivo/db").createDb>,
) {
  app.post(
    "/api/engagement/lesson-plans/create",
    { schema: lessonPlansCreateSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      if (!requireRole(claims, "TEACHER", "PLATFORM_ADMIN")) {
        return reply.status(403).send({ error: "Only teachers can create lesson plans" });
      }

      const body = request.body as {
        learnerId: string;
        subject: string;
        title: string;
        gradeLevel?: string;
        content?: Record<string, unknown>;
        accommodations?: unknown[];
        activities?: unknown[];
        formativeAssessments?: unknown[];
      };

      const tenantId = claims.tenantId || claims.sub;

      const [plan] = await db
        .insert(lessonPlans)
        .values({
          tenantId,
          teacherUserId: claims.sub,
          learnerId: body.learnerId,
          subject: body.subject,
          title: body.title,
          gradeLevel: body.gradeLevel,
          content: body.content || {},
          accommodations: body.accommodations || [],
          activities: body.activities || [],
          formativeAssessments: body.formativeAssessments || [],
          status: "DRAFT",
        })
        .returning();

      return plan;
    },
  );

  app.post(
    "/api/engagement/lesson-plans/generate",
    { schema: lessonPlansGenerateSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      if (!requireRole(claims, "TEACHER", "PLATFORM_ADMIN")) {
        return reply.status(403).send({ error: "Only teachers can generate lesson plans" });
      }

      const body = request.body as {
        learnerId: string;
        subject: string;
        gradeLevel: string;
        topic?: string;
        functioningLevel?: string;
        accommodationNotes?: string;
        curriculumStandard?: string;
      };

      const tenantId = claims.tenantId || claims.sub;

      let brainData = null;
      try {
        const brainRes = await fetch(`${BRAIN_SVC_URL}/api/brain/${body.learnerId}`, {
          headers: { Authorization: request.headers.authorization || "" },
        });
        if (brainRes.ok) brainData = await brainRes.json();
      } catch {
        /* brain data is optional */
      }

      const prompt = buildLessonPlanPrompt(body, brainData);

      let generatedContent: Record<string, unknown> = {};
      let generatedActivities: unknown[] = [];
      let generatedAccommodations: unknown[] = [];
      let generatedAssessments: unknown[] = [];

      try {
        const aiRes = await fetch(`${AI_SVC_URL}/api/ai/generate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: request.headers.authorization || "",
          },
          body: JSON.stringify({
            type: "lesson_plan",
            subject: body.subject,
            gradeLevel: body.gradeLevel,
            prompt,
            responseFormat: "json",
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const parsed =
            typeof aiData.content === "string" ? tryParseJSON(aiData.content) : aiData.content;
          if (parsed) {
            generatedContent = {
              objective: parsed.objective || "",
              overview: parsed.overview || "",
              standards: parsed.standards || [],
              materials: parsed.materials || [],
              duration: parsed.duration || "45 minutes",
              differentiationGroups: parsed.differentiationGroups || [],
            };
            generatedActivities = parsed.activities || [];
            generatedAccommodations = parsed.accommodations || [];
            generatedAssessments = parsed.formativeAssessments || [];
          }
        }
      } catch {
        /* AI generation is best-effort */
      }

      if (!generatedContent.objective) {
        generatedContent = buildFallbackContent(body);
        generatedActivities = buildFallbackActivities(body);
        generatedAccommodations = buildFallbackAccommodations(body);
        generatedAssessments = buildFallbackAssessments(body);
      }

      const title = body.topic
        ? `${body.subject}: ${body.topic} (${body.gradeLevel})`
        : `${body.subject} Lesson Plan (${body.gradeLevel})`;

      const [plan] = await db
        .insert(lessonPlans)
        .values({
          tenantId,
          teacherUserId: claims.sub,
          learnerId: body.learnerId,
          subject: body.subject,
          title,
          gradeLevel: body.gradeLevel,
          content: generatedContent,
          accommodations: generatedAccommodations,
          activities: generatedActivities,
          formativeAssessments: generatedAssessments,
          status: "DRAFT",
        })
        .returning();

      return plan;
    },
  );

  app.get(
    "/api/engagement/lesson-plans/teacher",
    { schema: getLessonPlansTeacherSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const plans = await db
        .select()
        .from(lessonPlans)
        .where(eq(lessonPlans.teacherUserId, claims.sub))
        .orderBy(desc(lessonPlans.createdAt));

      return plans;
    },
  );

  app.get(
    "/api/engagement/lesson-plans/learner/:learnerId",
    { schema: getLessonPlansLearnerByLearnerIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { learnerId } = request.params as { learnerId: string };
      const plans = await db
        .select()
        .from(lessonPlans)
        .where(eq(lessonPlans.learnerId, learnerId))
        .orderBy(desc(lessonPlans.createdAt));

      return plans;
    },
  );

  app.get(
    "/api/engagement/lesson-plans/:planId",
    { schema: getLessonPlansByPlanIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { planId } = request.params as { planId: string };
      const [plan] = await db.select().from(lessonPlans).where(eq(lessonPlans.id, planId));

      if (!plan) return reply.status(404).send({ error: "Not found" });
      return plan;
    },
  );

  app.put(
    "/api/engagement/lesson-plans/:planId",
    { schema: updateLessonPlansByPlanIdSchema },
    async (request, reply) => {
      const claims = await authenticateRequest(request, reply);
      if (!claims) return;

      const { planId } = request.params as { planId: string };
      const body = request.body as {
        title?: string;
        content?: Record<string, unknown>;
        accommodations?: unknown[];
        activities?: unknown[];
        formativeAssessments?: unknown[];
        status?: string;
      };

      const [existing] = await db
        .select()
        .from(lessonPlans)
        .where(and(eq(lessonPlans.id, planId), eq(lessonPlans.teacherUserId, claims.sub)));

      if (!existing) return reply.status(404).send({ error: "Not found or not yours" });

      const updateFields: Record<string, unknown> = { updatedAt: new Date() };
      if (body.title) updateFields.title = body.title;
      if (body.content) updateFields.content = body.content;
      if (body.accommodations) updateFields.accommodations = body.accommodations;
      if (body.activities) updateFields.activities = body.activities;
      if (body.formativeAssessments) updateFields.formativeAssessments = body.formativeAssessments;
      if (body.status) updateFields.status = body.status;

      const [updated] = await db
        .update(lessonPlans)
        .set(updateFields)
        .where(eq(lessonPlans.id, planId))
        .returning();

      return updated;
    },
  );
}

function tryParseJSON(text: string): Record<string, unknown> | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildLessonPlanPrompt(
  body: {
    subject: string;
    gradeLevel: string;
    topic?: string;
    functioningLevel?: string;
    accommodationNotes?: string;
    curriculumStandard?: string;
  },
  brainData: Record<string, unknown> | null,
): string {
  const parts = [
    `Generate a detailed, classroom-ready lesson plan as JSON.`,
    `Subject: ${body.subject}`,
    `Grade Level: ${body.gradeLevel}`,
  ];
  if (body.topic) parts.push(`Topic: ${body.topic}`);
  if (body.functioningLevel) parts.push(`Student functioning level: ${body.functioningLevel}`);
  if (body.accommodationNotes) parts.push(`Accommodation notes: ${body.accommodationNotes}`);
  if (body.curriculumStandard) parts.push(`Curriculum standard: ${body.curriculumStandard}`);
  if (brainData)
    parts.push(
      `Brain clone data (student learning profile): ${JSON.stringify(brainData).slice(0, 500)}`,
    );

  parts.push(
    `Return JSON with: objective, overview, standards (array), materials (array), duration, activities (array of {name, description, duration, materials, differentiationTips}), accommodations (array of {type, description}), formativeAssessments (array of {name, description, criteria}), differentiationGroups (array of {level, modifications}).`,
  );
  return parts.join("\n");
}

function buildFallbackContent(body: {
  subject: string;
  gradeLevel: string;
  topic?: string;
}): Record<string, unknown> {
  return {
    objective: `Students will demonstrate understanding of key ${body.subject} concepts at the ${body.gradeLevel} level.`,
    overview: `This lesson covers ${body.topic || body.subject} with differentiated instruction for diverse learners.`,
    standards: [`${body.subject} Standard aligned to ${body.gradeLevel} curriculum`],
    materials: ["Whiteboard", "Student workbooks", "Manipulatives", "Digital device (optional)"],
    duration: "45 minutes",
    differentiationGroups: [
      {
        level: "approaching",
        modifications: "Provide visual aids, reduce problem count, offer choice boards",
      },
      {
        level: "on-grade",
        modifications: "Standard curriculum pacing with collaborative activities",
      },
      {
        level: "advanced",
        modifications: "Extension problems, peer tutoring opportunities, enrichment tasks",
      },
    ],
  };
}

function buildFallbackActivities(body: { subject: string }): unknown[] {
  return [
    {
      name: "Warm-Up",
      description: `Quick review of prior ${body.subject} concepts`,
      duration: "5 minutes",
      materials: ["Whiteboard"],
      differentiationTips: "Use visual prompts for struggling learners",
    },
    {
      name: "Direct Instruction",
      description: "Teacher-led introduction of new concept",
      duration: "10 minutes",
      materials: ["Presentation slides"],
      differentiationTips: "Check for understanding frequently",
    },
    {
      name: "Guided Practice",
      description: "Students work through examples with teacher support",
      duration: "15 minutes",
      materials: ["Student workbooks"],
      differentiationTips: "Provide sentence starters and manipulatives as needed",
    },
    {
      name: "Independent Practice",
      description: "Students apply concept independently",
      duration: "10 minutes",
      materials: ["Worksheet or digital activity"],
      differentiationTips: "Offer choice of difficulty level",
    },
    {
      name: "Closure",
      description: "Exit ticket and class discussion",
      duration: "5 minutes",
      materials: ["Exit ticket slips"],
      differentiationTips: "Allow verbal or drawn responses as alternatives",
    },
  ];
}

function buildFallbackAccommodations(body: { subject: string }): unknown[] {
  return [
    { type: "Visual", description: "Provide graphic organizers and visual schedules" },
    { type: "Auditory", description: "Allow text-to-speech tools and verbal responses" },
    {
      type: "Motor",
      description: "Offer large-format materials and digital alternatives to handwriting",
    },
    { type: "Processing", description: "Extended time, reduced workload, chunked instructions" },
    {
      type: "Behavioral",
      description: "Frequent breaks, positive reinforcement, clear expectations posted",
    },
  ];
}

function buildFallbackAssessments(body: { subject: string }): unknown[] {
  return [
    {
      name: "Exit Ticket",
      description: `3 quick questions assessing today's ${body.subject} concept`,
      criteria: "2 out of 3 correct indicates mastery",
    },
    {
      name: "Observation Checklist",
      description: "Teacher observes student engagement and participation",
      criteria: "Active participation in guided practice",
    },
    {
      name: "Think-Pair-Share",
      description: "Students discuss concepts with a partner",
      criteria: "Ability to explain concept in own words",
    },
  ];
}
