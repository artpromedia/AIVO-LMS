import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { RuleBasedMathRecognizer } from "./services/rule-based-recognizer.js";
import { registerRecognizeRoutes } from "./routes/recognize.js";
import type { MathRecognizerProvider } from "./services/provider-interface.js";

export interface BuildAppOptions {
  provider?: MathRecognizerProvider;
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const provider = options.provider ?? new RuleBasedMathRecognizer();
  registerObservabilityPlugin(app, "math-recognizer-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "math-recognizer-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "math-recognizer-svc" });
  }
  registerRecognizeRoutes(app, provider);
  return app;
}
