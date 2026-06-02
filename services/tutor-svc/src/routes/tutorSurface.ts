/**
 * Tutor Surface beats route (Sprint 04).
 *
 * Exposes ``POST /api/tutor/:tutorKey/surface-beats`` — the lesson
 * stage entrypoint. The route runs the existing curriculum-driven
 * planner (``planSession``) against the tutor's starter content pack
 * (or a caller-supplied pack) and converts the result into the
 * surface-aware Beat[] the web/mobile runtime renders.
 *
 * No demo fallback: if planning fails or the pack is empty the route
 * returns a 4xx/5xx so the client can surface the real failure
 * instead of injecting hardcoded beats.
 */

import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  buildLearnerContext,
  isScaffoldAllowedByEnv,
  negotiateFunctioningLevel,
} from "../lib/learnerContext.js";
import { planSession, TutorPolicyError, type LearnerContext } from "@aivo/tutor-runtime";
import { getTutorDefinition } from "../modes/registry.js";
import { getStarterContentPack } from "../content-packs/index.js";
import { buildTutorSurfaceBeats } from "../lib/tutorSurfaceResponseNormalizer.js";

interface SurfaceBeatsBody {
  learnerId: string;
  functioningLevel?: string;
  maxActivities?: number;
  contentPack?: ReturnType<typeof getStarterContentPack>;
  masteryRecords?: LearnerContext["masteryRecords"];
  recentOutcomes?: LearnerContext["recentOutcomes"];
  recentlyCovered?: LearnerContext["recentlyCovered"];
  interestProfile?: LearnerContext["interestProfile"];
  /** Learner's grade band. See `POST /api/tutors/:tutorKey/plan`. */
  gradeBand?: string;
}

export function registerTutorSurfaceRoutes(app: FastifyInstance): void {
  app.post<{ Params: { tutorKey: string }; Body: SurfaceBeatsBody }>(
    "/api/tutor/:tutorKey/surface-beats",
    async (
      req: FastifyRequest<{ Params: { tutorKey: string }; Body: SurfaceBeatsBody }>,
      reply: FastifyReply,
    ) => {
      const { tutorKey } = req.params;
      const def = getTutorDefinition(tutorKey);
      if (!def) {
        return reply.code(404).send({ error: `unknown tutor "${tutorKey}"` });
      }
      const body = req.body ?? ({} as SurfaceBeatsBody);
      if (!body.learnerId) {
        return reply.code(400).send({ error: "learnerId is required" });
      }

      const contentPack = body.contentPack ?? getStarterContentPack(tutorKey);
      if (
        !contentPack ||
        !Array.isArray(contentPack.activities) ||
        contentPack.activities.length === 0
      ) {
        return reply.code(400).send({ error: `no content pack available for tutor "${tutorKey}"` });
      }

      const baseCtx = buildLearnerContext({
        learnerId: body.learnerId,
        functioningLevel: body.functioningLevel,
        masteryRecords: body.masteryRecords,
        recentOutcomes: body.recentOutcomes,
        recentlyCovered: body.recentlyCovered,
        interestProfile: body.interestProfile,
        gradeBand: body.gradeBand,
      });
      const negotiated = negotiateFunctioningLevel(baseCtx.functioningLevel, def);
      if (!negotiated) {
        return reply.code(400).send({
          error: `tutor ${def.id} declares no supported functioning levels`,
        });
      }
      const ctx: LearnerContext = { ...baseCtx, functioningLevel: negotiated };

      try {
        const plan = planSession(def, ctx, contentPack, {
          maxActivities: body.maxActivities ?? 6,
          allowScaffold: isScaffoldAllowedByEnv(),
        });
        const response = buildTutorSurfaceBeats(plan);
        return reply.send(response);
      } catch (err) {
        if (err instanceof TutorPolicyError) {
          if (err.code === "grade_band_not_production" || err.code === "grade_band_not_in_scope") {
            return reply.code(409).send({
              error: err.message,
              code: err.code,
              tutorKey,
              gradeBand: ctx.gradeBand,
              authoringInProgress: true,
            });
          }
          return reply.code(400).send({ error: err.message, code: err.code });
        }
        const message = err instanceof Error ? err.message : String(err);
        req.log?.error?.({ err }, "tutor.surface_beats_failed");
        return reply
          .code(500)
          .send({ error: "tutor surface beats generation failed", detail: message });
      }
    },
  );
}
