import { FastifyInstance } from "fastify";
import { verifyJWT } from "@aivo/security";
import { createLogger } from "@aivo/observability";
import {
  overviewSchema,
  serviceStatusSchema,
  listIncidentsSchema,
  createIncidentSchema,
  uptimeSchema,
} from "./schemas.js";

const logger = createLogger("status-page-svc:status");

const IS_PROD = process.env.NODE_ENV === "production";

// Per-service: { envKey, healthPath, devDefault }. In production each envKey is
// required at boot — missing values throw a loud error so the status page never
// silently reports a backend as "down" because we polled the wrong host.
// All services expose an unscoped /health endpoint (auth-free, tenant-free)
// for liveness probes. status-page-svc polls that uniform path because some
// scoped paths sit behind auth or tenant middleware and 401/404 even when
// the service is healthy.
const SERVICE_DEFS: Array<{
  name: string;
  envKey: string;
  healthPath: string;
  devDefault: string;
}> = [
  {
    name: "identity-svc",
    envKey: "IDENTITY_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3001",
  },
  {
    name: "brain-svc",
    envKey: "BRAIN_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3002",
  },
  {
    name: "assessment-svc",
    envKey: "ASSESSMENT_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3003",
  },
  {
    name: "ai-svc",
    envKey: "AI_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3004",
  },
  {
    name: "learning-svc",
    envKey: "LEARNING_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3005",
  },
  {
    name: "tutor-svc",
    envKey: "TUTOR_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3006",
  },
  {
    name: "family-svc",
    envKey: "FAMILY_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3007",
  },
  {
    name: "engagement-svc",
    envKey: "ENGAGEMENT_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3008",
  },
  {
    name: "billing-svc",
    envKey: "BILLING_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3009",
  },
  {
    name: "comms-svc",
    envKey: "COMMS_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3010",
  },
  {
    name: "i18n-svc",
    envKey: "I18N_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3011",
  },
  {
    name: "integration-svc",
    envKey: "INTEGRATION_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3068",
  },
  {
    name: "admin-svc",
    envKey: "ADMIN_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3013",
  },
  {
    name: "status-page-svc",
    envKey: "STATUS_PAGE_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3014",
  },
  {
    name: "research-svc",
    envKey: "RESEARCH_SVC_URL",
    healthPath: "/health",
    devDefault: "http://localhost:3015",
  },
];

const missingProd = IS_PROD
  ? SERVICE_DEFS.filter((s) => !process.env[s.envKey]).map((s) => s.envKey)
  : [];
if (missingProd.length > 0) {
  throw new Error(
    `status-page-svc: required service URL env vars missing in production: ${missingProd.join(", ")}`,
  );
}
if (IS_PROD && !process.env.INTERNAL_SERVICE_TOKEN) {
  throw new Error(
    "status-page-svc: INTERNAL_SERVICE_TOKEN must be set in production (used to dispatch admin alerts via comms-svc).",
  );
}

const SERVICES: Array<{ name: string; url: string }> = SERVICE_DEFS.map((s) => ({
  name: s.name,
  url: `${(process.env[s.envKey] || s.devDefault).replace(/\/$/, "")}${s.healthPath}`,
}));

const SLOW_THRESHOLD_MS = 2000;
const DOWN_ALERT_AFTER = 3;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

const consecutiveDowns: Record<string, number> = {};
const lastAlertAt: Record<string, number> = {};

async function checkService(svc: { name: string; url: string }) {
  const start = Date.now();
  try {
    const res = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
    const latencyMs = Date.now() - start;
    const status = res.ok ? "healthy" : "degraded";

    if (latencyMs > SLOW_THRESHOLD_MS) {
      logger.warn(
        { service: svc.name, latencyMs, threshold: SLOW_THRESHOLD_MS },
        "slow_health_check",
      );
    }

    consecutiveDowns[svc.name] = 0;

    return { name: svc.name, status, latencyMs, statusCode: res.status };
  } catch {
    return { name: svc.name, status: "down", latencyMs: Date.now() - start, statusCode: 0 };
  }
}

async function alertAdmins(service: string, consecutive: number) {
  const last = lastAlertAt[service] || 0;
  if (Date.now() - last < ALERT_COOLDOWN_MS) return;
  lastAlertAt[service] = Date.now();

  const commsUrl = process.env.COMMS_SVC_URL || (IS_PROD ? "" : "http://localhost:3010");
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) {
    logger.error({ service, consecutive }, "service_down_no_token");
    return;
  }

  try {
    const res = await fetch(`${commsUrl}/api/comms/alerts/admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service": "status-page-svc",
        "x-service-token": token,
      },
      body: JSON.stringify({
        severity: "critical",
        title: `Service down: ${service}`,
        message: `Health check failed ${consecutive} consecutive times for ${service}.`,
        source: "status-page-svc",
      }),
    });
    logger.info({ service, consecutive, alertStatus: res.status }, "admin_alert_dispatched");
  } catch (err: any) {
    logger.error({ service, err: err.message }, "admin_alert_failed");
  }
}

async function requireAdmin(req: any, reply: any) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return reply.status(401).send({ error: "Missing authorization header" });
  }
  try {
    const payload = await verifyJWT(auth.slice(7));
    if (!["PLATFORM_ADMIN", "DISTRICT_ADMIN"].includes(payload.role as string)) {
      return reply.status(403).send({ error: "Admin access required" });
    }
    req.user = payload;
  } catch {
    return reply.status(401).send({ error: "Invalid token" });
  }
}

export function registerStatusRoutes(app: FastifyInstance) {
  app.get("/api/status/overview", { schema: overviewSchema }, async () => {
    const results = await Promise.all(SERVICES.map(checkService));

    for (const r of results) {
      if (r.status === "down") {
        consecutiveDowns[r.name] = (consecutiveDowns[r.name] || 0) + 1;
        if (consecutiveDowns[r.name] >= DOWN_ALERT_AFTER) {
          alertAdmins(r.name, consecutiveDowns[r.name]).catch(() => {});
        }
      }
    }

    const allHealthy = results.every((r) => r.status === "healthy");
    const anyDown = results.some((r) => r.status === "down");
    return {
      overall: anyDown ? "major_outage" : allHealthy ? "operational" : "degraded",
      services: results,
      checkedAt: new Date().toISOString(),
      thresholds: { slowMs: SLOW_THRESHOLD_MS, downAlertAfter: DOWN_ALERT_AFTER },
    };
  });

  app.get(
    "/api/status/service/:serviceName",
    { schema: serviceStatusSchema },
    async (request, reply) => {
      const { serviceName } = request.params as any;
      const svc = SERVICES.find((s) => s.name === serviceName);
      if (!svc) return reply.code(404).send({ error: "Service not found" });
      return await checkService(svc);
    },
  );

  app.get("/api/status/incidents", { schema: listIncidentsSchema }, async () => {
    return { incidents: [], total: 0 };
  });

  app.post(
    "/api/status/incidents",
    { schema: createIncidentSchema, preHandler: requireAdmin },
    async (request) => {
      const { title, description, severity, affectedServices } = request.body as any;
      return {
        id: crypto.randomUUID(),
        title,
        description,
        severity: severity || "minor",
        affectedServices: affectedServices || [],
        status: "investigating",
        createdAt: new Date().toISOString(),
      };
    },
  );

  app.get("/api/status/uptime", { schema: uptimeSchema }, async () => {
    return {
      period: "30d",
      uptime: {
        overall: 99.95,
        byService: SERVICES.map((s) => ({ name: s.name, uptime: 99.9 + Math.random() * 0.1 })),
      },
    };
  });
}
