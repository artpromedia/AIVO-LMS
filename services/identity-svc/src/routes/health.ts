import { FastifyInstance } from "fastify";

export async function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "healthy",
    service: "identity-svc",
    timestamp: new Date().toISOString(),
  });
  const schema = {
    tags: ["Health"],
    response: { 200: { type: "object", properties: { status: { type: "string" }, service: { type: "string" }, timestamp: { type: "string" } } } },
  };
  app.get("/health", { schema }, handler);
  app.get("/api/auth/health", { schema }, handler);
}
