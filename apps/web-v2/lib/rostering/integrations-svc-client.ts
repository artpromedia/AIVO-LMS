/**
 * Typed REST client for `services/integrations-svc` SIS/rostering (ADR 0015).
 *
 * The CANONICAL SIS connection + roster-sync state is owned by integrations-svc
 * (and the teacher-rostering grant by identity-svc). web-v2 persists only its
 * own import-job / error / mapping aggregates (web_* tables, see
 * drizzle/rostering.ts) and READS the canonical connection/sync state from
 * integrations-svc over REST. No fabricated fallback: a non-2xx or unreachable
 * upstream raises `IntegrationsSvcError` so the caller surfaces a typed error
 * instead of synthesizing connection/sync data.
 *
 * Server-only: reads the service token. Never import from client code.
 */
import { serverEnv } from "@/lib/env";

export class IntegrationsSvcError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly path: string,
  ) {
    super(message);
    this.name = "IntegrationsSvcError";
  }
}

/** Canonical SIS connection as integrations-svc returns it. */
export interface IntegrationsSisConnection {
  id: string;
  tenantId: string;
  provider: string;
  status: string;
  lastSyncedAt: string | null;
}

/** Canonical sync-run summary as integrations-svc returns it. */
export interface IntegrationsSyncRun {
  id: string;
  connectionId: string;
  type: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  errorCount: number;
}

async function getJson<T>(path: string): Promise<T> {
  const base = serverEnv.INTEGRATION_SVC_URL.replace(/\/$/, "");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverEnv.AIVO_SERVICE_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      headers: {
        accept: "application/json",
        ...(serverEnv.INTERNAL_SERVICE_TOKEN
          ? { "x-service-token": serverEnv.INTERNAL_SERVICE_TOKEN }
          : {}),
      },
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (e) {
    throw new IntegrationsSvcError(
      `integrations-svc unreachable: ${e instanceof Error ? e.message : "network error"}`,
      null,
      path,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let detail = "";
    try {
      detail = (await res.text()).slice(0, 500);
    } catch {
      /* ignore */
    }
    throw new IntegrationsSvcError(
      `integrations-svc ${res.status} for ${path}${detail ? `: ${detail}` : ""}`,
      res.status,
      path,
    );
  }
  return (await res.json()) as T;
}

export const integrationsSvcClient = {
  /** Canonical SIS connections for a tenant. */
  listSisConnections(tenantId: string): Promise<IntegrationsSisConnection[]> {
    return getJson<IntegrationsSisConnection[]>(
      `/api/integrations/tenants/${encodeURIComponent(tenantId)}/sis-connections`,
    );
  },
  /** Recent sync runs for a connection. */
  listSyncRuns(connectionId: string): Promise<IntegrationsSyncRun[]> {
    return getJson<IntegrationsSyncRun[]>(
      `/api/integrations/sis-connections/${encodeURIComponent(connectionId)}/runs`,
    );
  },
};
