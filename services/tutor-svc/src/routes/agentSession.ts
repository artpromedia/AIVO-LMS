/**
 * Wave E (S9) — tutor agent session routes.
 *
 *   POST /api/tutor/agent/session/open                 — start an agent session
 *   POST /api/tutor/agent/session/:sessionId/turn      — one observation → one decision
 *   POST /api/tutor/agent/session/:sessionId/close     — finish (learner done / player unmount)
 *
 * Callers are the web BFF (x-service-token) — session/role/scope/consent are
 * enforced there; this service re-anchors tenant via the learner row. The
 * routes are a thin shell: all decision logic lives in
 * `agent/orchestrator.ts` (unit-tested with faked deps), and the ai-svc
 * model turn is invoked over the shared X-Internal-Auth contract.
 */
import type { FastifyInstance } from "fastify";
import { and, eq } from "drizzle-orm";
import { tutorSessions, tutorDecisionTraces } from "@aivo/db";
import { createLogger } from "@aivo/observability";
import type { TutorFunctioningLevel } from "@aivo/tutor-sdk";
import {
  AgentOrchestrator,
  initialAgentState,
  type AgentSessionRow,
  type AgentSessionState,
  type AiTurnResult,
  type LessonObservation,
  type OrchestratorDeps,
} from "../agent/orchestrator.js";
import { executeDomainTool } from "../agent/tools.js";
import { getTutorDefinition } from "../modes/registry.js";
import { negotiateFunctioningLevel } from "../lib/learnerContext.js";
import { resolveTenantIdForLearner } from "../lib/tenant.js";
import { emitTutorAudit } from "../lib/audit.js";
import { getActiveCurriculumFocus } from "./curriculum.js";
import { TUTOR_SKU_TO_KEY } from "./chat.js";
import {
  agentSessionOpenSchema,
  agentSessionTurnSchema,
  agentSessionCloseSchema,
} from "./schemas.js";

const logger = createLogger("tutor-svc.agent-routes");

const IS_PROD = process.env.NODE_ENV === "production";
const AI_SVC_URL = process.env.AI_SVC_URL ?? "http://localhost:3004";
const INTERNAL_AI_TOKEN =
  process.env.INTERNAL_AI_TOKEN || (IS_PROD ? "" : "dev-tutor-svc-internal");
if (IS_PROD && !INTERNAL_AI_TOKEN) {
  throw new Error(
    "tutor-svc: INTERNAL_AI_TOKEN must be set in production (shared with ai-svc tutor-agent routes).",
  );
}

/** Server-side budget for one ai-svc turn. The lesson player enforces its
 *  own 1500ms render deadline; this cap only stops a hung upstream from
 *  pinning a connection — the ladder handles ordinary slowness. */
const AGENT_TURN_TIMEOUT_MS = parseInt(process.env.AGENT_TURN_TIMEOUT_MS || "4000", 10);

const TUTOR_KEY_TO_SKU: Record<string, string> = Object.fromEntries(
  Object.entries(TUTOR_SKU_TO_KEY).map(([sku, key]) => [key, sku]),
);

const BEAT_KINDS = new Set([
  "welcome",
  "goal",
  "story",
  "micro",
  "example",
  "guided",
  "check",
  "celebrate",
  "progress",
  "next",
]);

/** Validate + normalise the observation body. Returns null when invalid. */
export function parseObservation(raw: unknown): LessonObservation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const beatIndex = Number(o.beatIndex);
  const totalBeats = Number(o.totalBeats);
  const beatKind = o.beatKind;
  if (!Number.isInteger(beatIndex) || beatIndex < 0) return null;
  if (!Number.isInteger(totalBeats) || totalBeats <= 0 || beatIndex >= totalBeats) return null;
  if (beatKind !== "guided" && beatKind !== "check") return null;
  if (typeof o.prompt !== "string" || typeof o.learnerResponse !== "string") return null;
  if (typeof o.isCorrect !== "boolean") return null;
  const beatKinds = Array.isArray(o.beatKinds)
    ? o.beatKinds.filter((k): k is LessonObservation["beatKinds"][number] =>
        BEAT_KINDS.has(String(k)),
      )
    : [];
  if (beatKinds.length > 0 && beatKinds.length !== totalBeats) return null;
  const num = (v: unknown): number | undefined =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined;
  return {
    beatIndex,
    totalBeats,
    beatKind,
    beatKinds,
    prompt: o.prompt.slice(0, 2_000),
    learnerResponse: o.learnerResponse.slice(0, 2_000),
    isCorrect: o.isCorrect,
    expectedAnswer: typeof o.expectedAnswer === "string" ? o.expectedAnswer.slice(0, 500) : undefined,
    attemptsOnBeat: num(o.attemptsOnBeat),
    hintsUsed: num(o.hintsUsed),
    scaffoldsUsed: num(o.scaffoldsUsed),
    recentMissStreak: num(o.recentMissStreak),
    secondsOnBeat: num(o.secondsOnBeat),
    skillId: typeof o.skillId === "string" ? o.skillId.slice(0, 200) : undefined,
    frustrationEvent: o.frustrationEvent === true ? true : undefined,
  };
}

