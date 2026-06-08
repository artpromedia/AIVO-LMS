import Fastify from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger, registerObservabilityPlugin } from "@aivo/observability";
import { installAuditing } from "@aivo/audit-client";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import {
  logAdminEnterpriseFlags,
  registerAdminIpAllowlist,
  registerActiveRoleHook,
} from "@aivo/security";
import {
  startSafeCron,
  createDrizzleAdvisoryLock,
  createDrizzleLedger,
  type SafeCronHandle,
} from "@aivo/scheduling";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPlatformRoutes } from "./routes/platform.js";
import { registerAuditRoutes } from "./routes/audit.js";
import { registerAuditVerifyRoutes } from "./routes/audit-verify.js";
import { registerSearchRoutes } from "./routes/search.js";
import { registerLeadRoutes } from "./routes/leads.js";
import { registerBillingCouponRoutes } from "./routes/billing-coupons.js";
import { registerModerationRoutes } from "./routes/moderation.js";
import { registerComplianceRoutes } from "./routes/compliance.js";
import { registerApiKeyRoutes } from "./routes/api-keys.js";
import { registerScimTokenRoutes } from "./routes/scim-tokens.js";
import { registerEvidenceRoutes } from "./routes/evidence.js";
import { registerJobsRoutes } from "./routes/jobs.js";
import { registerAdminInternalJobRoutes } from "./routes/internal-jobs.js";
import { registerContentCmsRoutes } from "./routes/content-cms.js";
import { registerGovernanceRoutes } from "./routes/governance.js";
import { registerLearnerImportRoutes } from "./routes/learner-import.js";
import { registerClassroomRoutes } from "./routes/classrooms.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerNotificationRoutes } from "./routes/notifications.js";
import { registerFeatureFlagRoutes } from "./routes/feature-flags.js";
import { registerSecurityRoutes } from "./routes/security.js";
import { registerPronunciationRoutes } from "./routes/pronunciation.js";
import { registerSupportRoutes } from "./routes/support.js";
import { startEvidenceCron } from "./lib/soc2-evidence.js";
import { startWatchdog, configureWatchdogAlerts } from "./lib/watchdog.js";
import { runJanitorOnce } from "./lib/janitor.js";
import { runAuditRetentionOnce } from "./lib/audit-retention.js";
import { runPacingAdvanceOnce } from "./lib/pacing-advance.js";

const logger = createLogger("admin-svc");
const PORT = parseInt(process.env.ADMIN_SVC_PORT || "3013", 10);

type CronHandles = Record<string, SafeCronHandle>;

export async function buildApp(
  handles: CronHandles = {},
  db = createDb(process.env.DATABASE_URL ?? ""),
) {
  logAdminEnterpriseFlags(logger);
  const app = Fastify({ logger: false });

  // Structured request logging + /metrics for Prometheus scrape (Supp A).
  registerObservabilityPlugin(app, "admin-svc");

  await app.register(cors, { origin: true, credentials: true });
  installAuditing(app, { defaultAllowlist: ["name", "scopes", "tenantId"] });
  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Admin Service", version: "1.0.0" },
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
  registerPlatformRoutes(app, db);
  registerAdminIpAllowlist(app);
  // ADR 0020 — enforce the `x-aivo-active-role` header (hint, never a grant)
  // against the caller's token. No-op when the header is absent.
  registerActiveRoleHook(app);
  registerAuditRoutes(app, db);
  registerAuditVerifyRoutes(app, db);
  registerSearchRoutes(app, db);
  registerLeadRoutes(app, db);
  registerBillingCouponRoutes(app);
  registerModerationRoutes(app, db);
  registerComplianceRoutes(app, db);
  registerApiKeyRoutes(app, db);
  registerScimTokenRoutes(app, db);
  registerEvidenceRoutes(app, db);
  registerJobsRoutes(app, db);
  registerContentCmsRoutes(app, db);
  registerGovernanceRoutes(app, db);
  registerLearnerImportRoutes(app, db);
  registerClassroomRoutes(app, db);
  registerReportRoutes(app, db);
  registerNotificationRoutes(app, db);
  registerFeatureFlagRoutes(app);
  registerSecurityRoutes(app, db);
  registerPronunciationRoutes(app, db);
  registerSupportRoutes(app, db);
  // Wire the internal-jobs route up with a handle map that is mutated
  // by `start()` once the schedulers are running. The dump path leaves
  // it empty, which is safe because the route reads `handles[jobName]`
  // at request time.
  registerAdminInternalJobRoutes(app, handles);

  return app;
}

async function start() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const handles: CronHandles = {};
  const app = await buildApp(handles, db);

  await bootstrapOpsAlerts({ service: "admin-svc", app, beforeExit: () => app.close() }).then(
    (boot) => {
      // v2.1 §9.1 dedup: feed the watchdog the durable OpsAlertClient
      // instead of the legacy in-process @aivo/ops-alert client.
      configureWatchdogAlerts(boot.client);
    },
  );

  // Schedulers — these run regardless of which replica is leader; the
  // shared scheduler picks one via the advisory lock.
  const evidenceHandle = startEvidenceCron(db, logger);
  const lock = createDrizzleAdvisoryLock(db as any);
  const ledger = createDrizzleLedger(db as any);
  const janitorHandle = startSafeCron({
    jobName: "admin.run-history-janitor",
    ledger,
    lock,
    log: logger,
    run: () => runJanitorOnce(db),
  });
  const retentionHandle = startSafeCron({
    jobName: "admin.audit-retention",
    ledger,
    lock,
    log: logger,
    run: () => runAuditRetentionOnce(db),
  });
  // Phase 2: keep learner_pacing_weeks.status (planned/active/done) in step
  // with the calendar. Daily, fleet-safe via the shared advisory lock.
  const pacingAdvanceHandle = startSafeCron({
    jobName: "curriculum.pacing-advance",
    ledger,
    lock,
    log: logger,
    run: () => runPacingAdvanceOnce(db),
  });
  handles["admin.soc2-evidence"] = evidenceHandle;
  handles["admin.run-history-janitor"] = janitorHandle;
  handles["admin.audit-retention"] = retentionHandle;
  handles["curriculum.pacing-advance"] = pacingAdvanceHandle;

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`AIVO Admin Service listening on port ${PORT}`);

  startWatchdog(db, { log: logger });
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
    logger.error(err, "Failed to start admin-svc");
    process.exit(1);
  });
}
