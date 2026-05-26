import { FastifyInstance } from "fastify";
import {
  parentAssessments,
  teacherAssessments,
  learners,
  assessmentAttempts,
  iepProfiles,
  iepGoals,
  learnerProfiles,
  learnerInterestSignals,
  learnerCaregivers,
  learnerTeachers,
  learnerTherapists,
} from "@aivo/db";
import { verifyJWT } from "@aivo/security";
import { eq, desc, and } from "drizzle-orm";
import {
  scoreInterests,
  type LearnerInterestProfile,
  type LearnerInterestSignal,
} from "@aivo/special-interest-engine";
import { deriveLearningProfile } from "../services/learning-profile.js";
import { partitionChapterActivitiesPayload } from "../services/discovery-activity-validator.js";
import { normalizeBaselineItems } from "../services/baselineSurfaceNormalizer.js";
import {
  buildBaselineFallback,
  type BaselineFallbackReason,
} from "../services/baseline-fallback.js";
import {
  applySafetyGate,
  persistAudits,
} from "../services/baseline-safety-gate.js";

// ---- Sprint 02 adapter: problem-session ledger ----------------------------
// Flag-gated, fire-and-forget. Records a baseline-source problem session per
// completed discovery attempt. Errors are swallowed so the ledger cannot
// disrupt the baseline flow.
const PROBLEM_SESSION_SVC_URL = process.env.PROBLEM_SESSION_SVC_URL ?? "http://localhost:3061";

