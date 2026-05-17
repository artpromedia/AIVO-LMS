import type { FastifyInstance } from "fastify";
import { emitAuditEvent } from "@aivo/audit-svc";
import type { ProblemSessionStore } from "../services/problem-session-store.js";
import { ProblemSessionNotFoundError } from "../services/problem-session-store.js";
import { countEventTypes, summarizeAttempts } from "../services/problem-session-scoring.js";
import { maybeEmitRecommendationSignals } from "../services/recommendation-signal-emitter.js";

interface CreateSessionBody {
  tenantId: string;
  learnerId: string;
  subject: string;
  skillCode?: string;
  standardCode?: string;
  source: "baseline" | "lesson" | "homework" | "tutor_chat" | "practice";
  sourceSessionId?: string;
  tutorSku?: string;
  metadata?: Record<string, unknown>;
}

interface AppendAttemptBody {
  response: Record<string, unknown>;
  correct: boolean;
  score?: number;
  latencyMs?: number;
  hintCount?: number;
  eraserCount?: number;
  toolChangeCount?: number;
}

interface AppendSnapshotBody {
  surfaceId: string;
  snapshotType: "ink" | "diagram" | "annotation" | "text" | "answer";
  snapshot: Record<string, unknown>;
  storageUrl?: string;
  strokeCount?: number;
}

const REQUIRED_CREATE_FIELDS: (keyof CreateSessionBody)[] = [
  "tenantId",
  "learnerId",
  "subject",
  "source",
];

export function registerSessionRoutes(app: FastifyInstance, store: ProblemSessionStore): void {
  app.post<{ Body: CreateSessionBody }>("/api/problem-sessions", async (request, reply) => {
    const body = request.body ?? ({} as CreateSessionBody);
    for (const field of REQUIRED_CREATE_FIELDS) {
      if (!body[field] || typeof body[field] !== "string") {
        return reply.code(400).send({ error: `Missing required field: ${field}` });
      }
    }
    const session = await store.createSession({
      tenantId: body.tenantId,
      learnerId: body.learnerId,
      subject: body.subject,
      skillCode: body.skillCode,
      standardCode: body.standardCode,
      source: body.source,
      sourceSessionId: body.sourceSessionId,
      tutorSku: body.tutorSku,
      metadata: body.metadata,
    });
    return reply.code(201).send(session);
  });

  app.get<{ Params: { id: string } }>("/api/problem-sessions/:id", async (request, reply) => {
    const session = await store.getSession(request.params.id);
    if (!session) return reply.code(404).send({ error: "Not found" });
    const [events, attempts, snapshots] = await Promise.all([
      store.listEventsForSession(session.id),
      store.listAttemptsForSession(session.id),
      store.listSnapshotsForSession(session.id),
    ]);
    return {
      session,
      events,
      attempts,
      snapshots,
      summary: {
        attempts: summarizeAttempts(attempts),
        eventCounts: countEventTypes(events),
      },
    };
  });

  app.post<{
    Params: { id: string };
    Body: AppendAttemptBody;
  }>("/api/problem-sessions/:id/attempts", async (request, reply) => {
    try {
      const attempt = await store.appendAttempt({
        problemSessionId: request.params.id,
        response: request.body?.response ?? {},
        correct: Boolean(request.body?.correct),
        score: request.body?.score,
        latencyMs: request.body?.latencyMs,
        hintCount: request.body?.hintCount,
        eraserCount: request.body?.eraserCount,
        toolChangeCount: request.body?.toolChangeCount,
      });
      return reply.code(201).send(attempt);
    } catch (error) {
      if (error instanceof ProblemSessionNotFoundError) {
        return reply.code(404).send({ error: "Not found" });
      }
      throw error;
    }
  });

  app.post<{
    Params: { id: string };
    Body: AppendSnapshotBody;
  }>("/api/problem-sessions/:id/snapshots", async (request, reply) => {
    if (!request.body?.surfaceId || !request.body?.snapshotType) {
      return reply.code(400).send({ error: "surfaceId and snapshotType are required" });
    }
    try {
      const snapshot = await store.appendSnapshot({
        problemSessionId: request.params.id,
        surfaceId: request.body.surfaceId,
        snapshotType: request.body.snapshotType,
        snapshot: request.body.snapshot ?? {},
        storageUrl: request.body.storageUrl,
        strokeCount: request.body.strokeCount,
      });
      // Sprint 09: audit emission for snapshot saves.
      void emitAuditEvent({
        actorRole: "service",
        action: "problem_session_snapshot_saved",
        resourceType: "problem_session_snapshot",
        resourceId: snapshot.id,
        metadata: {
          problemSessionId: snapshot.problemSessionId,
          surfaceId: snapshot.surfaceId,
          snapshotType: snapshot.snapshotType,
          strokeCount: snapshot.strokeCount,
        },
      });
      return reply.code(201).send(snapshot);
    } catch (error) {
      if (error instanceof ProblemSessionNotFoundError) {
        return reply.code(404).send({ error: "Not found" });
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>(
    "/api/problem-sessions/:id/complete",
    async (request, reply) => {
      const session = await store.completeSession(request.params.id);
      if (!session) return reply.code(404).send({ error: "Not found" });
      // Sprint 07: trigger recommendation candidate generation from
      // accumulated session signals. Flag-gated; fire-and-forget.
      void maybeEmitRecommendationSignals(store, session.id);
      return session;
    },
  );

  app.get<{ Params: { learnerId: string }; Querystring: { limit?: string } }>(
    "/api/problem-sessions/learner/:learnerId/recent",
    async (request) => {
      const limit = request.query?.limit ? Math.min(Number(request.query.limit), 100) : 20;
      const sessions = await store.listRecentForLearner(request.params.learnerId, limit);
      return { sessions };
    },
  );
}
