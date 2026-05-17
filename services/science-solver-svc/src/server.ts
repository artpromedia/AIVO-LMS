import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerAnalyzeRoutes } from "./routes/analyze.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "science-solver-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "science-solver-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "science-solver-svc" });
  }
  registerAnalyzeRoutes(app);
  return app;
}
