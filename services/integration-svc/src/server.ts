import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { createDb, type Database } from "@aivo/db";
import { registerSisRoutes } from "./routes/sis.js";
import { registerLtiRoutes } from "./routes/lti.js";
import { registerConnectorRoutes } from "./routes/connectors.js";
import { registerHealthRoutes as registerConnectorHealthRoutes } from "./routes/connectors-health.js";
import { registerGovernanceRoutes } from "./routes/governance.js";
import { installAuditing } from "@aivo/audit-client";

export interface BuildAppOptions {
  skipAuth?: boolean;
  /**
   * Optional pre-built database handle. When omitted we lazily create one
   * using DATABASE_URL (or fall back to `null` for in-memory/test mode where
   * routes detect the absence and switch to mock storage).
   */
  db?: Database | null;
}

function resolveDb(input?: Database | null): Database | null {
  if (input !== undefined) return input;
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  try {
    return createDb(url);
  } catch {
    return null;
  }
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "integration-svc");
  await app.register(cors, { origin: true, credentials: true });
  // Auto-emit audit events for routes annotated with `audited(...)`
  // (SIS connect/disconnect/sync). No-ops when AUDIT_SVC_URL is unset.
  installAuditing(app, { defaultAllowlist: ["provider"] });
  app.get("/healthz", async () => ({ status: "ok", service: "integration-svc" }));

  const db = resolveDb(options.db);

  // SIS + LTI routes live behind the enterprise service-auth hook. The hook
  // is encapsulated in this child scope so it does NOT apply to the merged
  // connector routes, which authenticate per-route (and expose a public
  // waitlist) — preserving the behavior they had as a standalone service.
  await app.register(async (secured) => {
    if (!options.skipAuth) {
      registerEnterpriseAuthHook(secured, { sourceService: "integration-svc" });
    }
    registerSisRoutes(secured);
    registerLtiRoutes(secured, db);
  });

  // Merged from the former integrations-svc (Sprint 3 consolidation): SIS
  // connector catalogue + connection management. Self-authenticating.
  registerConnectorRoutes(app, db);
  registerConnectorHealthRoutes(app);

  // Sprint 5 governance subscribers (DSAR erase/export at /__governance/*).
  registerGovernanceRoutes(app, db);
  return app;
}
