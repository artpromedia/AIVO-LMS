import { buildApp } from "./server.js";

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

  const logger = createLogger("integration-svc");
  const db = createDb(process.env.DATABASE_URL ?? "");
  const app = await buildApp({ db });
  await bootstrapOpsAlerts({ service: "integration-svc", app, beforeExit: () => app.close() });

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
