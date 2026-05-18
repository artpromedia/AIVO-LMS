import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { createDb } from "@aivo/db";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerExportRoutes } from "./routes/exports.js";
import { registerDeletionRoutes } from "./routes/deletion-requests.js";
import { initDpaStoreFromDb, registerDpaRoutes } from "./routes/dpa.js";
import { registerRetentionRoutes } from "./routes/retention.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
  /** Optional drizzle client. Pass to wire the Postgres-backed DPA
   *  store; omit to fall back to the in-memory store (allowed only
   *  outside production — see selectDpaStore for the fail-closed
   *  policy). */
  db?: any;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "data-governance-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "data-governance-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "data-governance-svc" });
  }

  // Pick the DPA store implementation. Production uses Postgres (records
  // must survive restart and remain queryable for compliance audits);
  // tests and local dev tolerate the in-memory store.
  const db = options.db ?? (process.env.DATABASE_URL ? createDb(process.env.DATABASE_URL) : null);
  initDpaStoreFromDb(db);

  registerExportRoutes(app);
  registerDeletionRoutes(app);
  registerDpaRoutes(app);
  registerRetentionRoutes(app);
  return app;
}
