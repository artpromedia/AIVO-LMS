import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { InMemoryAuditStore, type AuditStore } from "./services/audit-store.js";
import { registerAuditEventRoutes } from "./routes/audit-events.js";
import { registerAuditReportRoutes } from "./routes/reports.js";
import { registerGovernanceRoutes } from "./routes/governance.js";

export interface BuildAppOptions {
  store?: AuditStore;
  skipAuth?: boolean;
  db?: import("@aivo/db").Database | null;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const store = options.store ?? new InMemoryAuditStore();
  const db = options.db !== undefined ? options.db : null;
  registerObservabilityPlugin(app, "audit-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "audit-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "audit-svc" });
  }
  registerAuditEventRoutes(app, store);
  registerAuditReportRoutes(app, store);
  registerGovernanceRoutes(app, db);
  return app;
}
