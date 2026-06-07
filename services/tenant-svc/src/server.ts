import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { installAuditing } from "@aivo/audit-client";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { registerDistrictRoutes } from "./routes/districts.js";
import { registerSchoolRoutes } from "./routes/schools.js";
import { registerClassRoutes } from "./routes/classes.js";
import { registerRosterRoutes } from "./routes/rosters.js";
import { registerGovernanceRoutes } from "./routes/governance.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
  db?: any;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "tenant-svc");
  installAuditing(app, {
    defaultAllowlist: ["tenantId", "name", "externalId", "role"],
  });
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "tenant-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "tenant-svc" });
  }
  const db = options.db ?? (process.env.DATABASE_URL ? createDb(process.env.DATABASE_URL) : null);
  if (!db && process.env.NODE_ENV === "production") {
    throw new Error("tenant-svc: DATABASE_URL is required in production; process-local authority stores are forbidden");
  }
  registerDistrictRoutes(app, db);
  registerSchoolRoutes(app, db);
  registerClassRoutes(app, db);
  registerRosterRoutes(app, db);
  registerGovernanceRoutes(app, db);
  return app;
}
