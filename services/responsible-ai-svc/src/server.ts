import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createDb } from "@aivo/db";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { initRegistryRepository } from "./registry/repository.js";
import { registerEvaluateRoutes } from "./routes/evaluate.js";
import { registerPolicyRoutes } from "./routes/policy.js";
import { registerModelRoutes } from "./routes/models.js";
import { registerPolicyRegistryRoutes } from "./routes/policies.js";
import { registerEvalRoutes } from "./routes/evals.js";
import { registerIncidentRoutes } from "./routes/incidents.js";
import { registerUsageRoutes } from "./routes/usage.js";
import { registerOptOutRoutes } from "./routes/optouts.js";
import { impWriteAllowlist } from "./auth/imp-write-allowlist.js";
import { emitImpersonationRequestAudit } from "./lib/impersonation-audit.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
  /** Inject a drizzle client; defaults to DATABASE_URL-backed Postgres. */
  db?: unknown | null;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "responsible-ai-svc");
  await app.register(cors, { origin: true, credentials: true });

  // Registry persistence: Postgres in production (DATABASE_URL), seeded
  // in-memory for tests/local dev. selectRegistryRepository() throws if a
  // production deploy is missing the database client.
  const db = options.db ?? (process.env.DATABASE_URL ? createDb(process.env.DATABASE_URL) : null);
  initRegistryRepository(db);

  app.get("/healthz", async () => ({ status: "ok", service: "responsible-ai-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, {
      sourceService: "responsible-ai-svc",
      // Sprint 9: enforce the impersonation write allowlist + audit every
      // request issued under a "View As" session.
      impWriteAllowlist,
      onImpersonatedRequest: (event) => emitImpersonationRequestAudit(event),
    });
  }
  registerEvaluateRoutes(app);
  registerPolicyRoutes(app);
  // Responsible AI Console (Sprint 7).
  registerModelRoutes(app);
  registerPolicyRegistryRoutes(app);
  registerEvalRoutes(app);
  registerIncidentRoutes(app);
  registerUsageRoutes(app);
  registerOptOutRoutes(app);
  return app;
}
