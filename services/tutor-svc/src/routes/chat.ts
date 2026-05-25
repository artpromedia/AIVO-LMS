import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { TUTORS } from "@aivo/brand";
import { tutorSessions, learners } from "@aivo/db";
import { createLogger, recordSubjectBrainCall } from "@aivo/observability";
import { resolveTenantIdForLearner } from "../lib/tenant.js";
import { checkTutorAccess } from "../lib/entitlements.js";
import { computeTutorXp, computeTutorQuality, type TutorSignals } from "../services/scoring.js";
import { emitTutorAudit } from "../lib/audit.js";
import { getActiveCurriculumFocus } from "./curriculum.js";
import { loadDapeProfile } from "../lib/dape.js";
import {
  sessionStartSchema,
  sessionBySessionIdMessageSchema,
  sessionBySessionIdCompleteSchema,
  getSessionsByLearnerIdSchema,
  getSessionBySessionIdSchema,
  sessionBySessionIdCoLearnSchema,
} from "./schemas.js";

const logger = createLogger("tutor-svc.chat");

/**
 * Tutor SKU → subject-brain-svc subject key.
 *
 * Sprint C correction: pre-Sprint-C the map sent half the tutors to
 * subjects that didn't exist in subject-brain-svc (`"history"`,
 * `"sel"`, `"art"`, `"other"`) — which caused `fetchSubjectBrain*`
 * to silently return undefined and the LLM to lose its grounding.
 * The keys below match the canonical `Subject` union in
 * `services/subject-brain-svc/src/services/types.ts`.
 */
const TUTOR_SKU_TO_SUBJECT: Record<string, string> = {
  ADDON_TUTOR_MATH: "math",
  ADDON_TUTOR_ELA: "ela",
  ADDON_TUTOR_SCIENCE: "science",
  ADDON_TUTOR_HISTORY: "social_studies",
  ADDON_TUTOR_CODING: "coding",
  ADDON_TUTOR_SPEECH: "speech",
  ADDON_TUTOR_SEL: "social_emotional",
  ADDON_TUTOR_SOCIAL_STUDIES: "social_studies",
  // ADDON_TUTOR_ARTS is `cadence` (music tutor). The visual / writing
  // creative-arts strand is `muse` → ADDON_TUTOR_CREATIVE_WRITING.
  ADDON_TUTOR_ARTS: "music",
  ADDON_TUTOR_PE_HEALTH: "pe_health",
  ADDON_TUTOR_LANGUAGES: "world_language",
  ADDON_TUTOR_STEM_DESIGN: "stem_engineering",
  ADDON_TUTOR_LIFE_SKILLS: "life_skills",
  ADDON_TUTOR_CREATIVE_WRITING: "creative_arts",
};

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`tutor-svc: ${name} must be set in production`);
  return devDefault;
}
const AI_SVC_URL = requireUrl("AI_SVC_URL", "http://localhost:3004");
const BRAIN_SVC_URL = requireUrl("BRAIN_SVC_URL", "http://localhost:3002");

// ---- Sprint 05 adapter: subject-brain context ---------------------------
const SUBJECT_BRAIN_SVC_URL = process.env.SUBJECT_BRAIN_SVC_URL ?? "http://localhost:3064";

function advancedContentGeneratorsEnabled(): boolean {
  const raw = process.env.AIVO_FEATURE_ADVANCED_CONTENT_GENERATORS;
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function fetchSubjectBrainContextForChat(input: {
  learnerId: string;
  subject: string;
  topic?: string;
  brainContext: Record<string, unknown>;
  functioningLevel?: string;
}): Promise<Record<string, unknown> | undefined> {
  if (!advancedContentGeneratorsEnabled()) return undefined;
  if (!input.subject) {
    recordSubjectBrainCall("unknown", "miss_no_subject", { learnerId: input.learnerId });
    return undefined;
  }
  try {
    const res = await fetch(`${SUBJECT_BRAIN_SVC_URL}/api/subject-brain/context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      recordSubjectBrainCall(input.subject, "miss_error", {
        learnerId: input.learnerId,
        reason: `http_${res.status}`,
      });
      return undefined;
    }
    const json = (await res.json()) as Record<string, unknown>;
    recordSubjectBrainCall(input.subject, "ok", { learnerId: input.learnerId });
    return json;
  } catch (err) {
    recordSubjectBrainCall(input.subject, "miss_error", {
      learnerId: input.learnerId,
      reason: err instanceof Error ? err.message : String(err),
    });
    return undefined;
  }
}

// ---- Sprint 10 adapter: responsible-AI evaluation in tutor chat ---------
const RESPONSIBLE_AI_SVC_URL = process.env.RESPONSIBLE_AI_SVC_URL ?? "http://localhost:3071";

function responsibleAiGuardrailsEnabled(): boolean {
  const raw = process.env.AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS;
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function evaluateResponsibleAiChat(input: {
  learnerId: string;
  inputSummary: string;
  output: unknown;
  functioningLevel?: string;
}): Promise<{ allowed: boolean; severity: string; recommendedAction: string } | undefined> {
  if (!responsibleAiGuardrailsEnabled()) return undefined;
  try {
    const res = await fetch(`${RESPONSIBLE_AI_SVC_URL}/api/responsible-ai/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        learnerId: input.learnerId,
        contextType: "chat",
        inputSummary: input.inputSummary,
        output: input.output,
        learnerProfileSummary: input.functioningLevel
          ? { functioningLevel: input.functioningLevel }
          : undefined,
        policyMode: "warn",
      }),
    });
    if (!res.ok) return undefined;
    return (await res.json()) as { allowed: boolean; severity: string; recommendedAction: string };
  } catch {
    return undefined;
  }
}

