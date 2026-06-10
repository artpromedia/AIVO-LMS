import { FastifyInstance } from "fastify";
import { eq, and, desc } from "drizzle-orm";
import { lessonSessions, lessonContent, gradebookEntries, learningPaths, learners } from "@aivo/db";
import { emitLessonAudit } from "../lib/audit.js";
import {
  generateLessonContent,
  getSubjectForTutor,
  fetchPersonalizedTopics,
} from "../services/content-generator.js";
import {
  computeLessonXp,
  computeCompletionQuality,
  type LessonSignals,
} from "../services/scoring.js";
import { resolveGradeTargets } from "../services/grade-target.js";
import { resolveTenantId, requireLearnerAccess } from "../lib/tenant.js";
import { checkLearnerTutorAccess } from "../lib/entitlements.js";
import { getRealtimeBus, subjects as busSubjects } from "../realtime/bus.js";
import {
  DegradationTracker,
  buildDegradedResponse,
  failOpen,
  reportDownstreamFailure,
  type DowntreamCallContext,
} from "../lib/downstream.js";
import {
  createSessionSchema,
  completeSessionSchema,
  updateGradebookSchema,
  listSessionsSchema,
  getSessionByIdSchema,
  getGradebookSchema,
  getLearningPathSchema,
  initLearningPathSchema,
  refreshLearningPathTopicsSchema,
  advanceLearningPathSchema,
} from "./schemas.js";

const IS_PROD = process.env.NODE_ENV === "production";
function requireUrl(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) throw new Error(`learning-svc: ${name} must be set in production`);
  return devDefault;
}
const BRAIN_SVC_URL = requireUrl("BRAIN_SVC_URL", "http://localhost:3002");

async function fetchBrainContext(
  learnerId: string,
  ctx: DowntreamCallContext = {},
): Promise<Record<string, unknown>> {
  const endpoint = "GET /api/brain/:learnerId";
  try {
    const res = await fetch(`${BRAIN_SVC_URL}/api/brain/${learnerId}`);
    if (res.ok) {
      const data = await res.json();
      return data.state || {};
    }
    reportDownstreamFailure({
      service: "brain-svc",
      endpoint,
      statusCode: res.status,
      correlationId: ctx.correlationId,
      learnerId: ctx.learnerId ?? learnerId,
      tracker: ctx.tracker,
    });
  } catch (err) {
    reportDownstreamFailure({
      service: "brain-svc",
      endpoint,
      correlationId: ctx.correlationId,
      learnerId: ctx.learnerId ?? learnerId,
      err,
      tracker: ctx.tracker,
    });
  }
  return {};
}

// ---- Sprint 02 adapter: problem-session ledger -------------------------
// When `AIVO_FEATURE_PROBLEM_SESSION_LEDGER` is on, fire-and-forget create
// a problem session for each generated lesson session. Errors are
// swallowed: the ledger is evidence, not the source of truth.
const PROBLEM_SESSION_SVC_URL = process.env.PROBLEM_SESSION_SVC_URL ?? "http://localhost:3061";

// ---- Sprint 05 adapter: subject-brain context --------------------------
const SUBJECT_BRAIN_SVC_URL = process.env.SUBJECT_BRAIN_SVC_URL ?? "http://localhost:3064";

