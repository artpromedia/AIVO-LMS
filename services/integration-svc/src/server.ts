import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { createDb, type Database } from "@aivo/db";
import { registerSisRoutes } from "./routes/sis.js";
import { registerLtiRoutes } from "./routes/lti.js";
import { registerConnectorRoutes } from "./routes/connectors.js";
import { registerHealthRoutes as registerConnectorHealthRoutes } from "./routes/connectors-health.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
  /**
   * Drizzle handle for LTI 1.3 runtime persistence. Defaults to a pool built
   * from DATABASE_URL when that is set; pass `null` to run the LTI routes in
   * stateless verify-and-redirect mode (used by the self-contained unit
   * tests). In production DATABASE_URL must be set so launches persist.
   */
  db?: Database | null;
}

const IS_PROD = process.env.NODE_ENV === "production";

function resolveDb(opt: BuildAppOptions["db"]): Database | undefined {
  if (opt === null) return undefined;
  if (opt) return opt;
  const url = process.env.DATABASE_URL;
  if (url) return createDb(url);
  if (IS_PROD) {
    throw new Error(
      "integration-svc: DATABASE_URL must be set in production so LTI 1.3 " +
        "launches persist (migration 0045 tables).",
    );
  }
  return undefined;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "integration-svc");
  await app.register(cors, { origin: true, credentials: true });
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
  return app;
}
