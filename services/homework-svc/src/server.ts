import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerHomeworkSessionRoutes } from "./routes/homework-sessions.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { defaultHomeworkOcrProvider, type HomeworkOcrProvider } from "./services/homework-ocr.js";

export interface BuildAppOptions {
  ocrProvider?: HomeworkOcrProvider;
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "homework-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "homework-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "homework-svc" });
  }
  registerHomeworkSessionRoutes(app);
  registerUploadRoutes(app, options.ocrProvider ?? defaultHomeworkOcrProvider);
  return app;
}
