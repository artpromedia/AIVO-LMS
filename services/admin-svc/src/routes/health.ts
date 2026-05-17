import { FastifyInstance } from "fastify";
import { adminHealthRootSchema, getAdminSvcHealthSchema } from "./schemas.js";

export function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "admin-svc",
    timestamp: new Date().toISOString(),
  });
  app.get("/health", { schema: adminHealthRootSchema }, handler);
  app.get("/api/admin-svc/health", { schema: getAdminSvcHealthSchema }, handler);
}
