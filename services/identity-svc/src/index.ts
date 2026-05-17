import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { promises as fsp } from "node:fs";
import { createLogger, registerObservabilityPlugin } from "@aivo/observability";
import { createDb } from "@aivo/db";
import { bootstrapOpsAlerts } from "@aivo/ops-alerts";
import { initKeys, logAdminEnterpriseFlags, assertMfaKeyConfigured, registerAdminIpAllowlist } from "@aivo/security";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerTestHelperRoutes } from "./routes/test-helpers.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerConsentRoutes } from "./routes/consent.js";
import { registerCurriculumRoutes } from "./routes/curriculum.js";
import { registerAdminRoutes } from "./routes/admin.js";
import { registerStepUpRoutes } from "./routes/step-up.js";
import { registerDistrictRoutes } from "./routes/district.js";
import { registerPublicBrandingRoutes } from "./routes/branding-public.js";
import { registerDistrictAdminRoutes } from "./routes/district-admins.js";
import { registerSsoRoutes } from "./routes/sso.js";
import { registerScimRoutes } from "./routes/scim.js";
import { registerAvatarRoutes } from "./routes/avatars.js";
import { AVATAR_MAX_BYTES, AVATAR_STORAGE_ROOT, AVATAR_S3_ENABLED, getAvatarObjectFromS3 } from "./lib/avatar-storage.js";
import { registerDistrictTenantScope, REQUIRE_DISTRICT_ADMIN_FLAG } from "./hooks/require-district-admin.js";

const logger = createLogger("identity-svc");
const PORT = parseInt(process.env.PORT || "3001", 10);

/**
 * Build the configured Fastify app without binding to a port. Exposed
 * so tests can mount the same route surface and run boot-time checks
 * (route coverage, hook installation) against it.
 */
export async function buildApp() {
  await initKeys();
  // Fail fast at boot — never let an MFA-encryption-key misconfiguration
  // become a latent issue that only surfaces when a user tries to enroll
  // their first TOTP secret. In production a missing key will throw here
  // and stop the service from starting.
  try {
    assertMfaKeyConfigured();
  } catch (e) {
    logger.error(e, "MFA encryption key validation failed at boot");
    throw e;
  }
  logAdminEnterpriseFlags(logger);

  const dbUrl = process.env.DATABASE_URL || "";
  if (
    process.env.NODE_ENV === "production" &&
    dbUrl &&
    !/[?&]sslmode=(require|verify-ca|verify-full)(?:&|$)/i.test(dbUrl)
  ) {
    logger.warn(
      "DATABASE_URL is missing sslmode=require in production. PII " +
      "(emails, password hashes, MFA codes) is being transmitted over " +
      "an unencrypted database connection. Append `?sslmode=require` " +
      "(or stronger) to your connection string immediately.",
    );
  }

  const db = createDb(dbUrl);

  const app = Fastify({
    logger: false,
    // Behind ingress-nginx + Cloudflare, request.ip would otherwise be
    // the proxy's address — collapsing all users into one rate-limit
    // bucket and triggering 429 storms on the parent dashboard. Trust
    // X-Forwarded-For so request.ip resolves to the real client IP.
    trustProxy: true,
  });

  // Structured request logging + /metrics for Prometheus scrape (Supp A).
  registerObservabilityPlugin(app, "identity-svc");

  const isDev = process.env.NODE_ENV === "development" || !process.env.NODE_ENV;
  let corsOrigin: boolean | string[];
  if (process.env.CORS_ORIGINS) {
    corsOrigin = process.env.CORS_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
  } else if (!isDev) {
    corsOrigin = process.env.APP_URL ? [process.env.APP_URL] : [];
  } else {
    corsOrigin = true;
  }
  logger.info({ origins: corsOrigin }, "CORS origins");

  await app.register(cors, {
    origin: corsOrigin,
    credentials: true,
  });

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || "aivo-dev-cookie-secret-change-me",
  });

  await app.register(rateLimit, {
    // Parent dashboard fans out many independent /api/users/learners
    // fetches across nested layouts; 100/min was too tight even for a
    // single user. 300/min still trips on real abuse but lets the
    // dashboard render without throttling.
    //
    // Behind Cloudflare + ingress-nginx, request.ip can collapse to a
    // Cloudflare POP IP (shared by many users) even with trustProxy,
    // because ingress-nginx is not configured with the Cloudflare CIDR
    // set. Cloudflare always sends CF-Connecting-IP with the real
    // client IP, so use it as the bucket key and fall back to req.ip
    // for direct-to-cluster calls (smoke tests, in-cluster traffic).
    max: 300,
    timeWindow: "1 minute",
    keyGenerator: (req: any) => {
      const cf = req.headers?.["cf-connecting-ip"];
      if (typeof cf === "string" && cf.length > 0) return cf;
      if (Array.isArray(cf) && cf[0]) return cf[0];
      return req.ip;
    },
  });

  // Profile-photo upload pipeline: bound the request size to the avatar
  // limit (5 MB) so an oversized upload is rejected at the framework
  // boundary rather than buffered into memory by a route handler.
  await app.register(multipart, {
    limits: { fileSize: AVATAR_MAX_BYTES, files: 1 },
  });

  // Static read-only delivery of the re-encoded WebP avatars. Writes are
  // gated through POST /api/users/me/avatar; this prefix is read-only.
  if (AVATAR_S3_ENABLED) {
    // S3-backed avatars (e.g. in-cluster MinIO): stream objects through
    // identity-svc so the bucket can stay private and replicas share state.
    app.get<{ Params: { userId: string; file: string } }>(
      "/api/avatars/:userId/:file",
      async (req, reply) => {
        const { userId, file } = req.params;
        if (!/^[0-9a-fA-F-]{36}$/.test(userId) || !/^[a-zA-Z0-9._-]+\.webp$/.test(file)) {
          return reply.status(400).send({ error: "Invalid avatar path." });
        }
        const obj = await getAvatarObjectFromS3(userId, file);
        if (!obj) return reply.status(404).send({ error: "Not found" });
        reply
          .header("content-type", obj.contentType)
          .header("cache-control", "public, max-age=604800");
        if (obj.contentLength != null) reply.header("content-length", String(obj.contentLength));
        if (obj.etag) reply.header("etag", obj.etag);
        return reply.send(obj.body);
      },
    );
  } else {
    await fsp.mkdir(AVATAR_STORAGE_ROOT, { recursive: true }).catch(() => undefined);
    await app.register(fastifyStatic, {
      root: AVATAR_STORAGE_ROOT,
      prefix: "/api/avatars/",
      decorateReply: false,
      cacheControl: true,
      maxAge: "7d",
      immutable: false,
    });
  }

  await app.register(swagger, {
    openapi: {
      info: {
        title: "AIVO Identity Service",
        version: "1.0.0",
        description: "Authentication, authorization, and user management for AIVO Learning Platform",
      },
      servers: process.env.SWAGGER_SERVER_URL
        ? [{ url: process.env.SWAGGER_SERVER_URL }]
        : (process.env.NODE_ENV === "production" ? [] : [{ url: `http://localhost:${PORT}` }]),
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
    },
  });

  await app.register(swaggerUI, {
    routePrefix: "/docs",
  });

  app.decorate("db", db);

  // Sprint 4: enforce ADMIN_IP_ALLOWLIST on /api/admin/** before any handler.
  registerAdminIpAllowlist(app);

  await registerHealthRoutes(app);
  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerConsentRoutes(app);
  await registerCurriculumRoutes(app);
  await registerStepUpRoutes(app);
  await registerAdminRoutes(app);
  // Sprint 8: install the global tenant-scope hook BEFORE registering
  // district routes. The hook intercepts every /api/district/* request
  // and runs requireDistrictAdmin so no future district route can ship
  // without tenant isolation. Per-route preHandlers remain idempotent
  // via the shared REQUIRE_DISTRICT_ADMIN_FLAG.
  registerDistrictTenantScope(app);
  await registerDistrictRoutes(app);
  await registerPublicBrandingRoutes(app);
  await registerDistrictAdminRoutes(app);
  await registerSsoRoutes(app);
  await registerScimRoutes(app);
  await registerAvatarRoutes(app);
  registerTestHelperRoutes(app);

  void REQUIRE_DISTRICT_ADMIN_FLAG;
  return app;
}

