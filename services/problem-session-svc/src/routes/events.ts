import type { FastifyInstance } from "fastify";
import {
  ProblemSessionNotFoundError,
  type ProblemSessionStore,
} from "../services/problem-session-store.js";
import { isLearningEventType } from "@aivo/events";

interface AppendEventBody {
  eventType: string;
  payload?: Record<string, unknown>;
}

export function registerEventRoutes(app: FastifyInstance, store: ProblemSessionStore): void {
  app.post<{
    Params: { id: string };
    Body: AppendEventBody;
  }>("/api/problem-sessions/:id/events", async (request, reply) => {
    const body = request.body ?? ({} as AppendEventBody);
    if (!body.eventType || typeof body.eventType !== "string") {
      return reply.code(400).send({ error: "eventType is required" });
    }
    if (!isLearningEventType(body.eventType)) {
      return reply.code(400).send({ error: `Unknown eventType: ${body.eventType}` });
    }
    try {
      const event = await store.appendEvent({
        problemSessionId: request.params.id,
        eventType: body.eventType,
        payload: body.payload,
      });
      return reply.code(201).send(event);
    } catch (error) {
      if (error instanceof ProblemSessionNotFoundError) {
        return reply.code(404).send({ error: "Not found" });
      }
      throw error;
    }
  });
}
