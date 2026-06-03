import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerOtelPlugin } from "@aivo/otel-bootstrap";
import { registerReportRoutes } from "./routes/reports.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "reports-svc");
  registerOtelPlugin(app, "reports-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "reports-svc" }));
  app.get("/health", async () => ({ status: "ok", service: "reports-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "reports-svc" });
  }
  registerReportRoutes(app);
  return app;
}
