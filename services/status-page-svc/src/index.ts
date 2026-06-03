import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger } from "@aivo/observability";
import { registerOtelPlugin } from "@aivo/otel-bootstrap";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { registerHealthRoutes } from "./routes/health.js";
import { registerStatusRoutes } from "./routes/status.js";
import { registerOpsAlertsOutboxRoutes } from "./routes/ops-alerts-outbox.js";
import { registerComponentRoutes } from "./routes/components.js";
import { registerStatusIncidentRoutes } from "./routes/statuspage-incidents.js";
import { registerUpdateRoutes } from "./routes/updates.js";
import { registerMaintenanceRoutes } from "./routes/maintenances.js";
import { registerSubscriberRoutes } from "./routes/subscribers.js";
import { registerPublicSummaryRoutes } from "./routes/public-summary.js";

const logger = createLogger("status-page-svc");
const PORT = parseInt(process.env.STATUS_PAGE_SVC_PORT || "3014", 10);

export async function buildApp() {
  const app = Fastify({ logger: false });

  // W3C trace context + tenant_id baggage + structured logs (Sprint 8).
  registerOtelPlugin(app, "status-page-svc");

  await app.register(cors, { origin: true, credentials: true });
  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Status Page Service", version: "1.0.0" },
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
  registerStatusRoutes(app);
  registerOpsAlertsOutboxRoutes(app);
  // Status-page management + public summary (Sprint 8).
  registerComponentRoutes(app);
  registerStatusIncidentRoutes(app);
  registerUpdateRoutes(app);
  registerMaintenanceRoutes(app);
  registerSubscriberRoutes(app);
  registerPublicSummaryRoutes(app);

  return app;
}

async function start() {
  const app = await buildApp();
  await bootstrapOpsAlerts({ service: "status-page-svc", app, beforeExit: () => app.close() });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`AIVO Status Page Service listening on port ${PORT}`);
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
    console.error("Failed to start status-page-svc:", err);
    process.exit(1);
  });
}