function advancedContentGeneratorsEnabled(): boolean {
  const raw = process.env.AIVO_FEATURE_ADVANCED_CONTENT_GENERATORS;
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function fetchSubjectBrainContext(
  input: {
    learnerId: string;
    subject: string;
    topic?: string;
    brainContext: Record<string, unknown>;
  },
  ctx: DowntreamCallContext = {},
): Promise<Record<string, unknown> | undefined> {
  if (!advancedContentGeneratorsEnabled()) return undefined;
  const endpoint = "POST /api/subject-brain/context";
  try {
    const res = await fetch(`${SUBJECT_BRAIN_SVC_URL}/api/subject-brain/context`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (res.ok) {
      return (await res.json()) as Record<string, unknown>;
    }
    reportDownstreamFailure({
      service: "subject-brain-svc",
      endpoint,
      statusCode: res.status,
      correlationId: ctx.correlationId,
      learnerId: ctx.learnerId ?? input.learnerId,
      tracker: ctx.tracker,
    });
  } catch (err) {
    reportDownstreamFailure({
      service: "subject-brain-svc",
      endpoint,
      correlationId: ctx.correlationId,
      learnerId: ctx.learnerId ?? input.learnerId,
      err,
      tracker: ctx.tracker,
    });
  }
  return undefined;
}

// ---- Sprint 10 adapter: responsible-AI evaluation ----------------------
const RESPONSIBLE_AI_SVC_URL = process.env.RESPONSIBLE_AI_SVC_URL ?? "http://localhost:3071";

function responsibleAiGuardrailsEnabled(): boolean {
  const raw = process.env.AIVO_FEATURE_RESPONSIBLE_AI_GUARDRAILS;
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function evaluateResponsibleAi(
  input: {
    learnerId: string;
    contextType: "lesson" | "homework" | "chat" | "baseline" | "recommendation";
    inputSummary: string;
    output: unknown;
    requiredSurfaces?: string[];
    learnerProfileSummary?: Record<string, unknown>;
  },
  ctx: DowntreamCallContext = {},
): Promise<{ allowed: boolean; severity: string; recommendedAction: string } | undefined> {
  if (!responsibleAiGuardrailsEnabled()) return undefined;
  const endpoint = "POST /api/responsible-ai/evaluate";
  try {
    const res = await fetch(`${RESPONSIBLE_AI_SVC_URL}/api/responsible-ai/evaluate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...input, policyMode: "warn" }),
    });
    if (res.ok) {
      return (await res.json()) as {
        allowed: boolean;
        severity: string;
        recommendedAction: string;
      };
    }
    reportDownstreamFailure({
      service: "responsible-ai-svc",
      endpoint,
      statusCode: res.status,
      correlationId: ctx.correlationId,
      learnerId: ctx.learnerId ?? input.learnerId,
      tracker: ctx.tracker,
    });
  } catch (err) {
    reportDownstreamFailure({
      service: "responsible-ai-svc",
      endpoint,
      correlationId: ctx.correlationId,
      learnerId: ctx.learnerId ?? input.learnerId,
      err,
      tracker: ctx.tracker,
    });
  }
  return undefined;
}

function problemSessionLedgerEnabled(): boolean {
  const raw = process.env.AIVO_FEATURE_PROBLEM_SESSION_LEDGER;
  if (!raw) return false;
  const v = String(raw).trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

async function recordProblemSessionForLesson(
  input: {
    tenantId: string;
    learnerId: string;
    subject: string;
    sourceSessionId: string;
    tutorSku?: string;
    topic?: string;
  },
  ctx: DowntreamCallContext = {},
): Promise<void> {
  if (!problemSessionLedgerEnabled()) return;
  const endpoint = "POST /api/problem-sessions";
  try {
    const res = await fetch(`${PROBLEM_SESSION_SVC_URL}/api/problem-sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: input.tenantId,
        learnerId: input.learnerId,
        subject: input.subject,
        source: "lesson",
        sourceSessionId: input.sourceSessionId,
        tutorSku: input.tutorSku,
        metadata: { topic: input.topic, sourceService: "learning-svc" },
      }),
    });
    if (!res.ok) {
      reportDownstreamFailure({
        service: "problem-session-svc",
        endpoint,
        statusCode: res.status,
        correlationId: ctx.correlationId,
        learnerId: ctx.learnerId ?? input.learnerId,
        tracker: ctx.tracker,
      });
    }
  } catch (err) {
    // Ledger failures still must never break the lesson flow — but they
    // are no longer invisible. Log + count + (optionally) attach to the
    // request's degradation tracker.
    reportDownstreamFailure({
      service: "problem-session-svc",
      endpoint,
      correlationId: ctx.correlationId,
      learnerId: ctx.learnerId ?? input.learnerId,
      err,
      tracker: ctx.tracker,
    });
  }
}

