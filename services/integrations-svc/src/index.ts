import Fastify from "fastify";
  import cors from "@fastify/cors";
  import swagger from "@fastify/swagger";
  import swaggerUI from "@fastify/swagger-ui";
  import { createLogger } from "@aivo/observability";
  import { createDb } from "@aivo/db";
  import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
  import {
    startSafeCron,
    createDrizzleAdvisoryLock,
    createDrizzleLedger,
  } from "@aivo/scheduling";
  import { runConnectorSyncWatchdogOnce } from "./lib/connector-sync-watchdog.js";
  import { registerHealthRoutes } from "./routes/health.js";
  import { registerConnectorRoutes } from "./routes/connectors.js";

  const logger = createLogger("integrations-svc");
  const PORT = parseInt(process.env.INTEGRATIONS_SVC_PORT || "3012", 10);

  export async function buildApp(db = createDb(process.env.DATABASE_URL ?? "")) {
    const app = Fastify({ logger: false });

    await app.register(cors, { origin: true, credentials: true });
    await app.register(swagger, {
      openapi: {
        info: { title: "AIVO Integrations Service", version: "1.0.0" },
        servers: process.env.SWAGGER_SERVER_URL
          ? [{ url: process.env.SWAGGER_SERVER_URL }]
          : (process.env.NODE_ENV === "production" ? [] : [{ url: `http://localhost:${PORT}` }]),
        components: {
          securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
        },
      },
    });
    await app.register(swaggerUI, { routePrefix: "/docs" });

    registerHealthRoutes(app);
    registerConnectorRoutes(app, db);

    return app;
  }

  async function start() {
    const db = createDb(process.env.DATABASE_URL ?? "");
    const app = await buildApp(db);

    await bootstrapOpsAlerts({ service: "integrations-svc", app, beforeExit: () => app.close() });

    startSafeCron({
      jobName: "integrations.connector-sync-watchdog",
      lock: createDrizzleAdvisoryLock(db as any),
      ledger: createDrizzleLedger(db as any),
      log: logger,
      run: () => runConnectorSyncWatchdogOnce(db),
    });

    await app.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(`AIVO Integrations Service listening on port ${PORT}`);
  }

  const isMain = (() => {
    try {
      return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
    } catch { return false; }
  })();
  if (isMain) {
    start().catch((err) => {
      console.error("Failed to start integrations-svc:", err);
      process.exit(1);
    });
  }
  