import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger, registerObservabilityPlugin } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { initKeys } from "@aivo/security";
import { registerHealthRoutes } from "./routes/health.js";
import { registerCollaborationRoutes } from "./routes/collaboration.js";
import { registerRecommendationRoutes } from "./routes/recommendations.js";
import { registerIepRoutes } from "./routes/iep.js";
import { registerTransitionRoutes } from "./routes/transition.js";
import { registerLanguageProfileRoutes } from "./routes/language-profile.js";
import { registerDataExportRoutes } from "./routes/data-export.js";
import { registerParentDashboardRoutes } from "./routes/parent-dashboard.js";
import { registerObservationRoutes } from "./routes/observations.js";
import { registerSpeechBuddyConsentRoutes } from "./routes/speech-buddy-consent.js";
import { registerWhatsWorkingRoutes } from "./routes/whats-working.js";
import { registerInterestRoutes } from "./routes/interests.js";
import { registerFamilyGoalsRoutes } from "./routes/family-goals.js";

const logger = createLogger("family-svc");
const PORT = parseInt(process.env.FAMILY_PORT || "3007", 10);

export async function buildApp() {
  await initKeys();

  const db = createDb(process.env.DATABASE_URL ?? "");

  const app = Fastify({ logger: false });

  // Structured request logging + /metrics for Prometheus scrape (Supp A).
  registerObservabilityPlugin(app, "family-svc");

  await app.register(cors, { origin: true, credentials: true });

  // Global rate limit: 120 req / minute per IP. Defends every route
  // (including the parent-dashboard "what's working", interests CRUD,
  // and the IEP / collaboration paths) against amplification by an
  // authenticated caller. Individual routes still apply tighter caps.
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Family Service", version: "1.0.0" },
      servers: process.env.SWAGGER_SERVER_URL
        ? [{ url: process.env.SWAGGER_SERVER_URL }]
        : (process.env.NODE_ENV === "production" ? [] : [{ url: `http://localhost:${PORT}` }]),
      components: {
        securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } },
      },
    },
  });
  await app.register(swaggerUI, { routePrefix: "/docs" });

  app.decorate("db", db);

  await registerHealthRoutes(app);
  await registerCollaborationRoutes(app);
  await registerRecommendationRoutes(app);
  await registerIepRoutes(app);
  await registerTransitionRoutes(app);
  await registerLanguageProfileRoutes(app);
  await registerDataExportRoutes(app);
  await registerParentDashboardRoutes(app);
  await registerObservationRoutes(app);
  await registerSpeechBuddyConsentRoutes(app);
  await registerWhatsWorkingRoutes(app);
  await registerInterestRoutes(app);
  await registerFamilyGoalsRoutes(app);

  return app;
}

async function start() {
  const app = await buildApp();
  await bootstrapOpsAlerts({ service: "family-svc", app, beforeExit: () => app.close() });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Family service listening on port ${PORT}`);
}

const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch { return false; }
})();
if (isMain) {
  start().catch((err) => {
    logger.error(err, "Failed to start family-svc");
    process.exit(1);
  });
}
