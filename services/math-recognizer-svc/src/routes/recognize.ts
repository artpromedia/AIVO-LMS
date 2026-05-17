import type { FastifyInstance } from "fastify";
import type { MathRecognizerProvider, RecognizeInput } from "../services/provider-interface.js";

export function registerRecognizeRoutes(
  app: FastifyInstance,
  provider: MathRecognizerProvider,
): void {
  app.post<{ Body: RecognizeInput }>("/api/math-recognizer/recognize", async (request, reply) => {
    const body = request.body;
    if (!body || !body.learnerId || body.subject !== "math") {
      return reply.code(400).send({ error: "learnerId and subject='math' are required" });
    }
    const result = await provider.recognize(body);
    return result;
  });
}
