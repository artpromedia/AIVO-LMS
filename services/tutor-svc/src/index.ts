import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger, registerObservabilityPlugin } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { registerHealthRoutes } from "./routes/health.js";
import { registerStoreRoutes } from "./routes/store.js";
import { registerChatRoutes } from "./routes/chat.js";
import { registerHomeworkRoutes } from "./routes/homework.js";
import { registerCurriculumRoutes } from "./routes/curriculum.js";
import websocket from "@fastify/websocket";
import { registerSpeechBuddyRoutes } from "./routes/speechBuddy.js";
import { registerEfRoutes } from "./routes/ef.js";
import { registerTutorSessionRoutes } from "./routes/tutorSession.js";
import { registerTutorSurfaceRoutes } from "./routes/tutorSurface.js";
import { registerTutorSurfaceSubmitRoute } from "./routes/surfaceSubmit.js";
import { registerTutorRecommendationCandidatesRoute } from "./routes/recommendationCandidates.js";
import { registerAuthHook } from "./lib/tenant.js";
import { registerRaiGateway } from "./lib/rai-gateway.js";

const logger = createLogger("tutor-svc");
const PORT = parseInt(process.env.TUTOR_PORT || "3006", 10);

export async function buildApp() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const app = Fastify({ logger: false });

  // Structured request logging + /metrics for Prometheus scrape (Supp A).
  registerObservabilityPlugin(app, "tutor-svc");

  await app.register(cors, { origin: true, credentials: true });

  // Global rate limit: 120 req / minute per IP. Defends every route
  // (including the new EF partner endpoints) against amplification by
  // an authenticated caller. Individual routes still apply tighter
  // caps via their per-subject token buckets.
  await app.register(rateLimit, {
    max: 120,
    timeWindow: "1 minute",
  });

  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Tutor Service", version: "1.0.0" },
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

  // WebSocket support is REQUIRED for the Speech Buddy stream endpoint.
  // We register it eagerly so a missing dependency or registration
  // failure aborts startup instead of degrading silently to HTTP-only.
  await app.register(websocket);

  registerHealthRoutes(app);
  registerAuthHook(app);
  // RAI policy enforcement: consults responsible-ai-svc before inference,
  // short-circuits opted-out tenants with a graceful fallback (Sprint 7).
  registerRaiGateway(app);
  registerStoreRoutes(app, db);
  registerChatRoutes(app, db);
  registerHomeworkRoutes(app, db);
  registerCurriculumRoutes(app, db);
  registerEfRoutes(app, db);
  registerTutorSessionRoutes(app);
  registerTutorSurfaceRoutes(app);
  registerTutorSurfaceSubmitRoute(app);
  registerTutorRecommendationCandidatesRoute(app);
  await registerSpeechBuddyRoutes(app);

  return app;
}

async function start() {
  const app = await buildApp();
  await bootstrapOpsAlerts({ service: "tutor-svc", app, beforeExit: () => app.close() });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Tutor service listening on port ${PORT}`);
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
    logger.error(err, "Failed to start tutor-svc");
    process.exit(1);
  });
}
