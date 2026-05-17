import Fastify from "fastify";
  import cors from "@fastify/cors";
  import swagger from "@fastify/swagger";
  import swaggerUI from "@fastify/swagger-ui";
  import { createLogger } from "@aivo/observability";
  import { createDb } from "@aivo/db";
  import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
  import { registerHealthRoutes } from "./routes/health.js";
  import { registerTranslationRoutes } from "./routes/translations.js";

  const logger = createLogger("i18n-svc");
  const PORT = parseInt(process.env.I18N_SVC_PORT || "3011", 10);

  export async function buildApp() {
    const db = createDb(process.env.DATABASE_URL ?? "");
    const app = Fastify({ logger: false });

    await app.register(cors, { origin: true, credentials: true });
    await app.register(swagger, {
      openapi: {
        info: { title: "AIVO Internationalization Service", version: "1.0.0" },
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
    registerTranslationRoutes(app, db);

    return app;
  }

  async function start() {
    const app = await buildApp();
    await bootstrapOpsAlerts({ service: "i18n-svc", app, beforeExit: () => app.close() });

    await app.listen({ port: PORT, host: "0.0.0.0" });
    logger.info(`AIVO Internationalization Service listening on port ${PORT}`);
  }

  const isMain = (() => {
    try {
      return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
    } catch { return false; }
  })();
  if (isMain) {
    start().catch((err) => {
      console.error("Failed to start i18n-svc:", err);
      process.exit(1);
    });
  }
  