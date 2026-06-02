import { buildApp } from "./server.js";
import type { SyncJob } from "./queue/retry.js";

export { buildApp } from "./server.js";
export * from "./services/sis-provider-interface.js";
export * from "./services/clever-adapter.js";
export * from "./services/classlink-adapter.js";
export * from "./services/lti13-launch-validator.js";

const PORT = parseInt(process.env.INTEGRATION_PORT || "3068", 10);

const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch {
    return false;
  }
})();

async function start() {
  const { createDb } = await import("@aivo/db");
  const { bootstrapOpsAlerts } = await import("@aivo/ops-alerts");
  const { startSafeCron, createDrizzleAdvisoryLock, createDrizzleLedger } = await import(
    "@aivo/scheduling"
  );
  const { createLogger } = await import("@aivo/observability");
  const { runConnectorSyncWatchdogOnce } = await import("./lib/connector-sync-watchdog.js");
  const { createBullMqQueueFromEnv, createSyncWorker } = await import(
    "./queue/bullmq-adapter.js"
  );
  const { InMemorySyncQueue } = await import("./queue/retry.js");

  const logger = createLogger("integration-svc");
  const db = createDb(process.env.DATABASE_URL ?? "");

  // Sprint 2: opt-in BullMQ queue. When REDIS_URL is set we use the Redis-backed
  // queue; otherwise fall back to InMemorySyncQueue (dev/tests). Worker is only
  // spawned when ROLE=worker so the API tier stays request-only.
  const bullQueue = createBullMqQueueFromEnv();
  if (!bullQueue) {
    // Touch InMemorySyncQueue so the import isn't tree-shaken; future commit will
    // pass the chosen queue into buildApp so routes enqueue sync.row jobs.
    void new InMemorySyncQueue();
  }
  logger.info(
    `SyncQueue backend: ${bullQueue ? "bullmq (REDIS_URL set)" : "in-memory (REDIS_URL unset)"}`,
  );

  const role = (process.env.ROLE ?? "").toLowerCase();
  let worker: { close: () => Promise<void> } | null = null;
  if (role === "worker" && bullQueue && process.env.REDIS_URL) {
    const IORedis = (await import("ioredis")).default;
    const conn = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    worker = createSyncWorker(conn, async (job: SyncJob) => {
      // Stub handler — real sync.row/sync.full/sync.delta dispatch lands with the
      // queue producer wiring. For now we just log so a smoke `enqueue` is visible.
      logger.info({ msg: "sync job received", type: job.type, attempt: job.attempt });
    });
    logger.info("BullMQ sync worker started (ROLE=worker)");
  }

  const app = await buildApp({ db });
  await bootstrapOpsAlerts({
    service: "integration-svc",
    app,
    beforeExit: async () => {
      if (worker) await worker.close().catch(() => undefined);
      if (bullQueue) await bullQueue.close().catch(() => undefined);
      await app.close();
    },
  });

  // Merged from integrations-svc: flag connectors whose last sync is stale.
  startSafeCron({
    jobName: "integration.connector-sync-watchdog",
    lock: createDrizzleAdvisoryLock(db as never),
    ledger: createDrizzleLedger(db as never),
    log: logger,
    run: () => runConnectorSyncWatchdogOnce(db),
  });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Integration service listening on port ${PORT}`);
}

if (isMain) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