const TUTOR_SKU_TO_KEY: Record<string, string> = {
  ADDON_TUTOR_MATH: "nova",
  ADDON_TUTOR_ELA: "sage",
  ADDON_TUTOR_SCIENCE: "spark",
  ADDON_TUTOR_HISTORY: "chrono",
  ADDON_TUTOR_CODING: "pixel",
  ADDON_TUTOR_SPEECH: "echo",
  ADDON_TUTOR_SEL: "harmony",
  ADDON_TUTOR_SOCIAL_STUDIES: "atlas",
  ADDON_TUTOR_ARTS: "cadence",
  ADDON_TUTOR_PE_HEALTH: "vigor",
  ADDON_TUTOR_LANGUAGES: "lingua",
  ADDON_TUTOR_STEM_DESIGN: "forge",
  ADDON_TUTOR_LIFE_SKILLS: "compass",
  ADDON_TUTOR_CREATIVE_WRITING: "muse",
};

const TUTOR_NAME_MAP: Record<string, string> = {};
for (const [sku, key] of Object.entries(TUTOR_SKU_TO_KEY)) {
  const tutor = TUTORS[key as keyof typeof TUTORS];
  if (tutor) TUTOR_NAME_MAP[sku] = tutor.name;
}

async function fetchBrainContext(learnerId: string): Promise<Record<string, unknown>> {
  try {
    const res = await fetch(`${BRAIN_SVC_URL}/api/brain/${learnerId}`);
    if (res.ok) {
      const data = await res.json();
      return data.state || {};
    }
  } catch {}
  return {};
}

function computeMasteryDelta(
  before: Record<string, number>,
  after: Record<string, number>,
): number {
  const keys = Object.keys(after);
  if (keys.length === 0) return 0;
  let total = 0;
  for (const k of keys) {
    total += (Number(after[k]) || 0) - (Number(before[k]) || 0);
  }
  return total / keys.length;
}

