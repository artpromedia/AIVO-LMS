import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerExportRoutes } from "./routes/exports.js";
import { registerDeletionRoutes } from "./routes/deletion-requests.js";
import { registerDpaRoutes } from "./routes/dpa.js";
import { registerRetentionRoutes } from "./routes/retention.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "data-governance-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "data-governance-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "data-governance-svc" });
  }
  registerExportRoutes(app);
  registerDeletionRoutes(app);
  registerDpaRoutes(app);
  registerRetentionRoutes(app);
  return app;
}
