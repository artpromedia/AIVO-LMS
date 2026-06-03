import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import cors from "@fastify/cors";
import { createLogger } from "@aivo/observability";
import {
  loadChannels,
  publicView,
  REQUIRED_CHANNELS_IN_PROD,
  type ChannelConfig,
} from "./channels.js";
import { fanOut, type ForwarderDeps, type OpsAlertEnvelope } from "./forwarders.js";
import {
  registerSloRoutes,
  registerBudgetRoutes,
  registerAlertIntakeRoutes,
  registerTenantHealthRoutes,
} from "./routes.js";

const logger = createLogger("alerts-proxy-svc");
const PORT = parseInt(process.env.ALERTS_PROXY_SVC_PORT || "3016", 10);
const IS_PROD = process.env.NODE_ENV === "production";

const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "";
if (IS_PROD && !INTERNAL_SERVICE_TOKEN) {
  throw new Error(
    "alerts-proxy-svc: INTERNAL_SERVICE_TOKEN must be set in production " +
      "(shared secret for inter-service calls to POST /api/alerts/page).",
  );
}
const EXPECTED_SERVICE_TOKEN = INTERNAL_SERVICE_TOKEN || (IS_PROD ? "" : "aivo-internal-dev-token");

function requireServiceToken(req: FastifyRequest, reply: FastifyReply): boolean {
  const presented = req.headers["x-service-token"];
  if (
    EXPECTED_SERVICE_TOKEN &&
    typeof presented === "string" &&
    presented === EXPECTED_SERVICE_TOKEN
  ) {
    return true;
  }
  logger.warn("ops_alert.proxy.auth_rejected", {
    hasToken: typeof presented === "string" && presented.length > 0,
  });
  reply.code(401).send({ error: "service token required" });
  return false;
}

export interface BuildServerOptions {
  channels?: ChannelConfig[];
  forwarderDeps?: ForwarderDeps;
}

export async function buildServer(opts: BuildServerOptions | ChannelConfig[] = {}) {
  const options: BuildServerOptions = Array.isArray(opts) ? { channels: opts } : opts;
  const channels = options.channels ?? loadChannels();
  const forwarderDeps: ForwarderDeps = options.forwarderDeps ?? {};

  const app = Fastify({ logger: false });
  await app.register(cors, { origin: true, credentials: true });

  app.get("/api/alerts/health", async () => {
    const configured = channels.filter((c) => c.configured).map((c) => c.id);
    const missing = REQUIRED_CHANNELS_IN_PROD.filter((id) => !configured.includes(id));
    return {
      status: "ok",
      service: "alerts-proxy-svc",
      timestamp: new Date().toISOString(),
      channels: configured,
      channelDetail: publicView(channels),
      missingRequired: missing,
      productionReady: missing.length === 0,
    };
  });

  app.post("/api/alerts/page", async (req, reply) => {
    if (!requireServiceToken(req, reply)) return;
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== "object") {
      return reply.code(400).send({ error: "missing body" });
    }
    if (
      typeof body.service !== "string" ||
      typeof body.title !== "string" ||
      typeof body.message !== "string"
    ) {
      return reply.code(400).send({ error: "service, title, and message are required" });
    }
    const severity =
      body.severity === "critical" || body.severity === "warning" ? body.severity : "info";
    const enabled = channels.filter((c) => c.configured);
    if (enabled.length === 0) {
      if (IS_PROD) {
        logger.error("ops_alert.proxy.no_channels_in_prod");
        return reply.code(503).send({ error: "no channels configured" });
      }
      logger.warn("ops_alert.proxy.no_channels_dev", { service: body.service });
      return { delivered: [], accepted: 0, results: [] };
    }

    const envelope: OpsAlertEnvelope = {
      id:
        typeof body.id === "string"
          ? body.id
          : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      service: body.service,
      severity,
      title: body.title,
      message: body.message,
      context:
        typeof body.context === "object" && body.context !== null
          ? (body.context as Record<string, unknown>)
          : undefined,
      occurredAt: typeof body.occurredAt === "string" ? body.occurredAt : new Date().toISOString(),
      attempt: typeof body.attempt === "number" ? body.attempt : 0,
    };

    const results = await fanOut(envelope, channels, forwarderDeps);
    const deliveredChannels = results.filter((r) => r.delivered).map((r) => r.channel);

    logger.info("ops_alert.proxy.page", {
      service: envelope.service,
      severity: envelope.severity,
      attempted: enabled.map((c) => c.id),
      delivered: deliveredChannels,
      results: results.map(({ channel, delivered, status, error, skipped }) => ({
        channel,
        delivered,
        status,
        error,
        skipped,
      })),
    });

    const allFailed = deliveredChannels.length === 0 && results.some((r) => !r.skipped);
    if (allFailed) {
      return reply.code(502).send({
        error: "all configured channels failed",
        results,
      });
    }
    return { delivered: deliveredChannels, accepted: results.length, results };
  });

  // SLOs, error budgets, alert intake (dedupe + auto-incident), per-tenant
  // health aggregation (Sprint 8).
  registerSloRoutes(app);
  registerBudgetRoutes(app);
  registerAlertIntakeRoutes(app);
  registerTenantHealthRoutes(app);

  return app;
}

async function start() {
  const channels = loadChannels();
  if (IS_PROD) {
    const missing = REQUIRED_CHANNELS_IN_PROD.filter(
      (id) => !channels.find((c) => c.id === id && c.configured),
    );
    if (missing.length > 0) {
      logger.warn(
        "alerts-proxy starting in production with missing channels — deploy smoke test should fail",
        { missing },
      );
    }
  }

  const app = await buildServer(channels);
  await app.listen({ port: PORT, host: "0.0.0.0" });
  logger.info("alerts-proxy listening", {
    port: PORT,
    channels: channels.filter((c) => c.configured).map((c) => c.id),
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch((err) => {
    console.error("Failed to start alerts-proxy-svc:", err);
    process.exit(1);
  });
}
