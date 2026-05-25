import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { startSafeCron, createDrizzleAdvisoryLock, createDrizzleLedger } from "@aivo/scheduling";
import { runWeeklyRollupOnce } from "./lib/weekly-rollup.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerXpRoutes } from "./routes/xp.js";
import { registerShopRoutes } from "./routes/shop.js";
import { registerQuestRoutes } from "./routes/quests.js";
import { registerChallengeRoutes } from "./routes/challenges.js";
import { registerSelRoutes } from "./routes/sel.js";
import { registerLessonPlanRoutes } from "./routes/lessonPlans.js";
import { registerSiblingRoutes } from "./routes/siblings.js";
import { registerEventRoutes } from "./routes/events.js";

const logger = createLogger("engagement-svc");
const PORT = parseInt(process.env.ENGAGEMENT_PORT || "3008", 10);

export async function buildApp(db = createDb(process.env.DATABASE_URL ?? "")) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Engagement Service", version: "1.0.0" },
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
  registerXpRoutes(app, db);
  registerShopRoutes(app, db);
  registerQuestRoutes(app, db);
  registerChallengeRoutes(app, db);
  registerSelRoutes(app, db);
  registerLessonPlanRoutes(app, db);
  registerSiblingRoutes(app, db);
  registerEventRoutes(app, db);

  return app;
}

async function start() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const app = await buildApp(db);

  await bootstrapOpsAlerts({ service: "engagement-svc", app, beforeExit: () => app.close() });

  startSafeCron({
    jobName: "engagement.weekly-rollup",
    periodMs: 7 * 24 * 60 * 60 * 1000,
    lock: createDrizzleAdvisoryLock(db as any),
    ledger: createDrizzleLedger(db as any),
    log: logger,
    run: () => runWeeklyRollupOnce(db),
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Engagement service listening on port ${PORT}`);
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
    console.error("Failed to start engagement-svc:", err);
    process.exit(1);
  });
}
