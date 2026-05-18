/**
 * Tutor surface-response submit route (Sprint 05).
 *
 * Exposes ``POST /api/tutor/surface-submit`` — invoked by the lesson
 * stage every time a learner submits a Learner Surface (choice grid,
 * scratchpad, geometry workspace, etc.). It runs the surface's
 * declared scoring spec through ``@aivo/scoring.scoreSurfaceResponse``
 * and returns a strict, no-demo grading result.
 *
 * No fallbacks: if the surface spec or response is malformed the
 * route returns 4xx so the client can surface the real failure.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { scoreSurfaceResponse, type SurfaceScoringSpec } from "@aivo/scoring";

interface SurfaceSubmitBody {
  learnerId: string;
  sessionId?: string;
  tutorKey?: string;
  surface: {
    id: string;
    type?: string;
    scoring: SurfaceScoringSpec;
  };
  response: {
    surfaceId: string;
    answer?: string | number | boolean;
    selectedChoiceId?: string;
    inkStrokes?: unknown[];
    geometryActions?: unknown[];
    durationMs?: number;
    rubricScores?: Record<string, number>;
  };
}

function isValidScoringSpec(spec: unknown): spec is SurfaceScoringSpec {
  if (!spec || typeof spec !== "object") return false;
  const mode = (spec as { mode?: unknown }).mode;
  return mode === "exact" || mode === "rubric" || mode === "process" || mode === "hybrid";
}

export function registerTutorSurfaceSubmitRoute(app: FastifyInstance): void {
  app.post<{ Body: SurfaceSubmitBody }>(
    "/api/tutor/surface-submit",
    async (req: FastifyRequest<{ Body: SurfaceSubmitBody }>, reply: FastifyReply) => {
      const body = req.body ?? ({} as SurfaceSubmitBody);
      if (!body.learnerId) {
        return reply.code(400).send({ error: "learnerId is required" });
      }
      if (!body.surface || typeof body.surface !== "object" || !body.surface.id) {
        return reply.code(400).send({ error: "surface is required" });
      }
      if (!isValidScoringSpec(body.surface.scoring)) {
        return reply.code(422).send({ error: "surface.scoring is invalid" });
      }
      if (!body.response || typeof body.response !== "object") {
        return reply.code(400).send({ error: "response is required" });
      }
      if (body.response.surfaceId !== body.surface.id) {
        return reply.code(422).send({ error: "response.surfaceId does not match surface.id" });
      }

      const result = scoreSurfaceResponse(body.surface.scoring, {
        surfaceId: body.response.surfaceId,
        answer: body.response.answer,
        selectedChoiceId: body.response.selectedChoiceId,
        inkStrokes: body.response.inkStrokes,
        geometryActions: body.response.geometryActions,
        durationMs: body.response.durationMs,
        rubricScores: body.response.rubricScores,
      });

      return reply.send({
        surfaceId: body.surface.id,
        learnerId: body.learnerId,
        sessionId: body.sessionId ?? null,
        tutorKey: body.tutorKey ?? null,
        ...result,
      });
    },
  );
}
