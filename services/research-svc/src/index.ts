import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { registerHealthRoutes } from "./routes/health.js";
import { registerAnalyticsRoutes } from "./routes/analytics.js";

const logger = createLogger("research-svc");
const PORT = parseInt(process.env.RESEARCH_SVC_PORT || "3015", 10);

export async function buildApp() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Research Service", version: "1.0.0" },
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
  registerAnalyticsRoutes(app, db);

  return app;
}

async function start() {
  const app = await buildApp();
  await bootstrapOpsAlerts({ service: "research-svc", app, beforeExit: () => app.close() });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`AIVO Research Service listening on port ${PORT}`);
}

const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();
if (isMain) {
  start().catch((err) => {
    console.error("Failed to start research-svc:", err);
    process.exit(1);
  });
}
