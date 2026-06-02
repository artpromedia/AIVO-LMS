import { FastifyInstance } from "fastify";
import { createLogger } from "@aivo/observability";
import { opsAlertsOutboxSchema } from "./schemas.js";

const logger = createLogger("status-page-svc:ops-alerts-outbox");

const IS_PROD = process.env.NODE_ENV === "production";

interface OutboxSource {
  service: string;
  url: string;
}

interface OutboxTile {
  service: string;
  state: "healthy" | "warning" | "unreachable";
  storeKind: string | null;
  depth: number;
  enqueuedTotal: number;
  drainedTotal: number;
  droppedTotal: number;
  firstNonZeroAt: string | null;
  lastEnqueuedAt: string | null;
  lastDrainedAt: string | null;
  lastShutdown: {
    drained: number;
    lost: number;
    flushTimedOut: boolean;
    finishedAt: string;
  } | null;
  lastAutoFlushAt: string | null;
  autoFlushTicksTotal: number;
  autoFlushDrainedTotal: number;
  autoFlushErrorsTotal: number;
  /** stale if shutdown timestamp older than this many minutes */
  shutdownStale: boolean;
  fetchedAt: string;
  error?: string;
}

const SHUTDOWN_STALE_MINUTES = 24 * 60;

const WARNING_AFTER = 3;
const consecutiveWarnings: Record<string, number> = {};
const lastEscalationAt: Record<string, number> = {};
const ESCALATION_COOLDOWN_MS = 30 * 60 * 1000;

// Every service that calls bootstrapOpsAlerts (i.e. registers
// /api/internal/ops-alerts-outbox) goes here. We resolve each one's URL
// from the same *_SVC_URL env vars used by the existing service-health
// dashboard so a single deploy doesn't have to touch two configs.
const DEFAULT_SOURCE_KEYS: Array<{ service: string; envKey: string; devDefault: string }> = [
  { service: "identity-svc", envKey: "IDENTITY_SVC_URL", devDefault: "http://localhost:3001" },
  { service: "assessment-svc", envKey: "ASSESSMENT_SVC_URL", devDefault: "http://localhost:3003" },
  { service: "learning-svc", envKey: "LEARNING_SVC_URL", devDefault: "http://localhost:3005" },
  { service: "tutor-svc", envKey: "TUTOR_SVC_URL", devDefault: "http://localhost:3006" },
  { service: "family-svc", envKey: "FAMILY_SVC_URL", devDefault: "http://localhost:3007" },
  { service: "engagement-svc", envKey: "ENGAGEMENT_SVC_URL", devDefault: "http://localhost:3008" },
  { service: "billing-svc", envKey: "BILLING_SVC_URL", devDefault: "http://localhost:3009" },
  { service: "comms-svc", envKey: "COMMS_SVC_URL", devDefault: "http://localhost:3010" },
  { service: "i18n-svc", envKey: "I18N_SVC_URL", devDefault: "http://localhost:3011" },
  {
    service: "integration-svc",
    envKey: "INTEGRATION_SVC_URL",
    devDefault: "http://localhost:3068",
  },
  { service: "admin-svc", envKey: "ADMIN_SVC_URL", devDefault: "http://localhost:3013" },
  { service: "research-svc", envKey: "RESEARCH_SVC_URL", devDefault: "http://localhost:3015" },
];

function loadSources(): OutboxSource[] {
  const raw = process.env.OPS_ALERT_OUTBOX_SOURCES || "";
  if (raw.trim().length === 0) {
    // Fallback: every service that is wired to bootstrapOpsAlerts. Resolves
    // each service's URL from the existing *_SVC_URL env (or its dev default).
    return DEFAULT_SOURCE_KEYS.map(({ service, envKey, devDefault }) => ({
      service,
      url: (process.env[envKey] || devDefault).replace(/\/$/, ""),
    }));
  }
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map((entry) => {
      const [service, url] = entry.split("=");
      if (!service || !url) {
        throw new Error(
          `OPS_ALERT_OUTBOX_SOURCES: invalid entry "${entry}", expected "service=url"`,
        );
      }
      return { service: service.trim(), url: url.trim().replace(/\/$/, "") };
    });
}

