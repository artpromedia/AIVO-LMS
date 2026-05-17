import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import { registerEnterpriseAuthHook } from "@aivo/enterprise-core";
import { registerObservabilityPlugin } from "@aivo/observability";
import { registerDistrictRoutes } from "./routes/districts.js";
import { registerSchoolRoutes } from "./routes/schools.js";
import { registerClassRoutes } from "./routes/classes.js";
import { registerRosterRoutes } from "./routes/rosters.js";

export interface BuildAppOptions {
  skipAuth?: boolean;
}

export async function buildApp(options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  registerObservabilityPlugin(app, "tenant-svc");
  await app.register(cors, { origin: true, credentials: true });
  app.get("/healthz", async () => ({ status: "ok", service: "tenant-svc" }));
  if (!options.skipAuth) {
    registerEnterpriseAuthHook(app, { sourceService: "tenant-svc" });
  }
  registerDistrictRoutes(app);
  registerSchoolRoutes(app);
  registerClassRoutes(app);
  registerRosterRoutes(app);
  return app;
}
