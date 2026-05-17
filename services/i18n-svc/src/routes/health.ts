import { FastifyInstance } from "fastify";
import { healthSchema } from "./schemas.js";

  export function registerHealthRoutes(app: FastifyInstance) {
    app.get("/api/i18n/health", { schema: healthSchema }, async () => ({
      status: "ok",
      service: "i18n-svc",
      timestamp: new Date().toISOString(),
    }));
  }
  