export function registerSessionRoutes(app: FastifyInstance, db: any) {
  /**
   * Fan-out a lesson-session row to every parent SSE subscriber on the
   * `session.coview.<learnerId>` subject. Cross-replica via NATS when
   * configured; in-process EventEmitter otherwise. Best-effort — polling
   * remains the documented fallback when the bus drops a message.
   */
  function publishCoview(
    learnerId: string,
    event: "created" | "updated" | "completed",
    snapshot: Record<string, unknown>,
  ): void {
    void (async () => {
      try {
        const bus = await getRealtimeBus();
        await bus.publish(busSubjects.sessionCoview(learnerId), {
          type: `session.${event}`,
          learnerId,
          session: snapshot,
          at: new Date().toISOString(),
        });
      } catch {
        /* best-effort */
      }
    })();
  }

  app.post("/api/learning/sessions", { schema: createSessionSchema }, async (request, reply) => {
    const body = request.body as {
      learnerId?: string;
      tutorSku?: string;
      topic?: string;
      contentType?: string;
      sessionDate?: string;
      durationMinutes?: number | string;
    };
    const { learnerId, tutorSku, topic, contentType } = body;
    if (!learnerId || !tutorSku) {
      return reply.code(400).send({ error: "learnerId and tutorSku required" });
    }

    const access = await requireLearnerAccess(request, reply, db, learnerId);
    if (!access) return;
    const tenantId = access.tenantId;

    // Service-to-service callers (homework generation, prefetch jobs)
    // bypass the entitlement gate; user-initiated session starts must
    // pass through it. Therapy session logs are not tutor-gated.
    const callerRole = (request as any).auth?.role;
    if (callerRole !== "service" && contentType !== "THERAPY_SESSION") {
      const decision = await checkLearnerTutorAccess(db, tenantId, tutorSku);
      if (!decision.entitled) {
        return (reply as any).code(403).send({
          error: "Tutor not included in current subscription",
          requiredSku: decision.requiredSku,
          upgradePath: decision.upgradePath,
          reason: decision.reason,
        });
      }
    }

    // ---- Optional manual-entry fields (Phase 4 backend gap) -------------
    // The web therapist sessions page and mobile (therapist) sessions tab
    // collect a session date and a duration in minutes; honour them on the
    // initial insert so the row reflects when the documented session
    // actually happened, not when the therapist clicked "Log".
    let startedAt: Date | undefined;
    if (typeof body.sessionDate === "string" && body.sessionDate.trim()) {
      const parsed = new Date(body.sessionDate);
      if (!Number.isNaN(parsed.getTime())) startedAt = parsed;
    }
    let durationSeconds = 0;
    if (body.durationMinutes != null) {
      const minutes =
        typeof body.durationMinutes === "string"
          ? parseFloat(body.durationMinutes)
          : body.durationMinutes;
      if (Number.isFinite(minutes) && minutes > 0) {
        // Clamp to a reasonable cap (8 h) so a typo can't poison reports.
        durationSeconds = Math.round(Math.min(minutes, 480) * 60);
      }
    }

    // ---- Manual therapy-session log path (Phase 4 backend gap) ----------
    // The dashboards POST `contentType: "THERAPY_SESSION"` to record a
    // therapist-led session that already happened. That value is not in
    // the `content_type` enum, and there is no AI lesson to generate, so
    // short-circuit: store with the LESSON content-type, mark COMPLETED,
    // stash the original category and notes in `session_data`, and skip
    // the content-generation pipeline entirely.
    if (contentType === "THERAPY_SESSION") {
      // tutorSku follows the `therapy-${category}` convention agreed with
      // the web + mobile therapist sessions screens; strip the prefix to
      // recover the raw category (e.g. "speech", "occupational"). Falls
      // back to "therapy" if the client sent something off-pattern.
      const THERAPY_SKU_PREFIX = "therapy-";
      const subject = tutorSku.startsWith(THERAPY_SKU_PREFIX)
        ? tutorSku.slice(THERAPY_SKU_PREFIX.length)
        : "therapy";
      const sessionTimestamp = startedAt ?? new Date();
      const [session] = await db
        .insert(lessonSessions)
        .values({
          tenantId,
          learnerId,
          tutorSku,
          subject,
          status: "COMPLETED",
          contentType: "LESSON",
          functioningLevel: null,
          sessionData: {
            manualLog: true,
            source: "therapy_session",
            category: subject,
            notes: typeof topic === "string" ? topic : null,
          },
          durationSeconds,
          startedAt: sessionTimestamp,
          completedAt: sessionTimestamp,
        })
        .returning();
      return { sessionId: session.id, status: "COMPLETED" };
    }

    const subject = getSubjectForTutor(tutorSku);
    const tracker = new DegradationTracker();
    const downstreamCtx = {
      tracker,
      correlationId: request.id,
      learnerId,
    } as const;
    const brainContext = await fetchBrainContext(learnerId, downstreamCtx);

    // Sprint 0 — Guardrails: BRAIN_SVC is a critical subsystem. When it
    // is unavailable and the service is not configured to fail open we
    // surface a typed degraded response instead of fabricating a lesson
    // off an empty brain snapshot.
    if (tracker.has("brain-svc") && !failOpen()) {
      return reply
        .code(503)
        .send(buildDegradedResponse(tracker, "Critical downstream subsystem unavailable"));
    }

    const functioningLevel = (brainContext as any).functioning_level_profile?.level || "STANDARD";

    // Resolve the grade target + delivery level for generation. NEVER a
    // hardcoded constant: alignment (enrollment + baseline placement) →
    // learners.grade_level → 422. A wrong-grade lesson is worse than an
    // explicit error.
    const [learnerRow] = await db
      .select({ gradeLevel: learners.gradeLevel })
      .from(learners)
      .where(eq(learners.id, learnerId));
    const gradeResolution = resolveGradeTargets({
      alignment: (brainContext as any).curriculum_alignment,
      learnerGradeLevel: learnerRow?.gradeLevel ?? null,
    });
    if (!gradeResolution.ok) {
      request.log.warn(
        { event: "curriculum_alignment.grade_unresolvable", learnerId },
        "no grade band resolvable for learner; refusing to generate at an arbitrary grade",
      );
      return reply.code(422).send({
        error: "grade_unresolvable",
        message:
          "Learner has no resolvable grade level. Set the learner's grade (or curriculum alignment) before starting a lesson session.",
      });
    }
    if (gradeResolution.source !== "alignment") {
      request.log.warn(
        { event: "curriculum_alignment.missing", learnerId, source: gradeResolution.source },
        "curriculum_alignment incomplete; using fallback grade resolution",
      );
    }

    // Sprint 05: pull subject-brain context when the flag is on. The result
    // is merged into brainContext so the existing generator pipeline picks
    // it up without behavioral change when the flag is off.
    const subjectBrainContext = await fetchSubjectBrainContext(
      {
        learnerId,
        subject,
        topic,
        brainContext,
      },
      downstreamCtx,
    );
    const enrichedBrainContext = subjectBrainContext
      ? { ...brainContext, subjectBrain: subjectBrainContext }
      : brainContext;

    const [session] = await db
      .insert(lessonSessions)
      .values({
        tenantId,
        learnerId,
        tutorSku,
        subject,
        status: "CONTENT_GENERATING",
        contentType: contentType || "LESSON",
        functioningLevel,
        brainContextSnapshot: enrichedBrainContext,
        ...(startedAt ? { startedAt } : {}),
        ...(durationSeconds > 0 ? { durationSeconds } : {}),
      })
      .returning();

    // Cross-replica fan-out for parent co-view: a new session row exists.
    // Parents watching `session.coview.<learnerId>` get a push immediately;
    // polling on /api/learning/sessions remains the documented fallback.
    publishCoview(learnerId, "created", {
      id: session.id,
      status: session.status,
      subject: session.subject,
      tutorSku: session.tutorSku,
      startedAt: session.startedAt,
    });

    // Sprint 02: fire-and-forget problem-session ledger record (flag-gated).
    void recordProblemSessionForLesson(
      {
        tenantId,
        learnerId,
        subject,
        sourceSessionId: session.id,
        tutorSku,
        topic,
      },
      downstreamCtx,
    );

    try {
      const generated = await generateLessonContent({
        subject,
        topic: topic || `Introduction to ${subject}`,
        gradeTarget: gradeResolution.gradeTarget,
        deliveryLevel: gradeResolution.deliveryLevel,
        functioningLevel,
        brainContext: enrichedBrainContext,
        contentType: contentType || "LESSON",
      });

      // Sprint 10: evaluate the generated content with responsible-AI when
      // the flag is on. We run in `warn` mode so a violation logs and
      // recommends a revise but does NOT block legacy delivery. Switching
      // to `block` mode is a one-line change once the team is ready.
      const raiResult = await evaluateResponsibleAi(
        {
          learnerId,
          contextType: "lesson",
          inputSummary: topic || `Introduction to ${subject}`,
          output: { content: generated.content, subject, topic },
          requiredSurfaces: (subjectBrainContext as { recommendedSurfaces?: string[] } | undefined)
            ?.recommendedSurfaces,
        },
        downstreamCtx,
      );
      if (raiResult && !raiResult.allowed) {
        app.log.warn(
          { learnerId, sessionId: session.id, severity: raiResult.severity },
          "responsible-AI flagged generated lesson content",
        );
      }

      await db.insert(lessonContent).values({
        sessionId: session.id,
        contentType: contentType || "LESSON",
        subject,
        topic: topic || `Introduction to ${subject}`,
        gradeTarget: gradeResolution.gradeTarget,
        deliveryLevel: gradeResolution.deliveryLevel,
        generatedContent: { raw: generated.content },
        qualityScore: generated.qualityScore,
        qualityGateLog: generated.qualityGateLog,
        promptTokens: generated.promptTokens,
        completionTokens: generated.completionTokens,
        modelUsed: generated.model,
      });

      if (!generated.qualityGatePassed) {
        await db
          .update(lessonSessions)
          .set({
            status: "ABANDONED",
            sessionData: {
              error: "Content failed quality gate",
              qualityGateLog: generated.qualityGateLog,
            },
          })
          .where(eq(lessonSessions.id, session.id));
        return reply.code(422).send({
          error: "Content failed quality gate",
          qualityScore: generated.qualityScore,
          qualityGateLog: generated.qualityGateLog,
        });
      }

      await db
        .update(lessonSessions)
        .set({ status: "CONTENT_READY" })
        .where(eq(lessonSessions.id, session.id));

      return {
        sessionId: session.id,
        status: "CONTENT_READY",
        content: generated.content,
        qualityScore: generated.qualityScore,
        ...(tracker.isDegraded()
          ? { degraded: true as const, degradedSubsystems: tracker.snapshot() }
          : {}),
      };
    } catch (err: any) {
      await db
        .update(lessonSessions)
        .set({ status: "ABANDONED", sessionData: { error: err.message } })
        .where(eq(lessonSessions.id, session.id));
      return reply.code(503).send({ error: "Content generation failed", detail: err.message });
    }
  });

  app.post(
    "/api/learning/sessions/:sessionId/complete",
    { schema: completeSessionSchema },
    async (request, reply) => {
      const { sessionId } = request.params as any;
      const body = (request.body as any) || {};
      const { masteryUpdates, xpEarned } = body;

      const [session] = await db
        .select()
        .from(lessonSessions)
        .where(eq(lessonSessions.id, sessionId));
      if (!session) return reply.code(404).send({ error: "Session not found" });

      const access = await requireLearnerAccess(request, reply, db, session.learnerId);
      if (!access) return;

      const durationSeconds = Math.floor((Date.now() - session.startedAt.getTime()) / 1000);

      // Compute multi-signal XP + quality unless caller supplied a final xpEarned.
      const masteryBefore = (session.brainContextSnapshot as any)?.mastery_levels || {};
      const masteryDelta = computeMasteryDelta(masteryBefore, masteryUpdates || {});
      const signals: LessonSignals = {
        durationSeconds,
        functioningLevel: session.functioningLevel || "STANDARD",
        beatsCompleted: body.beatsCompleted,
        beatsTotal: body.beatsTotal,
        correctAnswers: body.correctAnswers,
        attemptedAnswers: body.attemptedAnswers,
        engagementBeats: body.engagementBeats,
        breaksUsed: body.breaksUsed,
        masteryDelta,
      };
      const computedXp = computeLessonXp(signals);
      const completionQuality = computeCompletionQuality(signals);
      const finalXp = typeof xpEarned === "number" ? xpEarned : computedXp;

      await db
        .update(lessonSessions)
        .set({
          status: "COMPLETED",
          masteryAfter: masteryUpdates || {},
          xpEarned: finalXp,
          completedAt: new Date(),
          durationSeconds,
          sessionData: {
            ...((session.sessionData as any) || {}),
            completionQuality,
            scoringSignals: signals,
          },
        })
        .where(eq(lessonSessions.id, sessionId));

      // Parent co-view fan-out: session moved to COMPLETED. Watching
      // parents get a push so their list flips off the "live" badge
      // without waiting on the 6s poll.
      publishCoview(session.learnerId, "completed", {
        id: session.id,
        status: "COMPLETED",
        subject: session.subject,
        tutorSku: session.tutorSku,
        xpEarned: finalXp,
        completedAt: new Date().toISOString(),
      });

      if (masteryUpdates) {
        for (const [skill, score] of Object.entries(masteryUpdates)) {
          const existing = await db
            .select()
            .from(gradebookEntries)
            .where(
              and(
                eq(gradebookEntries.learnerId, session.learnerId),
                eq(gradebookEntries.skill, skill),
              ),
            );

          if (existing.length > 0) {
            await db
              .update(gradebookEntries)
              .set({
                masteryScore: score as number,
                attemptsCount: (existing[0].attemptsCount || 0) + 1,
                lastAssessedAt: new Date(),
                trend:
                  (score as number) > (existing[0].masteryScore || 0)
                    ? "improving"
                    : (score as number) < (existing[0].masteryScore || 0)
                      ? "declining"
                      : "stable",
                updatedAt: new Date(),
              })
              .where(eq(gradebookEntries.id, existing[0].id));
          } else {
            await db.insert(gradebookEntries).values({
              tenantId: session.tenantId,
              learnerId: session.learnerId,
              subject: session.subject,
              skill,
              masteryScore: score as number,
              attemptsCount: 1,
              lastAssessedAt: new Date(),
            });
          }
        }
      }

      await emitLessonAudit({
        db,
        request,
        eventType: "LESSON_RUN_COMPLETED",
        tenantId: session.tenantId,
        learnerId: session.learnerId,
        sessionId: session.id,
        details: {
          subject: session.subject,
          tutorSku: session.tutorSku,
          durationSeconds,
          xpEarned: finalXp,
          completionQuality,
          masteryDelta,
          masterySkillCount: masteryUpdates ? Object.keys(masteryUpdates).length : 0,
        },
      });

      return { status: "COMPLETED", sessionId, xpEarned: finalXp, completionQuality };
    },
  );

  app.post(
    "/api/learning/gradebook/update",
    { schema: updateGradebookSchema },
    async (request, reply) => {
      // Authentication is enforced by the global onRequest hook
      // (registerAuthHook): JWT or x-service-token. Authorization
      // (tenant match) is enforced per-call below via requireLearnerAccess.
      const { learnerId, skill, masteryScore, sessionType, xpEarned } = request.body as any;
      if (!learnerId || !skill) {
        return reply.code(400).send({ error: "learnerId and skill required" });
      }

      const access = await requireLearnerAccess(request, reply, db, learnerId);
      if (!access) return;
      const tenantId = access.tenantId;

      const existing = await db
        .select()
        .from(gradebookEntries)
        .where(and(eq(gradebookEntries.learnerId, learnerId), eq(gradebookEntries.skill, skill)));

      if (existing.length > 0) {
        await db
          .update(gradebookEntries)
          .set({
            masteryScore: masteryScore ?? existing[0].masteryScore,
            attemptsCount: (existing[0].attemptsCount || 0) + 1,
            lastAssessedAt: new Date(),
            trend:
              masteryScore > (existing[0].masteryScore || 0)
                ? "improving"
                : masteryScore < (existing[0].masteryScore || 0)
                  ? "declining"
                  : "stable",
            updatedAt: new Date(),
          })
          .where(eq(gradebookEntries.id, existing[0].id));
      } else {
        await db.insert(gradebookEntries).values({
          tenantId,
          learnerId,
          subject: skill.replace("homework_", ""),
          skill,
          masteryScore: masteryScore || 0,
          attemptsCount: 1,
          lastAssessedAt: new Date(),
        });
      }

      return { status: "updated", skill, masteryScore };
    },
  );

  app.get("/api/learning/sessions", { schema: listSessionsSchema }, async (request, reply) => {
    const { learnerId } = request.query as any;
    if (!learnerId) return reply.code(400).send({ error: "learnerId required" });

    const access = await requireLearnerAccess(request, reply, db, learnerId);
    if (!access) return;

    const sessions = await db
      .select()
      .from(lessonSessions)
      .where(eq(lessonSessions.learnerId, learnerId))
      .orderBy(desc(lessonSessions.startedAt))
      .limit(20);
    return sessions;
  });

  /**
   * Single-session fetch used by the mobile stage runtime and any
   * resume-session UX. The response wraps `sessionData.beats` (or the
   * stagePlan stored at create time) under `stagePlan.beats` so clients
   * can rely on a stable shape regardless of which generator filled
   * the row.
   */
  app.get(
    "/api/learning/sessions/:sessionId",
    { schema: getSessionByIdSchema },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const [row] = await db.select().from(lessonSessions).where(eq(lessonSessions.id, sessionId));
      if (!row) return reply.code(404).send({ error: "Session not found" });
      const access = await requireLearnerAccess(request, reply, db, row.learnerId);
      if (!access) return;

      const sessionData = (row.sessionData as Record<string, unknown> | null) ?? {};
      const stagePlanFromData =
        (sessionData.stagePlan as { beats?: unknown[] } | undefined) ?? null;
      const beats: unknown[] = Array.isArray(stagePlanFromData?.beats)
        ? (stagePlanFromData!.beats as unknown[])
        : Array.isArray((sessionData as any).beats)
          ? ((sessionData as any).beats as unknown[])
          : [];

      return {
        sessionId: row.id,
        learnerId: row.learnerId,
        tutorSku: row.tutorSku,
        subject: row.subject,
        functioningLevel: row.functioningLevel,
        status: row.status,
        startedAt: row.startedAt?.toISOString?.() ?? null,
        completedAt: row.completedAt?.toISOString?.() ?? null,
        xpEarned: row.xpEarned ?? 0,
        stagePlan: { beats },
      };
    },
  );

  app.get(
    "/api/learning/gradebook/:learnerId",
    { schema: getGradebookSchema },
    async (request, reply) => {
      const { learnerId } = request.params as any;

      const access = await requireLearnerAccess(request, reply, db, learnerId);
      if (!access) return;

      const entries = await db
        .select()
        .from(gradebookEntries)
        .where(eq(gradebookEntries.learnerId, learnerId))
        .orderBy(desc(gradebookEntries.updatedAt));
      return entries;
    },
  );

  app.get(
    "/api/learning/path/:learnerId/:subject",
    { schema: getLearningPathSchema },
    async (request, reply) => {
      const { learnerId, subject } = request.params as any;

      const access = await requireLearnerAccess(request, reply, db, learnerId);
      if (!access) return;

      const [path] = await db
        .select()
        .from(learningPaths)
        .where(and(eq(learningPaths.learnerId, learnerId), eq(learningPaths.subject, subject)));

      if (!path) {
        const [newPath] = await db
          .insert(learningPaths)
          .values({
            tenantId: access.tenantId,
            learnerId,
            subject,
            topicSequence: getDefaultTopics(subject),
            completedTopics: [],
            masteryMap: {},
          })
          .returning();
        return newPath;
      }

      return path;
    },
  );

  app.post(
    "/api/learning/path/:learnerId/:subject/init",
    { schema: initLearningPathSchema },
    async (request, reply) => {
      const { learnerId, subject } = request.params as any;

      const access = await requireLearnerAccess(request, reply, db, learnerId);
      if (!access) return;

      const [existing] = await db
        .select()
        .from(learningPaths)
        .where(and(eq(learningPaths.learnerId, learnerId), eq(learningPaths.subject, subject)));

      if (existing) {
        return { status: "already_exists", path: existing };
      }

      const tenantId = access.tenantId;

      // Insert with static defaults first so we always return something fast.
      const [newPath] = await db
        .insert(learningPaths)
        .values({
          tenantId,
          learnerId,
          subject,
          topicSequence: getDefaultTopics(subject),
          completedTopics: [],
          masteryMap: {},
        })
        .returning();

      // Best-effort upgrade to personalized LLM-generated topics.
      const authHeader = request.headers.authorization;
      const personalized = await fetchPersonalizedTopics({
        learnerId,
        subject,
        currentMastery: 0,
        completedTopics: [],
        authHeader,
      });

      if (personalized) {
        const topicNames = personalized.map((t) => t.topic).filter(Boolean);
        if (topicNames.length > 0) {
          const [updated] = await db
            .update(learningPaths)
            .set({ topicSequence: topicNames, updatedAt: new Date() })
            .where(eq(learningPaths.id, newPath.id))
            .returning();
          return { status: "created", path: updated, personalized: true };
        }
      }

      return { status: "created", path: newPath, personalized: false };
    },
  );

  app.post(
    "/api/learning/path/:learnerId/:subject/refresh-topics",
    { schema: refreshLearningPathTopicsSchema },
    async (request, reply) => {
      const { learnerId, subject } = request.params as any;

      const access = await requireLearnerAccess(request, reply, db, learnerId);
      if (!access) return;

      const [path] = await db
        .select()
        .from(learningPaths)
        .where(and(eq(learningPaths.learnerId, learnerId), eq(learningPaths.subject, subject)));

      if (!path) {
        return reply.code(404).send({ error: "Learning path not found" });
      }

      const brain = await fetchBrainContext(learnerId, {
        correlationId: request.id,
        learnerId,
      });
      const masteryLevels = ((brain as any).mastery_levels || {}) as Record<string, number>;
      const subjectScores = Object.entries(masteryLevels)
        .filter(([k]) => k.toLowerCase().includes(subject.toLowerCase().split(" ")[0]))
        .map(([, v]) => Number(v) || 0);
      const currentMastery = subjectScores.length
        ? subjectScores.reduce((a, b) => a + b, 0) / subjectScores.length
        : 0;

      const completedTopics = ((path.completedTopics as string[]) || []).slice(-20);
      const personalized = await fetchPersonalizedTopics({
        learnerId,
        subject,
        currentMastery,
        completedTopics,
        authHeader: request.headers.authorization,
      });

      if (!personalized) {
        return reply.code(503).send({
          status: "fallback",
          error: "Could not refresh topics from curriculum engine",
          topicSequence: path.topicSequence,
        });
      }

      const topicNames = personalized.map((t) => t.topic).filter(Boolean);
      const [updated] = await db
        .update(learningPaths)
        .set({ topicSequence: topicNames, updatedAt: new Date() })
        .where(eq(learningPaths.id, path.id))
        .returning();

      return { status: "refreshed", path: updated, topicCount: topicNames.length };
    },
  );

  app.post(
    "/api/learning/path/:learnerId/:subject/advance",
    { schema: advanceLearningPathSchema },
    async (request, reply) => {
      const { learnerId, subject } = request.params as any;

      const access = await requireLearnerAccess(request, reply, db, learnerId);
      if (!access) return;

      const [path] = await db
        .select()
        .from(learningPaths)
        .where(and(eq(learningPaths.learnerId, learnerId), eq(learningPaths.subject, subject)));

      if (!path) {
        return reply.code(404).send({ error: "Learning path not found" });
      }

      const sequence = (path.topicSequence as string[]) || [];
      const completed = (path.completedTopics as string[]) || [];
      const currentTopic = sequence.find((t) => !completed.includes(t));

      if (!currentTopic) {
        return { status: "path_complete", subject, completedCount: completed.length };
      }

      const brain = await fetchBrainContext(learnerId, {
        correlationId: request.id,
        learnerId,
      });
      const functioningLevel =
        ((brain as any).functioning_level_profile?.level as string) || "STANDARD";
      const threshold = MASTERY_THRESHOLDS[functioningLevel] ?? MASTERY_THRESHOLDS.STANDARD;

      const gradebook = await db
        .select()
        .from(gradebookEntries)
        .where(
          and(eq(gradebookEntries.learnerId, learnerId), eq(gradebookEntries.skill, currentTopic)),
        );
      const masteryScore = Number(gradebook[0]?.masteryScore) || 0;

      if (masteryScore < threshold) {
        return {
          status: "needs_practice",
          currentTopic,
          masteryScore,
          thresholdRequired: threshold,
          functioningLevel,
        };
      }

      const newCompleted = [...completed, currentTopic];
      const remaining = sequence.filter((t) => !newCompleted.includes(t));
      const nextTopic = remaining[0] || null;

      await db
        .update(learningPaths)
        .set({ completedTopics: newCompleted, currentTopic: nextTopic, updatedAt: new Date() })
        .where(eq(learningPaths.id, path.id));

      // Trigger refresh once the queue is running low (fire-and-forget).
      if (remaining.length <= 3) {
        const authHeader = request.headers.authorization;
        void (async () => {
          try {
            const personalized = await fetchPersonalizedTopics({
              learnerId,
              subject,
              currentMastery: masteryScore,
              completedTopics: newCompleted.slice(-20),
              authHeader,
            });
            if (personalized) {
              const newTopics = personalized.map((t) => t.topic).filter(Boolean);
              const merged = Array.from(new Set([...remaining, ...newTopics]));
              await db
                .update(learningPaths)
                .set({ topicSequence: merged, updatedAt: new Date() })
                .where(eq(learningPaths.id, path.id));
            }
          } catch {}
        })();
      }

      return {
        status: nextTopic ? "advanced" : "path_complete",
        previousTopic: currentTopic,
        nextTopic,
        masteryScore,
        thresholdRequired: threshold,
        functioningLevel,
      };
    },
  );

  // Sprint 02 / 03 relay: receives surface telemetry from the web stage and
  // forwards it to the problem-session ledger. The relay looks up the most
  // recent active problem session for the learner (which the lesson-create
  // adapter recorded) and appends the event there. Flag-gated; no-op when
  // the ledger flag is off.
  app.post("/api/learning/surface-telemetry", async (request, reply) => {
    if (!problemSessionLedgerEnabled()) {
      return reply.code(204).send();
    }
    const body = request.body as {
      learnerId?: string;
      sessionId?: string;
      eventType?: string;
      payload?: Record<string, unknown>;
    } | null;
    if (!body?.learnerId || !body?.eventType) {
      return reply.code(400).send({ error: "learnerId and eventType are required" });
    }
    try {
      const recentRes = await fetch(
        `${PROBLEM_SESSION_SVC_URL}/api/problem-sessions/learner/${encodeURIComponent(
          body.learnerId,
        )}/recent?limit=5`,
      );
      if (!recentRes.ok) return reply.code(204).send();
      const { sessions = [] } = (await recentRes.json()) as {
        sessions: Array<{ id: string; sourceSessionId?: string; status: string }>;
      };
      // Prefer the session whose sourceSessionId matches the lesson session;
      // fall back to the most recent active session.
      const match =
        sessions.find((s) => body.sessionId && s.sourceSessionId === body.sessionId) ??
        sessions.find((s) => s.status === "active");
      if (!match) return reply.code(204).send();
      await fetch(
        `${PROBLEM_SESSION_SVC_URL}/api/problem-sessions/${encodeURIComponent(match.id)}/events`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            eventType: body.eventType,
            payload: body.payload ?? {},
          }),
        },
      );
      return reply.code(204).send();
    } catch {
      // Telemetry is best-effort.
      return reply.code(204).send();
    }
  });
}

