import type { FastifyInstance } from "fastify";
import { buildSubjectContext } from "../services/index.js";
import type { SubjectContextRequest } from "../services/types.js";

export function registerSubjectContextRoutes(app: FastifyInstance): void {
  app.post<{ Body: SubjectContextRequest }>(
    "/api/subject-brain/context",
    async (request, reply) => {
      const body = request.body;
      if (!body || !body.learnerId || !body.subject) {
        return reply.code(400).send({ error: "learnerId and subject are required" });
      }
      const result = buildSubjectContext(body);
      if (!result) {
        return reply.code(400).send({ error: `Unsupported subject: ${body.subject}` });
      }
      return result;
    },
  );
}
