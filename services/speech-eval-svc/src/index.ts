import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger, registerObservabilityPlugin } from "@aivo/observability";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { registerHealthRoutes } from "./routes/health.js";
import { registerEvaluateRoute } from "./routes/evaluate.js";

const logger = createLogger("speech-eval-svc");
const PORT = parseInt(process.env.SPEECH_EVAL_PORT || "3080", 10);

/**
 * Build the configured Fastify app without binding to a port.
 * Exposed so the api-client dump shim can mount the same route
 * surface and call `app.swagger()` without starting the server.
 */
export async function buildApp() {
  const app = Fastify({ logger: false });

  registerObservabilityPlugin(app, "speech-eval-svc");

  await app.register(cors, { origin: true, credentials: true });
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10 MB cap per recording
      files: 1,
    },
  });
  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Speech Eval Service", version: "1.0.0" },
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
  registerEvaluateRoute(app);

  return app;
}

async function start() {
  const app = await buildApp();
  await bootstrapOpsAlerts({ service: "speech-eval-svc", app, beforeExit: () => app.close() });
  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Speech eval service listening on port ${PORT}`);
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
    logger.error(err, "Failed to start speech-eval-svc");
    process.exit(1);
  });
}
