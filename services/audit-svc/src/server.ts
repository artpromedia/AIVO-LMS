import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { InMemoryAuditStore, type AuditStore } from "./services/audit-store.js";
import { InMemoryEventStore, type EventStore } from "./services/event-store.js";
import { registerAuditEventRoutes } from "./routes/audit-events.js";
import { registerAuditReportRoutes } from "./routes/reports.js";
import { registerEventRoutes } from "./routes/events.js";
import { registerGovernanceRoutes } from "./routes/governance.js";

export interface BuildAppOptions {
  store?: AuditStore;
  /** Sprint 3 canonical hash-chained event store (the `/events` surface). */
  eventStore?: EventStore;
  skipAuth?: boolean;
  db?: import("@aivo/db").Database | null;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const store = options.store ?? new InMemoryAuditStore();
  const eventStore = options.eventStore ?? new InMemoryEventStore();
  const db = options.db !== undefined ? options.db : null;
  registerObservabilityPlugin(app, "audit-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "audit-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { skipPaths: ["/healthz", "/health", "/metrics"] });
  }
  registerAuditEventRoutes(app, store);
  registerAuditReportRoutes(app, store);
  registerEventRoutes(app, eventStore);
  registerGovernanceRoutes(app, db);
  return app;
}