async function start() {
  const app = await buildApp();
  await bootstrapOpsAlerts({ service: "identity-svc", app, beforeExit: () => app.close() });
  await app.ready();
  // Boot-time fail-closed coverage: walk the registered route tree
  // and verify every /api/district/* path is reachable through the
  // tenant-scope hook. We can't introspect Fastify hooks directly, so
  // the assertion here is "the prefix has at least one registered
  // route AND the global hook was installed".
  const districtRoutes = app.printRoutes({ commonPrefix: false })
    .split("\n")
    .filter((l) => l.includes("/api/district/"));
  if (districtRoutes.length === 0) {
    throw new Error("[boot-check] No /api/district/* routes registered — tenant-scope hook would silently no-op.");
  }
  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info(`Identity service listening on port ${PORT}`);
  // Sprint 7: fleet-wide daily housekeeping via the shared scheduler.
  try {
    const { startSafeCron, createDrizzleAdvisoryLock, createDrizzleLedger } = await import("@aivo/scheduling");
    const { runSessionHousekeepingOnce } = await import("./lib/session-housekeeping.js");
    const db = createDb(process.env.DATABASE_URL ?? "");
    startSafeCron({
      jobName: "identity.session-housekeeping",
      lock: createDrizzleAdvisoryLock(db as any),
      ledger: createDrizzleLedger(db as any),
      log: logger,
      run: () => runSessionHousekeepingOnce(db),
    });
  } catch (e) {
    logger.error(e, "failed to start session-housekeeping cron");
  }
}

// Only auto-start when invoked as the entry module (not when imported
// by tests via `buildApp`).
const isMain = (() => {
  try {
    return process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
  } catch { return false; }
})();
if (isMain) {
  start().catch((err) => {
    logger.error(err, "Failed to start identity-svc");
    process.exit(1);
  });
}
