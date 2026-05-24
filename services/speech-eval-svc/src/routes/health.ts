import { FastifyInstance } from "fastify";

const healthResponse = {
  type: "object",
  required: ["status", "service", "timestamp"],
  additionalProperties: true,
  properties: {
    status: { type: "string" },
    service: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
  },
} as const;

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "speech-eval-svc",
    timestamp: new Date().toISOString(),
  });
  app.get("/health", {
    schema: {
      tags: ["Health"],
      operationId: "speechEvalHealth",
      summary: "Service health probe (root)",
      response: { 200: healthResponse },
    },
  }, handler);
  app.get("/api/speech-eval/health", {
    schema: {
      tags: ["Health"],
      operationId: "speechEvalHealthApi",
      summary: "Service health probe",
      response: { 200: healthResponse },
    },
  }, handler);
}