export function registerChatRoutes(app: FastifyInstance, db: any) {
  // Resolve a possibly-ambiguous id (could be a learners.id OR a users.id
  // belonging to a LEARNER-role user, especially during admin
  // impersonation) into the canonical learners.id. Falls back to the
  // original value if no match found so existing 4xx error paths still
  // surface a sensible response.
  async function resolveLearnerId(rawId: string): Promise<string> {
    if (!rawId) return rawId;
    try {
      const byId = await db
        .select({ id: learners.id })
        .from(learners)
        .where(eq(learners.id, rawId))
        .limit(1);
      if (byId[0]?.id) return byId[0].id;
      const byUserId = await db
        .select({ id: learners.id })
        .from(learners)
        .where(eq(learners.userId, rawId))
        .limit(1);
      if (byUserId[0]?.id) return byUserId[0].id;
    } catch (err) {
      logger.error("resolveLearnerId failed (non-blocking)", { err: String(err) });
    }
    return rawId;
  }

  app.post("/api/tutor/session/start", { schema: sessionStartSchema }, async (request, reply) => {
    const { learnerId: rawLearnerId, tutorSku, sessionType } = request.body as any;
    if (!rawLearnerId || !tutorSku) {
      return reply.code(400).send({ error: "learnerId and tutorSku required" });
    }
    const learnerId = await resolveLearnerId(rawLearnerId);

    const tutorName = TUTOR_NAME_MAP[tutorSku] || "Tutor";
    const brainContext = await fetchBrainContext(learnerId);
    const functioningLevel = (brainContext as any).functioning_level_profile?.level || "STANDARD";

    const subject = TUTOR_SKU_TO_SUBJECT[tutorSku];
    if (subject) {
      try {
        const focus = await getActiveCurriculumFocus(db, learnerId, subject);
        if (focus) (brainContext as any).curriculum_focus = focus;
      } catch (err) {
        logger.error("Failed to load curriculum focus (non-blocking)", { err: String(err) });
      }
    }

    // Vigor (PE & Health) is the only tutor that branches on DAPE. Loading
    // the profile for every other tutor would be wasted DB work.
    if (TUTOR_SKU_TO_KEY[tutorSku] === "vigor") {
      try {
        const dapeProfile = await loadDapeProfile(db, learnerId);
        if (dapeProfile.active) (brainContext as any).dape_profile = dapeProfile;
      } catch (err) {
        logger.error("Failed to load DAPE profile (non-blocking)", { err: String(err) });
      }
    }

    const tenantId = await resolveTenantIdForLearner(request, db, learnerId);
    if (!tenantId) {
      return reply.code(400).send({ error: "Unable to resolve tenantId for learner" });
    }

    // Service-to-service callers (homework, co-learn, etc.) bypass the
    // entitlement gate; only learner/parent-initiated session starts are
    // checked. Service callers carry x-service-token and surface as
    // `role: "service"` from the auth hook.
    if ((request as any).auth?.role !== "service") {
      const access = await checkTutorAccess({ db, tenantId, tutorSku });
      if (!access.entitled) {
        return (reply as any).code(403).send({
          error: "Tutor not included in current subscription",
          requiredSku: access.requiredSku,
          upgradePath: access.upgradePath,
          reason: access.reason,
        });
      }
    }

    const [session] = await db
      .insert(tutorSessions)
      .values({
        tenantId,
        learnerId,
        tutorSku,
        tutorName,
        sessionType: sessionType || "standard",
        functioningLevel,
        brainContext,
        messages: [],
      })
      .returning();

    await emitTutorAudit({
      db,
      request,
      eventType: "TUTOR_SESSION_STARTED",
      tenantId,
      learnerId,
      sessionId: session.id,
      details: { tutorSku, tutorName, sessionType: sessionType || "standard", functioningLevel },
    });

    return { sessionId: session.id, tutorName, functioningLevel };
  });

  app.post(
    "/api/tutor/session/:sessionId/message",
    { schema: sessionBySessionIdMessageSchema },
    async (request, reply) => {
      const { sessionId } = request.params as any;
      const { message, locale } = request.body as any;
      if (!message) return reply.code(400).send({ error: "message required" });

      const [session] = await db
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.id, sessionId));
      if (!session) return reply.code(404).send({ error: "Session not found" });

      const existingMessages = (session.messages as any[]) || [];
      existingMessages.push({
        role: "user",
        content: message,
        timestamp: new Date().toISOString(),
      });

      const chatMessages = existingMessages.map((m: any) => ({ role: m.role, content: m.content }));

      const liveBrainContext: Record<string, unknown> = {
        ...((session.brainContext as any) || {}),
      };
      const liveSubject = TUTOR_SKU_TO_SUBJECT[session.tutorSku as string];
      if (liveSubject) {
        try {
          const focus = await getActiveCurriculumFocus(db, session.learnerId, liveSubject);
          if (focus) liveBrainContext.curriculum_focus = focus;
        } catch (err) {
          logger.error("Failed to refresh curriculum focus (non-blocking)", { err: String(err) });
        }
      }

      // Sprint 05: enrich brain context with subject-brain context when flag is on.
      if (liveSubject) {
        const subjectBrain = await fetchSubjectBrainContextForChat({
          learnerId: session.learnerId,
          subject: liveSubject,
          topic:
            typeof (liveBrainContext as { curriculum_focus?: { topic?: unknown } }).curriculum_focus
              ?.topic === "string"
              ? ((liveBrainContext as { curriculum_focus?: { topic?: string } }).curriculum_focus
                  ?.topic as string)
              : undefined,
          brainContext: liveBrainContext,
          functioningLevel: (session.functioningLevel as string | undefined) ?? "STANDARD",
        });
        if (subjectBrain) {
          liveBrainContext.subjectBrain = subjectBrain;
        }
      }

      try {
        const res = await fetch(`${AI_SVC_URL}/api/ai/tutor/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tutor_sku: session.tutorSku,
            learner_id: session.learnerId,
            functioning_level: session.functioningLevel || "STANDARD",
            brain_context: liveBrainContext,
            messages: chatMessages,
            locale: typeof locale === "string" && locale ? locale : undefined,
          }),
        });

        if (!res.ok) {
          throw new Error(`ai-svc returned ${res.status}`);
        }

        const data = await res.json();

        // Sprint 10: responsible-AI evaluation in warn mode.
        const raiResult = await evaluateResponsibleAiChat({
          learnerId: session.learnerId,
          inputSummary: message,
          output: data.response,
          functioningLevel: (session.functioningLevel as string | undefined) ?? "STANDARD",
        });
        if (raiResult && !raiResult.allowed) {
          logger.warn("responsible-AI flagged tutor chat", {
            sessionId,
            severity: raiResult.severity,
          });
        }

        existingMessages.push({
          role: "assistant",
          content: data.response,
          timestamp: new Date().toISOString(),
        });

        await db
          .update(tutorSessions)
          .set({
            messages: existingMessages,
          })
          .where(eq(tutorSessions.id, sessionId));

        return {
          response: data.response,
          model: data.model,
          messageCount: existingMessages.length,
        };
      } catch (err: any) {
        return reply.code(503).send({ error: "Tutor chat failed", detail: err.message });
      }
    },
  );

  app.post(
    "/api/tutor/session/:sessionId/complete",
    { schema: sessionBySessionIdCompleteSchema },
    async (request, reply) => {
      const { sessionId } = request.params as any;
      const body = (request.body as any) || {};
      const { masteryUpdates, xpEarned } = body;

      const [session] = await db
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.id, sessionId));
      if (!session) return reply.code(404).send({ error: "Session not found" });

      const messages = (session.messages as any[]) || [];
      const durationSeconds = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

      const masteryBefore = ((session.brainContext as any)?.mastery_levels || {}) as Record<
        string,
        number
      >;
      const masteryDelta = computeMasteryDelta(masteryBefore, masteryUpdates || {});

      const signals: TutorSignals = {
        durationSeconds,
        functioningLevel: session.functioningLevel || "STANDARD",
        messageCount: messages.length,
        beatsCompleted: body.beatsCompleted,
        beatsTotal: body.beatsTotal,
        correctAnswers: body.correctAnswers,
        attemptedAnswers: body.attemptedAnswers,
        engagementBeats: body.engagementBeats,
        breaksUsed: body.breaksUsed,
        masteryDelta,
      };
      const computedXp = computeTutorXp(signals);
      const completionQuality = computeTutorQuality(signals);
      const finalXp = typeof xpEarned === "number" ? xpEarned : computedXp;

      await db
        .update(tutorSessions)
        .set({
          masteryUpdates: masteryUpdates || {},
          xpEarned: finalXp,
          durationSeconds,
          completedAt: new Date(),
          completionQuality,
        })
        .where(eq(tutorSessions.id, sessionId));

      return {
        status: "completed",
        sessionId,
        durationSeconds,
        xpEarned: finalXp,
        completionQuality,
      };
    },
  );

  app.get(
    "/api/tutor/sessions/:learnerId",
    { schema: getSessionsByLearnerIdSchema },
    async (request) => {
      const { learnerId } = request.params as any;
      const sessions = await db
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.learnerId, learnerId))
        .orderBy(desc(tutorSessions.startedAt))
        .limit(20);
      return sessions;
    },
  );

  app.get(
    "/api/tutor/session/:sessionId",
    { schema: getSessionBySessionIdSchema },
    async (request, reply) => {
      const { sessionId } = request.params as any;
      const [session] = await db
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.id, sessionId));
      if (!session) return reply.code(404).send({ error: "Session not found" });
      return session;
    },
  );

  app.post(
    "/api/tutor/session/:sessionId/co-learn",
    { schema: sessionBySessionIdCoLearnSchema },
    async (request, reply) => {
      const { sessionId } = request.params as any;
      const { parentId } = request.body as any;
      if (!parentId) return reply.code(400).send({ error: "parentId required" });

      const [session] = await db
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.id, sessionId));
      if (!session) return reply.code(404).send({ error: "Session not found" });

      await db
        .update(tutorSessions)
        .set({
          sessionType: "co-learning",
          brainContext: {
            ...((session.brainContext as any) || {}),
            coLearning: {
              parentId,
              joinedAt: new Date().toISOString(),
              active: true,
            },
          },
        })
        .where(eq(tutorSessions.id, sessionId));

      return {
        status: "co-learning_activated",
        sessionId,
        parentId,
        message:
          "Parent has joined the session. The tutor will now provide real-time parent coaching alongside learner instruction.",
      };
    },
  );
}
