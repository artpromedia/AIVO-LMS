import type { FastifyInstance } from "fastify";
import { findSkillsByTopic } from "../services/skill-graph-store.js";
import type { Subject } from "../services/types.js";

export function registerSkillGraphRoutes(app: FastifyInstance): void {
  app.get<{ Querystring: { subject?: Subject; topic?: string } }>(
    "/api/subject-brain/skill-graph",
    async (request, reply) => {
      const subject = request.query?.subject;
      if (!subject) {
        return reply.code(400).send({ error: "subject is required" });
      }
      const skills = findSkillsByTopic(subject, request.query?.topic);
      return { skills };
    },
  );
}
