/**
 * Auto profile recommendation pipeline (Sprint 06).
 *
 * Exposes ``POST /api/tutor/recommendation-candidates`` — the client
 * sends a recent window of SurfaceScoreResult samples (typically the
 * lesson's last N responses) and the server returns deterministic
 * recommendation candidates derived via ``analyzeRecommendationSignals``.
 *
 * Strict no-demo behaviour: malformed payloads return 4xx, never a
 * fabricated recommendation. The route is stateless — persistence to
 * ``brain_recommendations`` is the caller's responsibility once a
 * parent approves a candidate.
 */

import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  analyzeRecommendationSignals,
  type RecommendationSignalSample,
} from "@aivo/scoring";

interface RecommendationCandidatesBody {
  learnerId: string;
  sessionId?: string;
  tutorKey?: string;
  samples: RecommendationSignalSample[];
  options?: {
    minSamples?: number;
    maxWindow?: number;
  };
}

function isValidSample(value: unknown): value is RecommendationSignalSample {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  if (typeof v.surfaceId !== "string" || v.surfaceId.length === 0) return false;
  if (typeof v.occurredAt !== "string" || v.occurredAt.length === 0) return false;
  if (!v.result || typeof v.result !== "object") return false;
  const r = v.result as Record<string, unknown>;
  if (typeof r.correct !== "boolean") return false;
  if (typeof r.score !== "number") return false;
  if (typeof r.mode !== "string") return false;
  return true;
}

export function registerTutorRecommendationCandidatesRoute(
  app: FastifyInstance,
): void {
  app.post<{ Body: RecommendationCandidatesBody }>(
    "/api/tutor/recommendation-candidates",
    async (
      req: FastifyRequest<{ Body: RecommendationCandidatesBody }>,
      reply: FastifyReply,
    ) => {
      const body = req.body ?? ({} as RecommendationCandidatesBody);
      if (!body.learnerId) {
        return reply.code(400).send({ error: "learnerId is required" });
      }
      if (!Array.isArray(body.samples)) {
        return reply.code(400).send({ error: "samples must be an array" });
      }
      if (body.samples.length > 200) {
        return reply.code(413).send({ error: "samples too large (max 200)" });
      }
      for (let i = 0; i < body.samples.length; i++) {
        if (!isValidSample(body.samples[i])) {
          return reply
            .code(422)
            .send({ error: `samples[${i}] is invalid` });
        }
      }

      const analysis = analyzeRecommendationSignals(body.samples, body.options);

      return reply.send({
        learnerId: body.learnerId,
        sessionId: body.sessionId,
        tutorKey: body.tutorKey,
        sampleCount: analysis.sampleCount,
        candidates: analysis.candidates,
      });
    },
  );
}
