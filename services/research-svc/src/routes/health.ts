import { FastifyInstance } from "fastify";
import { healthSchema } from "./schemas.js";

  export function registerHealthRoutes(app: FastifyInstance) {
    const handler = async () => ({
      status: "ok",
      service: "research-svc",
      timestamp: new Date().toISOString(),
    });
    app.get("/api/research/health", { schema: healthSchema }, handler);
    // K8s probe alias
    app.get("/health", handler);
  }
