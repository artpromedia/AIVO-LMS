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
import { and, desc, eq, gt } from "drizzle-orm";
import {
  gradebookEntries,
  tutorSessions,
  tutorDecisionTraces,
  tutorSessionEvidence,
  tutorMemories,
} from "@aivo/db";
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
import { executeWriteTool, type WriteToolDeps } from "../agent/write-tools.js";
import { executeRememberTool, type MemoryDeps } from "../agent/memory.js";
import { getTutorDefinition } from "../modes/registry.js";
import { negotiateFunctioningLevel } from "../lib/learnerContext.js";
import { resolveTenantIdForLearner } from "../lib/tenant.js";
import { emitTutorAudit } from "../lib/audit.js";
import { loadDapeProfile } from "../lib/dape.js";
import { getActiveCurriculumFocus } from "./curriculum.js";
import { TUTOR_SKU_TO_KEY } from "./chat.js";
import {
  agentSessionOpenSchema,
  agentSessionTurnSchema,
  agentSessionCloseSchema,
  agentMemoriesListSchema,
  agentMemoryDeleteSchema,
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

/** S11 — ai-svc parent-summary composition. Null on ANY failure: the
 *  caller keeps its deterministic summary and the close never breaks. */
async function defaultComposeParentNote(
  payload: Record<string, unknown>,
): Promise<string | null> {
  try {
    const res = await fetch(`${AI_SVC_URL}/api/ai/tutor-agent/parent-summary`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Auth": INTERNAL_AI_TOKEN,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(2_500),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { summary?: string | null };
    return typeof body.summary === "string" && body.summary ? body.summary : null;
  } catch {
    return null;
  }
}

const RECOMMENDATION_SVC_URL = process.env.RECOMMENDATION_SVC_URL ?? "http://localhost:3066";

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Drizzle-backed write-tool deps (S11). */
export function makeWriteToolDeps(db: any): WriteToolDeps {
  return {
    async insertEvidence(row) {
      await db.insert(tutorSessionEvidence).values({
        tenantId: row.tenantId,
        sessionId: row.sessionId,
        learnerId: row.learnerId,
        skillId: row.skillId,
        kind: row.kind,
        note: row.note,
        masteryDelta: row.masteryDelta,
      });
    },
    async applySupplementalMastery(input) {
      // Supplemental means it NUDGES an existing assessment; it never
      // creates baseline truth. No gradebook row → evidence only.
      const [entry] = await db
        .select()
        .from(gradebookEntries)
        .where(
          and(
            eq(gradebookEntries.tenantId, input.tenantId),
            eq(gradebookEntries.learnerId, input.learnerId),
            eq(gradebookEntries.skill, input.skillId),
          ),
        );
      if (!entry) return;
      const next = clamp01((Number(entry.masteryScore) || 0) + input.delta);
      await db
        .update(gradebookEntries)
        .set({ masteryScore: next, updatedAt: new Date() })
        .where(eq(gradebookEntries.id, entry.id));
    },
    async proposeRecommendation(input) {
      const res = await fetch(`${RECOMMENDATION_SVC_URL}/api/recommendations/propose`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(2_500),
      });
      if (res.status === 201) {
        const body = (await res.json()) as { recommendation?: { id?: string } };
        return { id: body.recommendation?.id };
      }
      // Policy refusals come back as structured rejections the model can
      // learn from; anything else is transport trouble → throw → { error }.
      if (res.status === 403 || res.status === 409 || res.status === 422 || res.status === 429) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
        };
        return { rejected: body.error ?? `status_${res.status}`, detail: body.message ?? "" };
      }
      throw new Error(`recommendation-svc propose returned ${res.status}`);
    },
  };
}

