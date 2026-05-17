import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerSubjectContextRoutes } from "./routes/subject-context.js";
import { registerSkillGraphRoutes } from "./routes/skill-graph.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "subject-brain-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "subject-brain-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "subject-brain-svc" });
  }
  registerSubjectContextRoutes(app);
  registerSkillGraphRoutes(app);
  return app;
}
