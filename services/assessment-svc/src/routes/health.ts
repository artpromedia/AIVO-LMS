import { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "healthy",
    service: "assessment-svc",
    timestamp: new Date().toISOString(),
  });
  app.get("/health", { schema: { tags: ["Health"] } }, handler);
  app.get("/api/assessments/health", { schema: { tags: ["Health"] } }, handler);
}
