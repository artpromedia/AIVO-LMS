import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import rawBody from "fastify-raw-body";
import postgres from "postgres";
import { createLogger } from "@aivo/observability";
import { installAuditing } from "@aivo/audit-client";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts, postgresJsOutboxClient } from "@aivo/ops-alerts";
import {
  startSafeCron,
  createDrizzleAdvisoryLock,
  createDrizzleLedger,
  type SafeCronHandle,
} from "@aivo/scheduling";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPlanRoutes } from "./routes/plans.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";
import { registerDailyJobsRoutes } from "./routes/daily-jobs.js";
import { registerCouponRoutes } from "./routes/coupons.js";
import { registerPilotProvisioningRoutes } from "./routes/pilot-provisioning.js";
import { registerPilotStatusRoutes } from "./routes/pilot-status.js";
import { registerInternalJobRoutes } from "./routes/internal-jobs.js";
import { registerBillingTestHelperRoutes } from "./routes/test-helpers.js";
import { registerSeatRoutes } from "./routes/seats.js";
import { registerGovernanceRoutes } from "./routes/governance.js";
import { runExpiryBatchForScheduler } from "./lib/expiryReminderService.js";
import { runTrialEndingBatchForScheduler } from "./lib/trialEndingReminderService.js";
import { runReconciliationForScheduler } from "./lib/reconciliationService.js";
import { runUtilizationForScheduler } from "./jobs/utilization.js";

const logger = createLogger("billing-svc");
const PORT = parseInt(process.env.BILLING_SVC_PORT || "3009", 10);

/**
 * Shared between buildApp() and start(). The internal-jobs route closes
 * over this map by reference, so start() can populate the handles after
 * the schedulers actually launch in start() — buildApp() just needs the
 * routes registered for the api-client OpenAPI dump. The dump path
 * leaves the map empty; live boot fills it.
 */
type CronHandles = Record<string, SafeCronHandle>;

export async function buildApp(
  handles: CronHandles = {},
  db = createDb(process.env.DATABASE_URL ?? ""),
) {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true, credentials: true });
  installAuditing(app, { defaultAllowlist: ["plan", "tenantId"] });
  // Stripe signature verification requires the byte-for-byte body the
  // signer hashed. fastify-raw-body opts in per-route via
  // `config: { rawBody: true }`.
  await app.register(rawBody, {
    field: "rawBody",
    global: false,
    encoding: "utf8",
    runFirst: true,
  });
  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Billing Service", version: "1.0.0" },
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
  registerPlanRoutes(app, db);
  registerWebhookRoutes(app, db);
  registerDailyJobsRoutes(app, db);
  registerCouponRoutes(app, db);
  registerPilotProvisioningRoutes(app, db);
  registerPilotStatusRoutes(app, db);
  registerSeatRoutes(app, db);
  registerInternalJobRoutes(app, handles);
  registerBillingTestHelperRoutes(app, db);
  registerGovernanceRoutes(app, db);

  return app;
}

async function start() {
  const db = createDb(process.env.DATABASE_URL ?? "");

  // Mutable handles map — wired into the internal-jobs route via
  // closure, then populated below once the schedulers exist.
  const handles: CronHandles = {};
  const app = await buildApp(handles, db);

  const lock = createDrizzleAdvisoryLock(db as any);
  const ledger = createDrizzleLedger(db as any);
  const expiryHandle = startSafeCron({
    jobName: "billing.daily-expiry-reminders",
    ledger,
    lock,
    log: logger,
    run: () => runExpiryBatchForScheduler(db),
  });
  handles["billing.daily-expiry-reminders"] = expiryHandle;

  // Daily trial-ending reminders: notify subscriptions whose free trial ends
  // within 3 days, exactly once (latched on trial_ending_reminder_sent_at).
  const trialEndingHandle = startSafeCron({
    jobName: "billing.daily-trial-ending-reminders",
    ledger,
    lock,
    log: logger,
    run: () => runTrialEndingBatchForScheduler(db),
  });
  handles["billing.daily-trial-ending-reminders"] = trialEndingHandle;

  // Daily Stripe reconciliation. Walks active subscriptions and repairs
  // local drift if a webhook was dropped or arrived out of order.
  // No-ops cleanly when Stripe is not configured.
  const reconciliationHandle = startSafeCron({
    jobName: "billing.daily-stripe-reconciliation",
    ledger,
    lock,
    log: logger,
    run: () => runReconciliationForScheduler(db),
  });
  handles["billing.daily-stripe-reconciliation"] = reconciliationHandle;

  // Nightly seat-utilization rollup: promotes matured future-dated
  // allocations, refreshes per-pool `used` from identity-svc active users,
  // and raises `billing.overage` events. No-ops cleanly when there are no
  // pools or identity-svc is unreachable.
  const utilizationHandle = startSafeCron({
    jobName: "billing.nightly-seat-utilization",
    ledger,
    lock,
    log: logger,
    run: () => runUtilizationForScheduler(db),
  });
  handles["billing.nightly-seat-utilization"] = utilizationHandle;

  let sharedSql: ReturnType<typeof postgres> | null = null;
  const opsAlerts = await bootstrapOpsAlerts({
    service: "billing-svc",
    app,
    pgOutboxClient: process.env.OPS_ALERTS_OUTBOX_PG_TABLE
      ? () => {
          if (!sharedSql) sharedSql = postgres(process.env.DATABASE_URL!, { max: 2 });
          return postgresJsOutboxClient(sharedSql as any);
        }
      : undefined,
    beforeExit: async () => {
      await app.close();
      if (sharedSql) await sharedSql.end({ timeout: 1 });
    },
  });

  if (opsAlerts.pgRequestedButUnwired) {
    logger.warn(
      { table: process.env.OPS_ALERTS_OUTBOX_PG_TABLE },
      "billing-svc: OPS_ALERTS_OUTBOX_PG_TABLE is set but pgOutboxClient was not wired",
    );
  }

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info({ port: PORT, outboxKind: opsAlerts.outbox.kind }, "AIVO Billing Service listening");
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
    console.error("Failed to start billing-svc:", err);
    process.exit(1);
  });
}
