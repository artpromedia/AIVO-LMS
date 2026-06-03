import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { createLogger, registerObservabilityPlugin } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { registerActiveRoleHook } from "@aivo/security";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { registerHealthRoutes } from "./routes/health.js";
import { registerParentAssessmentRoutes } from "./routes/parent-assessment.js";
import { registerTeacherAssessmentRoutes } from "./routes/teacher-assessment.js";
import { registerAssessmentRoutes } from "./routes/assessments.js";
import { registerIepRoutes } from "./routes/iep.js";
import { registerIepEvaluationRoutes } from "./routes/iep-evaluations.js";
import { registerIepAuthoringRoutes } from "./routes/iep-authoring.js";
import { registerIepCollabRoutes } from "./routes/iep-collab.js";
import { registerIepUpdatesRoutes, checkReviewReminders } from "./routes/iep-updates.js";
import { registerIepParentShareRoutes } from "./routes/iep-parent-share.js";
import { registerLearnerBaselineRoutes } from "./routes/learner-baseline.js";
import { registerLearnerProfileRoutes } from "./routes/learner-profile.js";
import { registerSensoryProfileRoutes } from "./routes/sensory-profile.js";

const logger = createLogger("assessment-svc");
const PORT = parseInt(process.env.ASSESSMENT_PORT || "3003", 10);

export async function buildApp(db = createDb(process.env.DATABASE_URL ?? "")) {
  const app = Fastify({ logger: false });

  // Structured request logging + /metrics for Prometheus scrape (Supp A).
  registerObservabilityPlugin(app, "assessment-svc");

  // Surface unhandled errors. Without this, `Fastify({ logger: false })`
  // silently 500s and the stack disappears.
  app.setErrorHandler((err: any, req: any, reply: any) => {
    logger.error("request_error", {
      method: req.method,
      path: req.routeOptions?.url ?? req.url,
      request_id: req.requestId,
      err_message: err?.message,
      err_name: err?.name,
      err_code: err?.code,
      stack: err?.stack,
      cause_message: err?.cause?.message,
      cause_name: err?.cause?.name,
      cause_code: err?.cause?.code,
      cause_detail: err?.cause?.detail,
      cause_hint: err?.cause?.hint,
      cause_position: err?.cause?.position,
      cause_where: err?.cause?.where,
      cause_table: err?.cause?.table,
      cause_column: err?.cause?.column,
      cause_dataType: err?.cause?.dataType,
      cause_constraint: err?.cause?.constraint,
      cause_stack: err?.cause?.stack,
    });
    const status = err?.statusCode && err.statusCode >= 400 ? err.statusCode : 500;
    reply.status(status).send({ error: err?.message ?? "Internal Server Error" });
  });

  await app.register(cors, { origin: true, credentials: true });

  // IEP PDF intake — bound the request size to 10 MB so an oversized
  // upload is rejected at the framework boundary rather than buffered
  // into memory by the route handler.
  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  });

  await app.register(swagger, {
    openapi: {
      info: { title: "AIVO Assessment Service", version: "1.0.0" },
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

  app.decorate("db", db);

  // ADR 0020 — enforce the `x-aivo-active-role` header (hint, never a grant)
  // against the caller's token. No-op when the header is absent.
  registerActiveRoleHook(app);

  await registerHealthRoutes(app);
  await registerParentAssessmentRoutes(app);
  await registerTeacherAssessmentRoutes(app);
  await registerAssessmentRoutes(app);
  await registerIepRoutes(app);
  await registerIepEvaluationRoutes(app);
  await registerIepAuthoringRoutes(app);
  await registerIepCollabRoutes(app);
  await registerIepUpdatesRoutes(app);
  await registerIepParentShareRoutes(app);
  await registerLearnerBaselineRoutes(app);
  await registerLearnerProfileRoutes(app);
  await registerSensoryProfileRoutes(app);

  return app;
}

async function start() {
  const db = createDb(process.env.DATABASE_URL ?? "");
  const app = await buildApp(db);

  await bootstrapOpsAlerts({ service: "assessment-svc", app, beforeExit: () => app.close() });

  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Assessment service listening on port ${PORT}`);

  // Phase D — fire annual review reminders (90/60/30 days). Once on boot
  // (catches anything missed while the service was down) and then daily.
  // Idempotent at the row level, so multiple instances racing is safe.
  setTimeout(() => {
    checkReviewReminders(db).catch((err) =>
      logger.error("Initial reminder run failed", { err: err?.message || String(err) }),
    );
  }, 30_000);
  setInterval(
    () => {
      checkReviewReminders(db).catch((err) =>
        logger.error("Daily reminder run failed", { err: err?.message || String(err) }),
      );
    },
    24 * 60 * 60 * 1000,
  );
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
    logger.error("Failed to start assessment-svc", { err: err?.message || String(err) });
    process.exit(1);
  });
}
