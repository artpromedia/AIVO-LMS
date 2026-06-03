// @aivo/comms-svc – email dispatch, postmark webhooks
import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { registerActiveRoleHook } from "@aivo/security";
import { startSafeCron, createDrizzleAdvisoryLock, createDrizzleLedger } from "@aivo/scheduling";
import { registerHealthRoutes } from "./routes/health.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerInboxStreamRoutes } from "./routes/inbox-stream.js";
import { registerEmailEventsRoutes } from "./routes/webhook-email-events.js";
import { runDigestCleanupOnce } from "./lib/digest-cleanup.js";
import { setEmailOutboxDb } from "./lib/postmark.js";
import { recordProviderEvent } from "./lib/email-outbox.js";
import { startEmailOutboxWorker, type EmailWorkerHandle } from "./lib/email-worker.js";

const logger = createLogger("comms-svc");
const PORT = parseInt(process.env.COMMS_SVC_PORT || "3010", 10);

export async function buildApp(db = createDb(process.env.DATABASE_URL ?? "")) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Communications Service", version: "1.0.0" },
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

  // Wire the email outbox so every sendEmail() call persists to Postgres
  // before Postmark is touched. The drain worker (started in start()) is the
  // only thing that talks to the provider. Tests that build the app with a
  // mock db keep using the direct-send path automatically.
  setEmailOutboxDb(db);

  // ADR 0020 — enforce the `x-aivo-active-role` header (hint, never a grant)
  // against the caller's token. No-op when the header is absent.
  registerActiveRoleHook(app);

  registerHealthRoutes(app);
  registerNotificationRoutes(app, db);
  registerMessageRoutes(app, db);
  registerInboxStreamRoutes(app, db);
  registerEmailEventsRoutes(app, {
    recordEvent: async (ev) => {
      try {
        await recordProviderEvent(db, ev);
      } catch (err) {
        logger.warn(
          { err: (err as Error).message, messageId: ev.messageId, type: ev.type },
          "failed to reconcile provider event against email_outbox",
        );
      }
    },
  });

  return app;
}

async function start() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const app = await buildApp(db);

  await bootstrapOpsAlerts({ service: "comms-svc", app, beforeExit: () => app.close() });

  // Sprint 7: fleet-wide daily digest cleanup via the shared scheduler.
  startSafeCron({
    jobName: "comms.digest-cleanup",
    lock: createDrizzleAdvisoryLock(db as any),
    ledger: createDrizzleLedger(db as any),
    log: logger,
    run: () => runDigestCleanupOnce(db),
  });

  // Durable email outbox drainer. One replica wins the advisory lock and
  // drains a batch each tick; the rest no-op. EMAIL_OUTBOX_DISABLED=1 keeps
  // the queue but skips the worker (useful while running ad-hoc migrations).
  let emailWorker: EmailWorkerHandle | null = null;
  if (process.env.EMAIL_OUTBOX_WORKER_DISABLED !== "1") {
    emailWorker = startEmailOutboxWorker(db, {
      tickIntervalMs: parseInt(process.env.EMAIL_OUTBOX_TICK_MS ?? "15000", 10),
      batchSize: parseInt(process.env.EMAIL_OUTBOX_BATCH_SIZE ?? "50", 10),
    });
    logger.info("email-outbox drain worker started");
  }

  app.addHook("onClose", async () => {
    if (emailWorker) await emailWorker.stop();
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`AIVO Communications Service listening on port ${PORT}`);
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
    console.error("Failed to start comms-svc:", err);
    process.exit(1);
  });
}
