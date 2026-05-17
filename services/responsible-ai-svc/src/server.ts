import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerEvaluateRoutes } from "./routes/evaluate.js";
import { registerPolicyRoutes } from "./routes/policy.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "responsible-ai-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "responsible-ai-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "responsible-ai-svc" });
  }
  registerEvaluateRoutes(app);
  registerPolicyRoutes(app);
  return app;
}