const MASTERY_THRESHOLDS: Record<string, number> = {
  STANDARD: 0.7,
  SUPPORTED: 0.6,
  LOW_VERBAL: 0.5,
  NON_VERBAL: 0.4,
  PRE_SYMBOLIC: 0.3,
};

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

function getDefaultTopics(subject: string): string[] {
  const topicMap: Record<string, string[]> = {
    Mathematics: [
      "Number Sense",
      "Addition & Subtraction",
      "Multiplication",
      "Division",
      "Fractions",
      "Decimals",
      "Geometry",
      "Measurement",
      "Data & Graphs",
      "Word Problems",
    ],
    "English Language Arts": [
      "Letter Recognition",
      "Phonics",
      "Sight Words",
      "Reading Fluency",
      "Reading Comprehension",
      "Vocabulary",
      "Sentence Structure",
      "Paragraph Writing",
      "Story Writing",
      "Grammar",
    ],
    Science: [
      "Living Things",
      "Plants",
      "Animals",
      "Human Body",
      "Weather",
      "Earth & Space",
      "Matter & Materials",
      "Force & Motion",
      "Energy",
      "Scientific Method",
    ],
    "History & Social Studies": [
      "Community",
      "Maps & Geography",
      "American Symbols",
      "Native Americans",
      "Colonial America",
      "American Revolution",
      "Civil War",
      "20th Century",
      "Government",
      "Citizenship",
    ],
    "Coding & Computer Science": [
      "Sequences",
      "Loops",
      "Conditionals",
      "Variables",
      "Functions",
      "Debugging",
      "Algorithms",
      "Data Structures",
      "Web Basics",
      "Game Design",
    ],
    "Speech & Language": [
      "Articulation",
      "Vocabulary Building",
      "Sentence Formation",
      "Conversation Skills",
      "Listening Comprehension",
      "Pragmatic Language",
      "Narrative Skills",
      "Following Directions",
      "Answering Questions",
      "Social Communication",
    ],
    "Social-Emotional Learning": [
      "Emotion Identification",
      "Self-Regulation",
      "Empathy",
      "Friendship Skills",
      "Conflict Resolution",
      "Growth Mindset",
      "Self-Advocacy",
      "Coping Strategies",
      "Gratitude",
      "Mindfulness",
    ],
  };
  return (
    topicMap[subject] || [
      "Introduction",
      "Foundations",
      "Core Concepts",
      "Practice",
      "Application",
      "Review",
    ]
  );
}
