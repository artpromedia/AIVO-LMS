import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import {
  InMemoryProblemSessionStore,
  type ProblemSessionStore,
} from "./services/problem-session-store.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerEventRoutes } from "./routes/events.js";

export interface BuildAppOptions {
  store?: ProblemSessionStore;
  /** When true, skip auth hook (used by unit tests). */
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const store = options.store ?? new InMemoryProblemSessionStore();

  registerObservabilityPlugin(app, "problem-session-svc");
  await app.register(cors, { origin: true, credentials: true });

  app.get("/healthz", async () => ({ status: "ok", service: "problem-session-svc" }));

  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "problem-session-svc" });
  }

  registerSessionRoutes(app, store);
  registerEventRoutes(app, store);

  return app;
}
