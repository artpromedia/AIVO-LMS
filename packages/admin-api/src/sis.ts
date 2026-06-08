import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { securityRoleForWebRole } from "@aivo/admin-auth/permissions";
import type { SessionProfile } from "@aivo/admin-auth/types";
import { AdminApiError } from "./client.js";
import { integrationSvcUrl, internalServiceToken } from "./env.js";

/**
 * Read/operate surface for SIS roster connectors.
 *
 * Talks directly to integration-svc (the owning service), which is backed by
 * the Postgres tables `integration_connections` / `integration_sync_logs`
 * (@aivo/db). There is NO local/mock store — every call hits the live service
 * and its database. Mirrors the direct-service pattern used by identity.ts.
 *
 *   GET  /api/integrations/connections/:tenantId   -> { tenantId, connections }
 *   GET  /api/integrations/connection/:connectionId
 *   GET  /api/integrations/sync-logs/:connectionId  -> { logs } | log[]
 *   POST /api/integrations/sync/:connectionId       -> { status, connectionId }
 */

type IntegrationMethod = "GET" | "POST";

export type SisConnectionStatus =
  | "pending"
  | "connected"
  | "syncing"
  | "disconnected"
  | "error";

export type SisSyncStatus = "pending" | "running" | "success" | "failed";

export interface SisConnection {
  id: string;
  tenantId: string;
  connectorId: string;
  connectorName: string;
  connectorType: string;
  status: SisConnectionStatus;
  externalOrgId: string | null;
  hasCredentials: boolean;
  lastSyncAt: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SisSyncLog {
  id: string;
  connectionId: string;
  syncType: string;
  status: SisSyncStatus;
  recordsSynced: number;
  recordsFailed: number;
  recordsSkipped: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
}

async function integrationRequest<T>(
  session: Pick<SessionProfile, "role">,
  method: IntegrationMethod,
  path: string,
  body?: unknown,
): Promise<T> {
  const token = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new AdminApiError("Missing admin access token", 401);

  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "x-aivo-active-role": String(securityRoleForWebRole(session.role)),
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  const serviceToken = internalServiceToken();
  if (serviceToken) headers.set("x-service-token", serviceToken);

  const response = await fetch(new URL(path, integrationSvcUrl()), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error
        : `integration-svc request failed (${response.status})`;
    throw new AdminApiError(message, response.status, payload);
  }
  return payload as T;
}

function normalizeConnectionStatus(value: unknown): SisConnectionStatus {
  const status = String(value ?? "pending");
  return status === "connected" ||
    status === "syncing" ||
    status === "disconnected" ||
    status === "error"
    ? status
    : "pending";
}

function normalizeSyncStatus(value: unknown): SisSyncStatus {
  const status = String(value ?? "pending");
  return status === "running" || status === "success" || status === "failed" ? status : "pending";
}

function mapConnection(row: Record<string, unknown>): SisConnection {
  return {
    id: String(row.id),
    tenantId: String(row.tenantId ?? ""),
    connectorId: String(row.connectorId ?? ""),
    connectorName: String(row.connectorName ?? row.connectorId ?? "unknown"),
    connectorType: String(row.connectorType ?? "unknown"),
    status: normalizeConnectionStatus(row.status),
    externalOrgId: row.externalOrgId ? String(row.externalOrgId) : null,
    hasCredentials: Boolean(row.hasCredentials),
    lastSyncAt: row.lastSyncAt ? String(row.lastSyncAt) : null,
    connectedAt: row.connectedAt ? String(row.connectedAt) : null,
    disconnectedAt: row.disconnectedAt ? String(row.disconnectedAt) : null,
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    updatedAt: String(row.updatedAt ?? new Date(0).toISOString()),
  };
}

function mapSyncLog(row: Record<string, unknown>): SisSyncLog {
  return {
    id: String(row.id),
    connectionId: String(row.connectionId ?? ""),
    syncType: String(row.syncType ?? "full"),
    status: normalizeSyncStatus(row.status),
    recordsSynced: Number(row.recordsSynced ?? 0),
    recordsFailed: Number(row.recordsFailed ?? 0),
    recordsSkipped: Number(row.recordsSkipped ?? 0),
    startedAt: String(row.startedAt ?? new Date(0).toISOString()),
    completedAt: row.completedAt ? String(row.completedAt) : null,
    durationMs: row.durationMs === null || row.durationMs === undefined ? null : Number(row.durationMs),
  };
}

export async function listSisConnections(
  session: Pick<SessionProfile, "role">,
  tenantId: string,
): Promise<SisConnection[]> {
  const payload = await integrationRequest<Record<string, unknown>>(
    session,
    "GET",
    `/api/integrations/connections/${encodeURIComponent(tenantId)}`,
  );
  const rows = Array.isArray(payload.connections) ? payload.connections : [];
  return rows.map((row) => mapConnection(row as Record<string, unknown>));
}

export async function getSisConnection(
  session: Pick<SessionProfile, "role">,
  connectionId: string,
): Promise<SisConnection> {
  const row = await integrationRequest<Record<string, unknown>>(
    session,
    "GET",
    `/api/integrations/connection/${encodeURIComponent(connectionId)}`,
  );
  return mapConnection(row);
}

export async function listSisSyncLogs(
  session: Pick<SessionProfile, "role">,
  connectionId: string,
): Promise<SisSyncLog[]> {
  const payload = await integrationRequest<unknown>(
    session,
    "GET",
    `/api/integrations/sync-logs/${encodeURIComponent(connectionId)}`,
  );
  const rows = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && Array.isArray((payload as Record<string, unknown>).logs)
      ? ((payload as Record<string, unknown>).logs as unknown[])
      : [];
  return rows.map((row) => mapSyncLog(row as Record<string, unknown>));
}

export async function triggerSisSync(
  session: Pick<SessionProfile, "role">,
  connectionId: string,
): Promise<{ status: string; connectionId: string }> {
  const payload = await integrationRequest<Record<string, unknown>>(
    session,
    "POST",
    `/api/integrations/sync/${encodeURIComponent(connectionId)}`,
  );
  return {
    status: String(payload.status ?? "sync_started"),
    connectionId: String(payload.connectionId ?? connectionId),
  };
}
