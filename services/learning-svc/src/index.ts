import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger, registerObservabilityPlugin } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { registerHealthRoutes } from "./routes/health.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerSessionCoviewStreamRoutes } from "./routes/session-coview-stream.js";
import { registerAuthHook } from "./lib/tenant.js";
import { registerGovernanceRoutes } from "./routes/governance.js";

const logger = createLogger("learning-svc");
const PORT = parseInt(process.env.LEARNING_PORT || "3005", 10);

/**
 * Build the configured Fastify app without binding to a port. Exposed
 * so the api-client OpenAPI dump (`scripts/dump-openapi.mjs`) can mount
 * the same route surface and call `app.swagger()` without starting
 * background work or listening on a socket.
 */
export async function buildApp() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const app = Fastify({ logger: false });

  // Structured request logging + /metrics for Prometheus scrape (Supp A).
  registerObservabilityPlugin(app, "learning-svc");

  await app.register(cors, { origin: true, credentials: true });
  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Learning Service", version: "1.0.0" },
      servers: process.env.SWAGGER_SERVER_URL
        ? [{ url: process.env.SWAGGER_SERVER_URL }]
        : process.env.NODE_ENV === "production"
          ? []
          : [{ url: `http://localhost:${PORT}` }],
      components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      },
    },
  });
  await app.register(swaggerUI, { routePrefix: "/docs" });

  registerHealthRoutes(app);
  registerAuthHook(app);
  registerSessionRoutes(app, db);
  registerSessionCoviewStreamRoutes(app, db);
  registerGovernanceRoutes(app, db);

  return app;
}

async function start() {
  const app = await buildApp();
  await bootstrapOpsAlerts({ service: "learning-svc", app, beforeExit: () => app.close() });
  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Learning service listening on port ${PORT}`);
}

// Only auto-start when invoked as the entry module (not when imported
// by the api-client dump shim via `buildApp`).
const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();
if (isMain) {
  start().catch((err) => {
    logger.error(err, "Failed to start learning-svc");
    process.exit(1);
  });
}