async function defaultCallAiTurn(payload: Record<string, unknown>): Promise<AiTurnResult> {
  const res = await fetch(`${AI_SVC_URL}/api/ai/tutor-agent/turn`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Auth": INTERNAL_AI_TOKEN,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(AGENT_TURN_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`ai-svc tutor-agent turn returned ${res.status}`);
  return (await res.json()) as AiTurnResult;
}

async function defaultFetchBrainContext(learnerId: string): Promise<Record<string, unknown>> {
  const BRAIN_SVC_URL = process.env.BRAIN_SVC_URL ?? "http://localhost:3002";
  try {
    const res = await fetch(`${BRAIN_SVC_URL}/api/brain/${learnerId}`, {
      signal: AbortSignal.timeout(2_500),
    });
    if (res.ok) {
      const data = (await res.json()) as { state?: Record<string, unknown> };
      return data.state ?? {};
    }
  } catch {
    // Tool reads are best-effort; the orchestrator reports the miss to the model.
  }
  return {};
}

export function registerAgentSessionRoutes(
  app: FastifyInstance,
  db: any,
  depOverrides: Partial<OrchestratorDeps> = {},
): void {
  const store: OrchestratorDeps["store"] = {
    async loadSession(sessionId: string): Promise<AgentSessionRow | null> {
      const [row] = await db
        .select()
        .from(tutorSessions)
        .where(eq(tutorSessions.id, sessionId));
      if (!row) return null;
      return {
        id: row.id,
        tenantId: row.tenantId,
        learnerId: row.learnerId,
        tutorSku: row.tutorSku,
        sessionType: row.sessionType,
        functioningLevel: row.functioningLevel,
        brainContext: (row.brainContext as Record<string, unknown> | null) ?? {},
        agentState: (row.agentState as AgentSessionState | null) ?? null,
        completedAt: row.completedAt,
      };
    },
    async saveAgentState(sessionId: string, state: AgentSessionState): Promise<void> {
      await db
        .update(tutorSessions)
        .set({ agentState: state })
        .where(eq(tutorSessions.id, sessionId));
    },
    async insertTrace(trace): Promise<void> {
      await db.insert(tutorDecisionTraces).values({
        tenantId: trace.tenantId,
        sessionId: trace.sessionId,
        learnerId: trace.learnerId,
        tutorKey: trace.tutorKey,
        seq: trace.seq,
        observationDigest: trace.observationDigest,
        action: trace.action,
        rationale: trace.rationale,
        decision: trace.decision,
        rung: trace.rung,
        latencyMs: trace.latencyMs,
      });
    },
  };

  const deps: OrchestratorDeps = {
    store: depOverrides.store ?? store,
    callAiTurn: depOverrides.callAiTurn ?? defaultCallAiTurn,
    fetchBrainContext: depOverrides.fetchBrainContext ?? defaultFetchBrainContext,
    getCurriculumFocus:
      depOverrides.getCurriculumFocus ??
      (async (learnerId: string, subject: string) => {
        try {
          return await getActiveCurriculumFocus(db, learnerId, subject);
        } catch {
          return null;
        }
      }),
    // Wave E (S10): the real domain adapters (math-recognizer-svc,
    // science-solver-svc, speech-eval-svc, in-process EF breakdown).
    runDomainTool:
      depOverrides.runDomainTool ?? ((name, args, ctx) => executeDomainTool(name, args, ctx)),
    onRungDrop: depOverrides.onRungDrop,
    now: depOverrides.now,
  };
  const orchestrator = new AgentOrchestrator(deps);

  // ── POST /api/tutor/agent/session/open ────────────────────────────────
  app.post("/api/tutor/agent/session/open", { schema: agentSessionOpenSchema }, async (request, reply) => {
    const body = (request.body ?? {}) as Record<string, unknown>;
    const learnerId = typeof body.learnerId === "string" ? body.learnerId : "";
    const tutorKey = typeof body.tutorKey === "string" ? body.tutorKey : "";
    if (!learnerId || !tutorKey) {
      return reply.code(400).send({ error: "learnerId and tutorKey required" });
    }

    const def = getTutorDefinition(tutorKey);
    if (!def) return reply.code(404).send({ error: `unknown tutor "${tutorKey}"` });
    if (!def.toolset || !def.actionPolicy) {
      return reply.code(409).send({ error: `tutor "${tutorKey}" has no agent policy` });
    }

    const tenantId = await resolveTenantIdForLearner(request, db, learnerId);
    if (!tenantId) {
      return reply.code(400).send({ error: "Unable to resolve tenantId for learner" });
    }

    const brainContext = await deps.fetchBrainContext(learnerId);
    const requestedLevel =
      (typeof body.functioningLevel === "string" && body.functioningLevel) ||
      (brainContext as { functioning_level_profile?: { level?: string } })
        .functioning_level_profile?.level ||
      "STANDARD";
    const negotiated = negotiateFunctioningLevel(
      requestedLevel as TutorFunctioningLevel,
      def,
    );
    if (!negotiated) {
      return reply.code(409).send({ error: `tutor ${def.id} declares no functioning levels` });
    }

    const subject = String(def.subjects[0] ?? "math");
    try {
      const focus = await deps.getCurriculumFocus(learnerId, subject);
      if (focus) (brainContext as Record<string, unknown>).curriculum_focus = focus;
    } catch {
      // best-effort enrichment only
    }
    if (typeof body.gradeBand === "string" && body.gradeBand) {
      (brainContext as Record<string, unknown>).grade_band = body.gradeBand;
    }

    const deliveryLevel =
      (typeof body.deliveryLevel === "string" && body.deliveryLevel) ||
      (typeof body.gradeBand === "string" && body.gradeBand) ||
      "3";
    const lessonRunId = typeof body.lessonRunId === "string" ? body.lessonRunId : null;
    const agentState = initialAgentState({
      tutorKey,
      negotiatedLevel: negotiated,
      deliveryLevel,
      lessonRunId,
    });

    const [session] = await db
      .insert(tutorSessions)
      .values({
        tenantId,
        learnerId,
        tutorSku: TUTOR_KEY_TO_SKU[tutorKey] ?? `AGENT_${tutorKey.toUpperCase()}`,
        tutorName: def.persona.name,
        sessionType: "agent_lesson",
        functioningLevel: negotiated,
        brainContext,
        messages: [],
        agentState,
      })
      .returning();

    await emitTutorAudit({
      db,
      request,
      eventType: "TUTOR_AGENT_SESSION_OPENED",
      tenantId,
      learnerId,
      sessionId: session.id,
      details: { tutorKey, lessonRunId, functioningLevel: negotiated },
    });

    return {
      sessionId: session.id,
      tutorKey,
      tutorName: def.persona.name,
      negotiatedLevel: negotiated,
      rung: "full",
    };
  });

  // ── POST /api/tutor/agent/session/:sessionId/turn ─────────────────────
  app.post("/api/tutor/agent/session/:sessionId/turn", { schema: agentSessionTurnSchema }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const learnerId = typeof body.learnerId === "string" ? body.learnerId : "";
    const observation = parseObservation(body.observation);
    if (!learnerId || !observation) {
      return reply.code(400).send({ error: "learnerId and a valid observation are required" });
    }

    const result = await orchestrator.runTurn({
      sessionId,
      learnerId,
      observation,
      getDefinition: getTutorDefinition,
    });
    if ("error" in result) {
      return reply.code(result.status).send({ error: result.error });
    }
    return result;
  });

  // ── POST /api/tutor/agent/session/:sessionId/close ────────────────────
  app.post("/api/tutor/agent/session/:sessionId/close", { schema: agentSessionCloseSchema }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const [session] = await db
      .select()
      .from(tutorSessions)
      .where(and(eq(tutorSessions.id, sessionId), eq(tutorSessions.sessionType, "agent_lesson")));
    if (!session) return reply.code(404).send({ error: "Agent session not found" });
    if (session.completedAt) {
      return { status: "closed", sessionId, alreadyClosed: true };
    }
    const durationSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000),
    );
    await db
      .update(tutorSessions)
      .set({ completedAt: new Date(), durationSeconds })
      .where(eq(tutorSessions.id, sessionId));
    logger.info("agent session closed", {
      sessionId,
      durationSeconds,
      reason: typeof body.reason === "string" ? body.reason : "player_done",
    });
    return { status: "closed", sessionId, durationSeconds };
  });
}
