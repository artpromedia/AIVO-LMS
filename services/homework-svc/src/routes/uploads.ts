import type { FastifyInstance } from "fastify";
import {
  defaultHomeworkOcrProvider,
  type HomeworkOcrProvider,
  type OcrExtractInput,
} from "../services/homework-ocr.js";

export function registerUploadRoutes(
  app: FastifyInstance,
  provider: HomeworkOcrProvider = defaultHomeworkOcrProvider,
): void {
  app.post<{ Params: { id: string }; Body: OcrExtractInput }>(
    "/api/homework-sessions/:id/upload",
    async (request, reply) => {
      const body = request.body;
      if (!body || !body.mimeType || !body.learnerId) {
        return reply.code(400).send({ error: "mimeType and learnerId are required" });
      }
      const result = await provider.extract(body);
      return reply.send(result);
    },
  );

  app.post<{ Params: { id: string }; Body: OcrExtractInput }>(
    "/api/homework-sessions/:id/extract",
    async (request, reply) => {
      const body = request.body;
      if (!body) {
        return reply.code(400).send({ error: "Missing body" });
      }
      const result = await provider.extract(body);
      return reply.send(result);
    },
  );
}
