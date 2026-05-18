import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  initialStepState,
  nextStep,
  type HomeworkStepState,
} from "../services/homework-step-engine.js";
import {
  adaptHomeworkForProfile,
  type HomeworkProfile,
} from "../services/homework-profile-adapter.js";
import { observeFocus, type FocusSignals } from "../services/focus-monitor.js";
import { recommendSelfRegulationPrompt } from "../services/self-regulation-recommender.js";
import { emitHomeworkAudit } from "../lib/audit.js";

interface HomeworkSessionRecord {
  id: string;
  learnerId: string;
  tenantId: string;
  subject: string;
  topic?: string;
  profile?: HomeworkProfile;
  adaptation?: ReturnType<typeof adaptHomeworkForProfile>;
  stepState: HomeworkStepState;
  events: Array<{ at: string; eventType: string }>;
  problems: Array<{ id: string; prompt: string }>;
}

const SESSIONS = new Map<string, HomeworkSessionRecord>();

function requireSession(id: string): HomeworkSessionRecord {
  const session = SESSIONS.get(id);
  if (!session) {
    const error = new Error(`Homework session not found: ${id}`);
    (error as Error & { status?: number }).status = 404;
    throw error;
  }
  return session;
}

export function registerHomeworkSessionRoutes(app: FastifyInstance): void {
  app.post<{
    Body: {
      learnerId: string;
      tenantId: string;
      subject: string;
      topic?: string;
      profile?: HomeworkProfile;
    };
  }>("/api/homework-sessions", async (request, reply) => {
    const body = request.body;
    if (!body?.learnerId || !body?.tenantId || !body?.subject) {
      return reply.code(400).send({ error: "learnerId, tenantId, subject are required" });
    }
    const adaptation = body.profile
      ? adaptHomeworkForProfile(body.subject, body.topic, body.profile)
      : undefined;
    const session: HomeworkSessionRecord = {
      id: randomUUID(),
      learnerId: body.learnerId,
      tenantId: body.tenantId,
      subject: body.subject,
      topic: body.topic,
      profile: body.profile,
      adaptation,
      stepState: initialStepState(),
      events: [],
      problems: [],
    };
    SESSIONS.set(session.id, session);
    await emitHomeworkAudit({
      request,
      eventType: "HOMEWORK_SESSION_STARTED",
      tenantId: body.tenantId,
      learnerId: body.learnerId,
      resourceId: session.id,
      details: { subject: body.subject, topic: body.topic },
    });
    return reply.code(201).send(session);
  });

  app.post<{ Params: { id: string } }>(
    "/api/homework-sessions/:id/step",
    async (request, reply) => {
      try {
        const session = requireSession(request.params.id);
        session.stepState = nextStep(session.stepState);
        session.events.push({ at: new Date().toISOString(), eventType: "step_advance" });
        return reply.send({ stepState: session.stepState });
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          return reply.code(404).send({ error: "Not found" });
        }
        throw error;
      }
    },
  );

  app.post<{
    Params: { id: string };
    Body: { signals: FocusSignals };
  }>("/api/homework-sessions/:id/focus-check", async (request, reply) => {
    try {
      const session = requireSession(request.params.id);
      const observation = observeFocus(request.body?.signals ?? {});
      const regulation = recommendSelfRegulationPrompt(
        observation,
        session.adaptation?.uiAdjustments ?? {},
      );
      return reply.send({ observation, regulation });
    } catch (error) {
      if ((error as { status?: number }).status === 404) {
        return reply.code(404).send({ error: "Not found" });
      }
      throw error;
    }
  });

  app.post<{ Params: { id: string } }>(
    "/api/homework-sessions/:id/complete",
    async (request, reply) => {
      try {
        const session = requireSession(request.params.id);
        session.stepState = { currentStep: "complete", history: [...session.stepState.history] };
        return reply.send({ stepState: session.stepState });
      } catch (error) {
        if ((error as { status?: number }).status === 404) {
          return reply.code(404).send({ error: "Not found" });
        }
        throw error;
      }
    },
  );

  app.get<{ Params: { learnerId: string } }>(
    "/api/homework-sessions/learner/:learnerId/recent",
    async (request) => {
      const sessions = Array.from(SESSIONS.values()).filter(
        (s) => s.learnerId === request.params.learnerId,
      );
      return { sessions };
    },
  );
}

export function clearHomeworkSessionsForTest(): void {
  SESSIONS.clear();
}

export function getHomeworkSessionForTest(id: string): HomeworkSessionRecord | undefined {
  return SESSIONS.get(id);
}

export function setProblemsForTest(
  id: string,
  problems: Array<{ id: string; prompt: string }>,
): void {
  const session = requireSession(id);
  session.problems = problems;
}