function problemSessionLedgerEnabled(): boolean {
  const raw = process.env.AIVO_FEATURE_PROBLEM_SESSION_LEDGER;
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function recordBaselineProblemSession(input: {
  tenantId: string;
  learnerId: string;
  attemptId: string;
  domain?: string;
}): Promise<void> {
  if (!problemSessionLedgerEnabled()) return;
  try {
    await fetch(`${PROBLEM_SESSION_SVC_URL}/api/problem-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: input.tenantId,
        learnerId: input.learnerId,
        subject: input.domain ?? "baseline",
        source: "baseline",
        sourceSessionId: input.attemptId,
        metadata: { sourceService: "assessment-svc" },
      }),
    });
  } catch {
    // Swallow — ledger failures must never break the baseline flow.
  }
}

async function verifyConnectedAccess(
  db: any,
  userId: string,
  learnerDbId: string,
  role: "CAREGIVER" | "TEACHER" | "THERAPIST",
): Promise<boolean> {
  try {
    if (role === "CAREGIVER") {
      const [row] = await db
        .select()
        .from(learnerCaregivers)
        .where(
          and(
            eq(learnerCaregivers.learnerId, learnerDbId),
            eq(learnerCaregivers.caregiverUserId, userId),
            eq(learnerCaregivers.status, "ACCEPTED"),
          ),
        )
        .limit(1);
      return !!row;
    }
    if (role === "TEACHER") {
      const [row] = await db
        .select()
        .from(learnerTeachers)
        .where(
          and(
            eq(learnerTeachers.learnerId, learnerDbId),
            eq(learnerTeachers.teacherUserId, userId),
            eq(learnerTeachers.status, "ACCEPTED"),
          ),
        )
        .limit(1);
      return !!row;
    }
    if (role === "THERAPIST") {
      const [row] = await db
        .select()
        .from(learnerTherapists)
        .where(
          and(
            eq(learnerTherapists.learnerId, learnerDbId),
            eq(learnerTherapists.therapistUserId, userId),
            eq(learnerTherapists.status, "ACCEPTED"),
          ),
        )
        .limit(1);
      return !!row;
    }
  } catch {
    return false;
  }
  return false;
}

async function loadIepContext(db: any, learnerDbId: string) {
  const [profile] = await db
    .select()
    .from(iepProfiles)
    .where(eq(iepProfiles.learnerId, learnerDbId))
    .orderBy(desc(iepProfiles.updatedAt))
    .limit(1);

  if (!profile) return null;

  const goals = await db
    .select()
    .from(iepGoals)
    .where(eq(iepGoals.learnerId, learnerDbId))
    .orderBy(desc(iepGoals.updatedAt))
    .limit(20);

  return {
    disabilityCategories: profile.disabilityCategories || [],
    accommodations: profile.accommodations || [],
    goals:
      profile.goals && Array.isArray(profile.goals) && profile.goals.length > 0
        ? profile.goals
        : goals.map((g: any) => ({
            domain: g.domain,
            description: g.goalText,
            baseline: g.baseline,
            target: g.targetCriteria,
          })),
    gradeLevel: profile.gradeLevel,
    communicationSystem: profile.communicationSystem,
    assistiveTechnology: profile.assistiveTechnology || [],
    recommendedFunctioningLevel: profile.recommendedFunctioningLevel,
  };
}

function buildDistrictContext(learner: any) {
  if (!learner.districtId && !learner.districtName && !learner.curriculumFramework) {
    return null;
  }
  return {
    districtId: learner.districtId || null,
    districtName: learner.districtName || null,
    region: learner.region || null,
    country: learner.country || "US",
    gradeLevel: learner.gradeLevel || null,
    curriculumFramework: learner.curriculumFramework || null,
    curriculumAlignment: learner.curriculumAlignment || {},
  };
}

/**
 * Sprint 1 — surface the learner's enrollment ZIP code so ai-svc can
 * call curriculum-svc and ground the baseline prompt in district-
 * approved skill anchors. Returns null when no ZIP is on file; ai-svc
 * degrades gracefully and the existing district-framework label still
 * carries broad curriculum signal.
 */
function buildZipCode(learner: any): string | null {
  const raw = learner?.zipCode;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length >= 5 ? trimmed : null;
}

async function authenticate(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return reply.status(401).send({ error: "Unauthorized" });
  try {
    req.user = await verifyJWT(auth.slice(7));
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`assessment-svc: ${name} must be set in production`);
  return devDefault;
}
const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3004");
const BRAIN_SVC_URL = requireUrl("BRAIN_SVC_URL", "http://localhost:3002");

function buildParentAssessmentPayload(parentAssessment: any, learner: any) {
  return {
    communicationMode: parentAssessment.communicationMode,
    deviceInteraction: parentAssessment.deviceInteraction,
    responseMethod: parentAssessment.responseMethod,
    attentionSpan: parentAssessment.attentionSpan,
    diagnoses: parentAssessment.diagnoses,
    responses: parentAssessment.responses,
    functioningLevel: learner.functioningLevel || "STANDARD",
  };
}

/**
 * Load EVERY completed caregiver assessment for the learner, deduped
 * to one row per submitter (most recent wins). The baseline LLM prompt
 * needs to see ALL caregiver perspectives — parent + co-parent —
 * because their answers may differ (one says verbal, one says
 * minimally verbal) and that disagreement is signal, not noise.
 *
 * Co-parent input is OPTIONAL: when only one row exists, the prompt
 * builder simply renders one perspective and skips the disagreement
 * scaffolding. When zero exist (legacy), returns an empty array.
 */
async function loadCaregiverPerspectives(db: any, learnerDbId: string) {
  const rows = await db
    .select()
    .from(parentAssessments)
    .where(eq(parentAssessments.learnerId, learnerDbId))
    .orderBy(desc(parentAssessments.createdAt));

  const completed = rows.filter((r: any) => !!r.completedAt);
  if (completed.length === 0) return [];

  // One row per submitter (most recent). Rows without `submittedBy`
  // are legacy and treated as a single "anonymous" caregiver bucket
  // so we don't accidentally collapse two anonymous rows from the
  // same caregiver-pre-attribution era into separate perspectives.
  const seen = new Set<string>();
  const perspectives: any[] = [];
  for (const r of completed) {
    const key = r.submittedBy || "__legacy__";
    if (seen.has(key)) continue;
    seen.add(key);
    perspectives.push({
      submittedBy: r.submittedBy || null,
      submittedAt: r.completedAt instanceof Date ? r.completedAt.toISOString() : r.completedAt,
      communicationMode: r.communicationMode,
      deviceInteraction: r.deviceInteraction,
      responseMethod: r.responseMethod,
      attentionSpan: r.attentionSpan,
      diagnoses: r.diagnoses || [],
      responses: r.responses || {},
    });
  }
  return perspectives;
}

/**
 * Load the most recent completed teacher assessment for the learner,
 * if any. Teacher input is OPTIONAL — returns null when no row exists
 * and the prompt builder degrades gracefully.
 */
async function loadTeacherContext(db: any, learnerDbId: string) {
  const [row] = await db
    .select()
    .from(teacherAssessments)
    .where(eq(teacherAssessments.learnerId, learnerDbId))
    .orderBy(desc(teacherAssessments.createdAt))
    .limit(1);

  if (!row?.completedAt) return null;

  return {
    teacherRole: row.teacherRole || null,
    gradeLevel: row.gradeLevel || null,
    subjectArea: row.subjectArea || null,
    strengths: row.strengths || [],
    challenges: row.challenges || [],
    accommodations: row.accommodations || [],
    observations: row.observations || null,
    recommendedFocusAreas: row.recommendedFocusAreas || [],
    responses: row.responses || {},
    submittedAt: row.completedAt instanceof Date ? row.completedAt.toISOString() : row.completedAt,
  };
}

/**
 * Load the learner's top special interests (slug + score) and the raw
 * signal stream so the ai-svc prompt can build math word problems
 * about Minecraft, reading passages about volcanoes, etc. Failure to
 * load is non-fatal — the pipeline degrades to "general themes".
 */
async function loadInterestProfile(db: any, learnerId: string) {
  try {
    const rows = await db
      .select()
      .from(learnerInterestSignals)
      .where(eq(learnerInterestSignals.learnerId, learnerId))
      .orderBy(desc(learnerInterestSignals.observedAt))
      .limit(200);
    if (!rows || rows.length === 0) return null;
    const signals: LearnerInterestSignal[] = rows.map((r: any) => ({
      slug: r.slug,
      source: r.source,
      polarity: r.polarity as 1 | 0 | -1,
      confidence: r.confidence,
      observedAt: (r.observedAt instanceof Date
        ? r.observedAt.toISOString()
        : r.observedAt) as string,
    }));
    const profile: LearnerInterestProfile = { learnerId, signals };
    const scored = scoreInterests(profile).slice(0, 5);
    if (scored.length === 0) return null;
    return {
      topInterests: scored.map((s) => ({ slug: s.slug, score: s.score })),
      // Hand the prompt a comma-separated string it can drop straight
      // into the system prompt; the existing prompt already reads an
      // `interests` list, so we keep the contract minimal.
      interestSlugs: scored.map((s) => s.slug),
    };
  } catch {
    return null;
  }
}

export async function registerLearnerBaselineRoutes(app: FastifyInstance) {
  app.get(
    "/api/assessments/learner/discovery/:learnerId/status",
    {
      schema: {
        tags: ["Discovery Adventure"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };

      let [learner] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
      if (!learner) {
        [learner] = await db.select().from(learners).where(eq(learners.userId, learnerId)).limit(1);
      }
      // No learner row matches this id (stale session, deleted learner, or
      // parent dashboard iterating with a tenant-id by mistake). Return a
      // shaped "empty" status with 200 so the dashboard's status-badge UI
      // renders cleanly instead of spamming the console with 404s.
      if (!learner) {
        return reply.send({
          learnerId: null,
          baselineCompleted: false,
          parentAssessmentCompleted: false,
          assessmentId: null,
          approvalStatus: null,
        });
      }

      if (user.role === "LEARNER" && user.sub !== learner.userId) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (user.role === "PARENT" && learner.parentId !== user.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const [attempt] = await db
        .select()
        .from(assessmentAttempts)
        .where(eq(assessmentAttempts.learnerId, learner.id))
        .orderBy(desc(assessmentAttempts.createdAt))
        .limit(1);

      const completed = attempt?.status === "COMPLETED" && attempt?.type === "discovery_adventure";

      const [parentAss] = await db
        .select()
        .from(parentAssessments)
        .where(eq(parentAssessments.learnerId, learner.id))
        .orderBy(desc(parentAssessments.createdAt))
        .limit(1);

      let approvalStatus: string | null = null;
      try {
        const brainRes = await fetch(`${BRAIN_SVC_URL}/api/brain/${learner.id}`, {
          headers: { Authorization: req.headers.authorization as string },
        });
        if (brainRes.ok) {
          const brainData = (await brainRes.json()) as { approval_status?: string };
          approvalStatus = brainData.approval_status || null;
        }
      } catch {}

      return reply.send({
        learnerId: learner.id,
        baselineCompleted: completed,
        parentAssessmentCompleted: !!parentAss?.completedAt,
        assessmentId: attempt?.id || null,
        approvalStatus,
      });
    },
  );

  app.post(
    "/api/assessments/learner/discovery/:learnerId/chapter",
    {
      schema: {
        tags: ["Discovery Adventure"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["chapter"],
          properties: {
            chapter: { type: "object" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };
      const { chapter } = req.body as { chapter: any };

      let [learner] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
      if (!learner) {
        [learner] = await db.select().from(learners).where(eq(learners.userId, learnerId)).limit(1);
      }
      if (!learner) return reply.status(404).send({ error: "Learner not found" });

      app.log.info(
        {
          learnerId,
          learnerDbId: learner.id,
          userSub: user?.sub,
          userRole: user?.role,
          learnerUserId: learner.userId,
          learnerParentId: learner.parentId,
        },
        "[discovery/chapter] received",
      );

      if (user.role === "LEARNER" && user.sub !== learner.userId) {
        app.log.warn(
          { learnerId, userSub: user.sub, learnerUserId: learner.userId },
          "[discovery/chapter] LEARNER access denied",
        );
        return reply.status(403).send({ error: "Access denied" });
      }
      if (user.role === "PARENT" && learner.parentId !== user.sub) {
        app.log.warn(
          { learnerId, userSub: user.sub, learnerParentId: learner.parentId },
          "[discovery/chapter] PARENT access denied",
        );
        return reply.status(403).send({ error: "Access denied" });
      }
      if (user.role === "CAREGIVER" || user.role === "TEACHER" || user.role === "THERAPIST") {
        const ok = await verifyConnectedAccess(db, user.sub, learner.id, user.role);
        if (!ok) {
          app.log.warn(
            { learnerId, userSub: user.sub, role: user.role },
            "[discovery/chapter] connected access denied",
          );
          return reply.status(403).send({ error: "Access denied" });
        }
      }

      const [parentAssessment] = await db
        .select()
        .from(parentAssessments)
        .where(eq(parentAssessments.learnerId, learner.id))
        .orderBy(desc(parentAssessments.createdAt))
        .limit(1);

      if (!parentAssessment?.completedAt) {
        app.log.warn(
          {
            learnerId,
            hasParentRow: !!parentAssessment,
            completedAt: parentAssessment?.completedAt,
          },
          "[discovery/chapter] parent assessment not completed",
        );
        return reply.status(403).send({
          error: "parent_assessment_required",
          message: "Parent assessment must be completed before baseline assessment can begin",
        });
      }

      const parentPayload = buildParentAssessmentPayload(parentAssessment, learner);
      const iepContext = await loadIepContext(db, learner.id);
      const districtContext = buildDistrictContext(learner);
      const interestProfile = await loadInterestProfile(db, learner.id);
      const caregiverPerspectives = await loadCaregiverPerspectives(db, learner.id);
      const teacherContext = await loadTeacherContext(db, learner.id);

      try {
        const aiRes = await fetch(`${AI_SVC_URL}/api/ai/generate-discovery-chapter`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent_assessment: parentPayload,
            chapter,
            functioning_level: learner.functioningLevel || "STANDARD",
            iep: iepContext,
            district: districtContext,
            interest_profile: interestProfile,
            // Optional inputs — null/empty array when not on file.
            caregiver_perspectives: caregiverPerspectives,
            teacher_assessment: teacherContext,
            // Sprint 1 — curriculum grounding via ai-svc → curriculum-svc.
            zip_code: buildZipCode(learner),
          }),
        });

        if (!aiRes.ok) {
          const err = await aiRes.text();
          return reply.status(502).send({ error: "AI generation failed", detail: err });
        }

        const data = (await aiRes.json()) as any;
        const { activities, rejectedActivities, totalValid } = partitionChapterActivitiesPayload(
          data.activities,
        );

        if (totalValid === 0) {
          app.log.warn(
            {
              learnerId,
              chapterId: data.chapter_id,
              rejectedCount: rejectedActivities.length,
            },
            "[discovery/chapter] all generated activities rejected",
          );
          return reply.status(502).send({
            error: "ai_generated_invalid_activities",
            rejectedActivities,
          });
        }

        const personalizationLevel = rejectedActivities.length === 0 ? "full" : "partial";

        // Sprint 03 — surface-aware normalization. Coerces every activity into
        // an explicit LearnerSurfaceSpec so the renderer can pick the right
        // workspace (multiple_choice, scratchpad, geometry_workspace, ...).
        // Items with unknown / unsupported surfaces are dropped here and
        // logged so we can tune the prompt; the rest pass through unchanged.
        const surfaceNormalization = normalizeBaselineItems(
          Array.isArray(activities) ? (activities as unknown[]) : [],
        );
        const surfaceIssues = surfaceNormalization.issues;
        const surfaceErrors = surfaceIssues.filter((i) => i.severity === "error");
        const surfaceWarnings = surfaceIssues.filter((i) => i.severity === "warning");
        if (surfaceErrors.length > 0 || surfaceWarnings.length > 0) {
          app.log.info(
            {
              learnerId,
              chapterId: data.chapter_id,
              errorCount: surfaceErrors.length,
              warningCount: surfaceWarnings.length,
              sample: surfaceIssues.slice(0, 5),
            },
            "[discovery/chapter] baseline surface normalization issues",
          );
        }
        const normalizedActivities = surfaceNormalization.items;

        return reply.send({
          generated: true,
          learnerId,
          functioningLevel: learner.functioningLevel,
          chapterId: data.chapter_id,
          personalizationLevel,
          source: "ai",
          activities: normalizedActivities,
          rejectedActivities,
          surfaceIssues,
          model: data.model,
        });
      } catch (e: any) {
        return reply.status(502).send({ error: "Failed to reach AI service", detail: e.message });
      }
    },
  );

  app.post(
    "/api/assessments/learner/discovery/:learnerId/complete",
    {
      schema: {
        tags: ["Discovery Adventure"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
        body: {
          type: "object",
          required: ["chapterResults", "totalCorrect", "totalAttempts"],
          properties: {
            chapterResults: { type: "array" },
            totalCorrect: { type: "number" },
            totalAttempts: { type: "number" },
            xpEarned: { type: "number" },
            responseLatencies: { type: "array" },
          },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };
      const body = req.body as any;

      try {
        app.log.info(
          {
            learnerId,
            userSub: user?.sub,
            userRole: user?.role,
            totalCorrect: body?.totalCorrect,
            totalAttempts: body?.totalAttempts,
            chapterCount: (body?.chapterResults || []).length,
          },
          "[discovery/complete] received",
        );

        let [learner] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
        if (!learner) {
          [learner] = await db
            .select()
            .from(learners)
            .where(eq(learners.userId, learnerId))
            .limit(1);
        }
        if (!learner) {
          app.log.warn({ learnerId }, "[discovery/complete] learner not found");
          return reply.status(404).send({ error: "Learner not found" });
        }

        if (user.role === "LEARNER" && user.sub !== learner.userId) {
          app.log.warn(
            { learnerId, userSub: user.sub, learnerUserId: learner.userId },
            "[discovery/complete] LEARNER access denied",
          );
          return reply.status(403).send({ error: "Access denied" });
        }
        if (user.role === "PARENT" && learner.parentId !== user.sub) {
          app.log.warn(
            { learnerId, userSub: user.sub, learnerParentId: learner.parentId },
            "[discovery/complete] PARENT access denied",
          );
          return reply.status(403).send({ error: "Access denied" });
        }

        const [parentCheck] = await db
          .select()
          .from(parentAssessments)
          .where(eq(parentAssessments.learnerId, learner.id))
          .orderBy(desc(parentAssessments.createdAt))
          .limit(1);

        if (!parentCheck?.completedAt) {
          app.log.warn(
            { learnerId, hasParentRow: !!parentCheck },
            "[discovery/complete] parent assessment not completed",
          );
          return reply.status(403).send({
            error: "parent_assessment_required",
            message:
              "Parent assessment must be completed before baseline assessment can be completed",
          });
        }

        const [attempt] = await db
          .insert(assessmentAttempts)
          .values({
            tenantId: learner.tenantId,
            learnerId: learner.id,
            type: "discovery_adventure",
            mode: "STANDARD",
            status: "COMPLETED",
            startedAt: new Date(),
            completedAt: new Date(),
            domainScores: Object.fromEntries(
              (body.chapterResults || []).map((ch: any) => [
                ch.domain,
                {
                  correct: ch.correct,
                  total: ch.total,
                  difficulty: ch.difficulty,
                  avgLatencyMs: ch.avgLatencyMs,
                },
              ]),
            ),
            metadata: {
              totalCorrect: body.totalCorrect,
              totalAttempts: body.totalAttempts,
              xpEarned: body.xpEarned || 0,
              chapterResults: body.chapterResults,
              // Process-aware signals captured by surface-driven activities
              // (geometry, scratchpad, math expression, etc.). Stored as
              // metadata so we don't require a destructive schema change.
              surfaceSignals: Array.isArray(body.surfaceSignals) ? body.surfaceSignals : [],
            },
          })
          .returning();

        app.log.info({ learnerId, attemptId: attempt.id }, "[discovery/complete] attempt inserted");

        // Sprint 02: fire-and-forget problem-session ledger record (flag-gated).
        void recordBaselineProblemSession({
          tenantId: learner.tenantId,
          learnerId: learner.id,
          attemptId: attempt.id,
          domain: (body.chapterResults?.[0]?.domain as string | undefined) ?? undefined,
        });

        // ----------------------------------------------------------------
        // Derive + persist a LearningProfile artifact. The grade-level
        // placement (theta) is one output; the profile (modality fit,
        // processing speed, frustration tolerance, attention pattern) is
        // the more valuable one and is what the tutor-runtime + parent
        // dashboard will consume going forward.
        // ----------------------------------------------------------------
        let learningProfile: ReturnType<typeof deriveLearningProfile> | null = null;
        try {
          learningProfile = deriveLearningProfile(
            body.chapterResults || [],
            body.responseLatencies || [],
            Array.isArray(body.surfaceSignals) ? body.surfaceSignals : [],
          );
          await db
            .insert(learnerProfiles)
            .values({
              tenantId: learner.tenantId,
              learnerId: learner.id,
              attemptId: attempt.id,
              thetaPlacement: learningProfile.thetaPlacement,
              modalityFit: learningProfile.modalityFit,
              processingSpeedMs: learningProfile.processingSpeedMs,
              frustrationRate: learningProfile.frustrationRate,
              attentionRunLength: learningProfile.attentionRunLength,
              frustrationTolerance: learningProfile.frustrationTolerance,
              itemsAdministered: learningProfile.itemsAdministered,
              baselineCompletedAt: new Date(),
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: learnerProfiles.learnerId,
              set: {
                attemptId: attempt.id,
                thetaPlacement: learningProfile.thetaPlacement,
                modalityFit: learningProfile.modalityFit,
                processingSpeedMs: learningProfile.processingSpeedMs,
                frustrationRate: learningProfile.frustrationRate,
                attentionRunLength: learningProfile.attentionRunLength,
                frustrationTolerance: learningProfile.frustrationTolerance,
                itemsAdministered: learningProfile.itemsAdministered,
                baselineCompletedAt: new Date(),
                updatedAt: new Date(),
              },
            });
          app.log.info(
            { learnerId, attemptId: attempt.id, theta: learningProfile.thetaPlacement },
            "[discovery/complete] learner_profile upserted",
          );
        } catch (profileErr: any) {
          app.log.error(
            { learnerId, attemptId: attempt.id, err: profileErr?.message },
            "[discovery/complete] learner_profile upsert failed (non-fatal)",
          );
        }

        let brainCloneStatus: string = "pending";
        let brainCloneError: string | null = null;
        let brainStateId: string | null = null;
        try {
          const cloneRes = await fetch(`${BRAIN_SVC_URL}/api/brain/clone`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: req.headers.authorization as string,
            },
            body: JSON.stringify({
              learner_id: learner.id,
              tenant_id: learner.tenantId,
              assessment_id: attempt.id,
              functioning_level: learner.functioningLevel || "STANDARD",
              discovery_results: {
                chapterResults: body.chapterResults || [],
                totalCorrect: body.totalCorrect || 0,
                totalAttempts: body.totalAttempts || 0,
                xpEarned: body.xpEarned || 0,
                responseLatencies: body.responseLatencies || [],
              },
            }),
          });

          if (cloneRes.ok) {
            const cloneData = (await cloneRes.json()) as any;
            brainCloneStatus = cloneData?.approval_status || cloneData?.approvalStatus || "cloned";
            brainStateId = cloneData?.brain_state_id || cloneData?.id || null;
            app.log.info(
              { learnerId, attemptId: attempt.id, brainStateId, brainCloneStatus },
              "[discovery/complete] brain clone succeeded",
            );
          } else {
            brainCloneError = await cloneRes.text();
            brainCloneStatus = "failed";
            app.log.error(
              { learnerId, attemptId: attempt.id, status: cloneRes.status, brainCloneError },
              "[discovery/complete] brain clone failed",
            );
          }
        } catch (cloneErr: any) {
          brainCloneError = cloneErr?.message || String(cloneErr);
          brainCloneStatus = "failed";
          app.log.error(
            { learnerId, attemptId: attempt.id, err: brainCloneError },
            "[discovery/complete] brain clone request error",
          );
        }

        return reply.send({
          success: true,
          assessmentId: attempt.id,
          learnerId,
          functioningLevel: learner.functioningLevel,
          domainScores: attempt.domainScores,
          brainCloneStatus,
          brainStateId,
          brainCloneError,
          learningProfile,
        });
      } catch (err: any) {
        app.log.error(
          { err: err?.message, stack: err?.stack, learnerId },
          "[discovery/complete] FAILED",
        );
        return reply
          .status(500)
          .send({ error: "internal_error", detail: err?.message || String(err) });
      }
    },
  );

  app.get(
    "/api/assessments/learner/baseline/:learnerId",
    {
      schema: {
        tags: ["Learner Baseline"],
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["learnerId"],
          properties: { learnerId: { type: "string" } },
        },
      },
      preHandler: authenticate,
    },
    async (req, reply) => {
      const db = (app as any).db;
      const user = (req as any).user;
      const { learnerId } = req.params as { learnerId: string };

      let [learner] = await db.select().from(learners).where(eq(learners.id, learnerId)).limit(1);
      if (!learner) {
        [learner] = await db.select().from(learners).where(eq(learners.userId, learnerId)).limit(1);
      }
      if (!learner) return reply.status(404).send({ error: "Learner not found" });

      if (user.role === "LEARNER" && user.sub !== learner.userId) {
        return reply.status(403).send({ error: "Access denied" });
      }
      if (user.role === "PARENT" && learner.parentId !== user.sub) {
        return reply.status(403).send({ error: "Access denied" });
      }

      const [parentAssessment] = await db
        .select()
        .from(parentAssessments)
        .where(eq(parentAssessments.learnerId, learner.id))
        .orderBy(desc(parentAssessments.createdAt))
        .limit(1);

      if (!parentAssessment) {
        return reply.send({
          generated: false,
          message: "No parent assessment found. Using default questions.",
          questions: null,
          subjects: null,
        });
      }

      const iepContext = await loadIepContext(db, learner.id);
      const districtContext = buildDistrictContext(learner);
      const interestProfile = await loadInterestProfile(db, learner.id);
      const caregiverPerspectives = await loadCaregiverPerspectives(db, learner.id);
      const teacherContext = await loadTeacherContext(db, learner.id);

      // Sprint 3 — graceful AI-failure fallback. When ai-svc is
      // unreachable, returns a non-2xx, or returns invalid JSON, we
      // serve the curated baseline bank with source:"fallback" instead
      // of a 502. The UI surfaces a "Using curated questions while we
      // generate personalized ones" notice; ops can dashboard the
      // fallback rate via the structured log line below.
      const fallback = (reason: BaselineFallbackReason, detail?: string) => {
        const payload = buildBaselineFallback({
          learnerId: learner.id,
          gradeLevel: learner.gradeLevel || null,
          functioningLevel: learner.functioningLevel || null,
          reason,
        });
        app.log.warn(
          {
            learnerId: learner.id,
            reason,
            detail: detail ? detail.slice(0, 500) : undefined,
            questionsCount: payload.questions.length,
          },
          "[baseline] AI failed — serving fallback bank",
        );
        return reply.send(payload);
      };

      try {
        const aiRes = await fetch(`${AI_SVC_URL}/api/ai/generate-baseline`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parent_assessment: {
              communicationMode: parentAssessment.communicationMode,
              deviceInteraction: parentAssessment.deviceInteraction,
              responseMethod: parentAssessment.responseMethod,
              attentionSpan: parentAssessment.attentionSpan,
              diagnoses: parentAssessment.diagnoses,
              responses: parentAssessment.responses,
              functioningLevel: learner.functioningLevel || "STANDARD",
            },
            functioning_level: learner.functioningLevel || "STANDARD",
            iep: iepContext,
            district: districtContext,
            interest_profile: interestProfile,
            // Optional inputs — null/empty array when not on file.
            caregiver_perspectives: caregiverPerspectives,
            teacher_assessment: teacherContext,
            // Sprint 1 — curriculum grounding via ai-svc → curriculum-svc.
            zip_code: buildZipCode(learner),
          }),
        });

        if (!aiRes.ok) {
          const err = await aiRes.text();
          return fallback("ai_non_2xx", err);
        }

        let data: any;
        try {
          data = await aiRes.json();
        } catch (e: any) {
          return fallback("ai_invalid_json", e?.message);
        }
        if (!data || !Array.isArray(data.questions) || data.questions.length < 14) {
          return fallback(
            "ai_too_few_questions",
            `received ${Array.isArray(data?.questions) ? data.questions.length : 0} questions`,
          );
        }

        // Sprint 4 — responsible-AI gate. Evaluate every generated
        // question; replace blocked items with fallback bank items;
        // persist verdicts to baseline_item_audits. Fail-open: if the
        // evaluator is unreachable the AI items ship as-is.
        const gated = await applySafetyGate({
          learnerId: learner.id,
          questions: data.questions,
          gradeLevel: learner.gradeLevel || null,
          functioningLevel: learner.functioningLevel || null,
          accommodations: iepContext?.accommodations
            ?.map((a: any) => (typeof a === "string" ? a : a?.type || a?.description))
            .filter(Boolean) as string[] | undefined,
          policyMode: "block",
        });

        if (gated.hadReplacements) {
          app.log.warn(
            {
              learnerId: learner.id,
              blocked: gated.audits.filter((a) => a.shipped === "no").length,
              shipped: gated.questions.length,
            },
            "[baseline] responsible-AI replaced AI items with fallback bank",
          );
        }

        // Fire-and-forget audit write — must not block the response.
        void persistAudits({
          db,
          tenantId: learner.tenantId,
          learnerId: learner.id,
          audits: gated.audits,
          batchMetadata: { model: data.model, source: "ai" },
          log: app.log,
        });

        return reply.send({
          generated: true,
          learnerId: learner.id,
          functioningLevel: learner.functioningLevel,
          source: gated.hadReplacements ? "ai+fallback" : "ai",
          safetyEvaluated: !gated.evaluatorSilent,
          questions: gated.questions,
          subjects: data.subjects,
          model: data.model,
        });
      } catch (e: any) {
        return fallback("ai_unreachable", e?.message);
      }
    },
  );
}