async function fetchTile(source: OutboxSource): Promise<OutboxTile> {
  const fetchedAt = new Date().toISOString();
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  try {
    const res = await fetch(`${source.url}/api/internal/ops-alerts-outbox`, {
      signal: AbortSignal.timeout(5000),
      headers: token
        ? { "x-service-token": token, "x-internal-service": "status-page-svc" }
        : undefined,
    });
    if (!res.ok) {
      return {
        service: source.service,
        state: "unreachable",
        storeKind: null,
        depth: 0,
        enqueuedTotal: 0,
        drainedTotal: 0,
        droppedTotal: 0,
        firstNonZeroAt: null,
        lastEnqueuedAt: null,
        lastDrainedAt: null,
        lastShutdown: null,
        lastAutoFlushAt: null,
        autoFlushTicksTotal: 0,
        autoFlushDrainedTotal: 0,
        autoFlushErrorsTotal: 0,
        shutdownStale: true,
        fetchedAt,
        error: `HTTP ${res.status}`,
      };
    }
    const data = (await res.json()) as any;
    const depth: number = data.depth ?? 0;
    const droppedTotal: number = data.droppedTotal ?? 0;
    const state: OutboxTile["state"] = depth > 0 || droppedTotal > 0 ? "warning" : "healthy";
    const lastShutdown = data.lastShutdown
      ? {
          drained: data.lastShutdown.drained ?? 0,
          lost: data.lastShutdown.lost ?? 0,
          flushTimedOut: Boolean(data.lastShutdown.flushTimedOut),
          finishedAt: data.lastShutdown.finishedAt ?? fetchedAt,
        }
      : null;
    const shutdownStale = lastShutdown
      ? Date.now() - new Date(lastShutdown.finishedAt).getTime() > SHUTDOWN_STALE_MINUTES * 60_000
      : true;
    return {
      service: source.service,
      state,
      storeKind: data.storeKind ?? null,
      depth,
      enqueuedTotal: data.enqueuedTotal ?? 0,
      drainedTotal: data.drainedTotal ?? 0,
      droppedTotal,
      firstNonZeroAt: data.firstNonZeroAt ?? null,
      lastEnqueuedAt: data.lastEnqueuedAt ?? null,
      lastDrainedAt: data.lastDrainedAt ?? null,
      lastShutdown,
      lastAutoFlushAt: data.lastAutoFlushAt ?? null,
      autoFlushTicksTotal: data.autoFlushTicksTotal ?? 0,
      autoFlushDrainedTotal: data.autoFlushDrainedTotal ?? 0,
      autoFlushErrorsTotal: data.autoFlushErrorsTotal ?? 0,
      shutdownStale,
      fetchedAt,
    };
  } catch (err: any) {
    return {
      service: source.service,
      state: "unreachable",
      storeKind: null,
      depth: 0,
      enqueuedTotal: 0,
      drainedTotal: 0,
      droppedTotal: 0,
      firstNonZeroAt: null,
      lastEnqueuedAt: null,
      lastDrainedAt: null,
      lastShutdown: null,
      lastAutoFlushAt: null,
      autoFlushTicksTotal: 0,
      autoFlushDrainedTotal: 0,
      autoFlushErrorsTotal: 0,
      shutdownStale: true,
      fetchedAt,
      error: err?.message ?? "unknown",
    };
  }
}

async function escalate(tile: OutboxTile, consecutive: number) {
  const last = lastEscalationAt[tile.service] || 0;
  if (Date.now() - last < ESCALATION_COOLDOWN_MS) return;
  lastEscalationAt[tile.service] = Date.now();
  const commsUrl = process.env.COMMS_SVC_URL || (IS_PROD ? "" : "http://localhost:3010");
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token || !commsUrl) {
    logger.error(
      { service: tile.service, consecutive },
      "ops_alerts_outbox.escalation_skipped_no_token_or_url",
    );
    return;
  }
  try {
    await fetch(`${commsUrl}/api/comms/alerts/admin`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service": "status-page-svc",
        "x-service-token": token,
      },
      body: JSON.stringify({
        severity: "critical",
        title: `On-call queue not draining: ${tile.service}`,
        message: `ops-alerts outbox depth=${tile.depth} dropped=${tile.droppedTotal} for ${consecutive} consecutive checks.`,
        source: "status-page-svc",
      }),
    });
    logger.info({ service: tile.service, consecutive }, "ops_alerts_outbox.escalation_fired");
  } catch (err: any) {
    logger.error(
      { service: tile.service, err: err.message },
      "ops_alerts_outbox.escalation_failed",
    );
  }
}

export function registerOpsAlertsOutboxRoutes(app: FastifyInstance) {
  app.get("/api/status/ops-alerts-outbox", { schema: opsAlertsOutboxSchema }, async () => {
    const sources = loadSources();
    const tiles = await Promise.all(sources.map(fetchTile));
    for (const tile of tiles) {
      if (tile.state === "warning") {
        consecutiveWarnings[tile.service] = (consecutiveWarnings[tile.service] || 0) + 1;
        if (consecutiveWarnings[tile.service] >= WARNING_AFTER) {
          escalate(tile, consecutiveWarnings[tile.service]).catch(() => {});
        }
      } else if (tile.state === "healthy") {
        consecutiveWarnings[tile.service] = 0;
      }
    }
    return {
      tiles,
      thresholds: { warningAfter: WARNING_AFTER, shutdownStaleMinutes: SHUTDOWN_STALE_MINUTES },
      checkedAt: new Date().toISOString(),
    };
  });
}