/** Drizzle-backed memory deps (S12). */
export function makeMemoryDeps(db: any): MemoryDeps {
  return {
    async insertMemory(input) {
      await db.insert(tutorMemories).values({
        tenantId: input.tenantId,
        learnerId: input.learnerId,
        tutorKey: input.tutorKey,
        kind: input.kind,
        content: input.content,
        sourceSessionId: input.sessionId,
        expiresAt: input.expiresAt,
      });
    },
    async listMemories(input) {
      const rows = await db
        .select()
        .from(tutorMemories)
        .where(
          and(
            eq(tutorMemories.tenantId, input.tenantId),
            eq(tutorMemories.learnerId, input.learnerId),
            eq(tutorMemories.tutorKey, input.tutorKey),
            gt(tutorMemories.expiresAt, new Date()),
          ),
        )
        .orderBy(desc(tutorMemories.createdAt))
        .limit(input.k);
      return rows as Array<{
        id: string;
        kind: string;
        content: string;
        createdAt: Date;
        expiresAt: Date;
      }>;
    },
  };
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
  routeOpts: {
    /** S11 — injectable for tests; default calls ai-svc /parent-summary. */
    composeParentNote?: (payload: Record<string, unknown>) => Promise<string | null>;
  } = {},
): void {
  const composeParentNote = routeOpts.composeParentNote ?? defaultComposeParentNote;
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
    // Wave E (S11): write tools — evidence ledger + recommendation proposal.
    runWriteTool:
      depOverrides.runWriteTool ??
      ((name, args, ctx) => executeWriteTool(name, args, ctx, makeWriteToolDeps(db))),
    // Wave E (S12): episodic memory — write + top-k retrieval.
    runMemoryTool:
      depOverrides.runMemoryTool ??
      ((args, ctx) => executeRememberTool(args, ctx, makeMemoryDeps(db))),
    retrieveMemories:
      depOverrides.retrieveMemories ?? ((input) => makeMemoryDeps(db).listMemories(input)),
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
    // S13: Vigor branches on DAPE — load the profile like the chat path
    // does so the agent's context (and snapshot tool) carries it.
    if (tutorKey === "vigor") {
      try {
        const dapeProfile = await loadDapeProfile(db, learnerId);
        if (dapeProfile.active) {
          (brainContext as Record<string, unknown>).dape_profile = dapeProfile;
        }
      } catch {
        // best-effort enrichment only
      }
    }
    if (typeof body.gradeBand === "string" && body.gradeBand) {
      (brainContext as Record<string, unknown>).grade_band = body.gradeBand;
    }

    const deliveryLevel =
      (typeof body.deliveryLevel === "string" && body.deliveryLevel) ||
      (typeof body.gradeBand === "string" && body.gradeBand) ||
      "3";
    const lessonRunId = typeof body.lessonRunId === "string" ? body.lessonRunId : null;
    // S12: the BFF asserts ai_personalization consent before opening and
    // declares it here. Fail-closed: absent → no memory reads or writes.
    const consents = (body.consents ?? {}) as Record<string, unknown>;
    const agentState = initialAgentState({
      tutorKey,
      negotiatedLevel: negotiated,
      deliveryLevel,
      lessonRunId,
      aiPersonalizationConsent: consents.aiPersonalization === true,
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

    // S11 — agent-composed parent note. Only when the agent actually made
    // decisions; built from the decision-trace + evidence ledgers (counts
    // and kinds, never raw learner responses). Null on any failure: the
    // web summary stays purely deterministic.
    let parentNote: string | null = null;
    const agentState = (session.agentState ?? null) as AgentSessionState | null;
    if (agentState && agentState.seq > 0) {
      try {
        const traces = (await db
          .select()
          .from(tutorDecisionTraces)
          .where(eq(tutorDecisionTraces.sessionId, sessionId))) as Array<{
          seq: number;
          decision: string;
        }>;
        traces.sort((a, b) => a.seq - b.seq);
        const decisions = traces.map((t) => t.decision).slice(-40);
        const count = (prefix: string) =>
          decisions.filter((d) => d === `accepted:${prefix}`).length;
        const evidence = (await db
          .select()
          .from(tutorSessionEvidence)
          .where(eq(tutorSessionEvidence.sessionId, sessionId))) as Array<{
          note: string;
          skillId: string | null;
        }>;
        const num = (v: unknown) =>
          typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
        parentNote = await composeParentNote({
          tutor_key: agentState.tutorKey,
          tenant_id: session.tenantId,
          learner_id: session.learnerId,
          session_id: sessionId,
          learner_first_name:
            typeof body.learnerFirstName === "string" && body.learnerFirstName
              ? body.learnerFirstName.slice(0, 60)
              : "Your learner",
          digest: {
            beats_completed: num(body.beatsCompleted),
            checks_correct: num(body.checksCorrect),
            checks_total: num(body.checksTotal),
            scaffolds_inserted: count("insert_scaffold"),
            remediations: count("remediate"),
            breaks_taken: count("offer_break"),
            ended_early: decisions.includes("accepted:end_early"),
            focus_skills: [
              ...new Set(evidence.map((e) => e.skillId).filter((s): s is string => Boolean(s))),
            ].slice(0, 8),
            decisions,
            evidence_notes: evidence.map((e) => e.note).slice(0, 5),
          },
          delivery_level: agentState.deliveryLevel,
          functioning_level: agentState.negotiatedLevel,
          locale: typeof body.locale === "string" ? body.locale : undefined,
        });
      } catch (err) {
        request.log?.warn?.(
          { err: err instanceof Error ? err.message : String(err), sessionId },
          "agent parent-note composition failed (non-fatal)",
        );
      }
    }

    logger.info("agent session closed", {
      sessionId,
      durationSeconds,
      reason: typeof body.reason === "string" ? body.reason : "player_done",
      parentNote: parentNote ? "composed" : "none",
    });
    return { status: "closed", sessionId, durationSeconds, parentNote };
  });

  // ── S12: parent-facing memory surface (BFF-guarded) ────────────────────
  // GET    /api/tutor/agent/memories/:learnerId      — list unexpired rows
  // DELETE /api/tutor/agent/memories/:learnerId/:id  — parent delete
  app.get(
    "/api/tutor/agent/memories/:learnerId",
    { schema: agentMemoriesListSchema },
    async (request) => {
      const { learnerId } = request.params as { learnerId: string };
      const rows = await db
        .select()
        .from(tutorMemories)
        .where(
          and(eq(tutorMemories.learnerId, learnerId), gt(tutorMemories.expiresAt, new Date())),
        )
        .orderBy(desc(tutorMemories.createdAt))
        .limit(100);
      return {
        memories: (rows as Array<Record<string, unknown>>).map((r) => ({
          id: r.id,
          tutorKey: r.tutorKey,
          kind: r.kind,
          content: r.content,
          createdAt: r.createdAt,
          expiresAt: r.expiresAt,
        })),
      };
    },
  );

  app.delete(
    "/api/tutor/agent/memories/:learnerId/:memoryId",
    { schema: agentMemoryDeleteSchema },
    async (request, reply) => {
      const { learnerId, memoryId } = request.params as {
        learnerId: string;
        memoryId: string;
      };
      const deleted = await db
        .delete(tutorMemories)
        .where(and(eq(tutorMemories.id, memoryId), eq(tutorMemories.learnerId, learnerId)))
        .returning({ id: tutorMemories.id });
      if (!deleted || deleted.length === 0) {
        return reply.code(404).send({ error: "Memory not found" });
      }
      logger.info("tutor memory deleted by guardian surface", { learnerId, memoryId });
      return { deleted: true, id: memoryId };
    },
  );
}
