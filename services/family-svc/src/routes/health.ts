import { FastifyInstance } from "fastify";
import { familyHealthRootSchema, getHealth2Schema } from "./schemas.js";

export async function registerHealthRoutes(app: FastifyInstance) {
  const handler = async () => ({
    status: "ok",
    service: "family-svc",
    timestamp: new Date().toISOString(),
  });
  app.get("/health", { schema: familyHealthRootSchema }, handler);
  app.get("/api/family/health", { schema: getHealth2Schema }, handler);
}
