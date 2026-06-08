import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { securityRoleForWebRole } from "@aivo/admin-auth/permissions";
import type { SessionProfile } from "@aivo/admin-auth/types";
import { AdminApiError } from "./client.js";
import { dataGovernanceSvcUrl, internalServiceToken } from "./env.js";

/**
 * Admin surface for Data Subject Access Requests (DSAR).
 *
 * Talks directly to data-governance-svc (the owning service), which persists
 * to the Postgres `dsar_requests` / `dsar_events` tables (@aivo/db). No local
 * or mock store — every call hits the live service and its database. Mirrors
 * the direct-service pattern used by identity.ts / sis.ts.
 *
 *   GET  /dsar?status=                 -> { requests: [...,{sla}], kpis }
 *   GET  /dsar/:id                     -> { request, timeline, sla }
 *   POST /dsar/:id/verify-identity     -> updated request
 *   POST /dsar/:id/assign              -> updated request
 *   POST /dsar/:id/approve             -> updated request
 *   POST /dsar/:id/reject              -> updated request
 *   POST /dsar/:id/fulfill             -> updated request
 */

type GovMethod = "GET" | "POST";

export type DsarType =
  | "access"
  | "erasure"
  | "portability"
  | "rectification"
  | "restriction"
  | "objection";

export type DsarStatus =
  | "intake"
  | "identity_verification"
  | "assigned"
  | "approved"
  | "fulfilling"
  | "fulfilled"
  | "rejected";

export type SlaState = "on_track" | "due_soon" | "overdue" | "met";

export interface DsarSla {
  state: SlaState;
  fulfillmentRemainingMs: number | null;
}

export interface DsarRequestSummary {
  id: string;
  tenantId: string | null;
  type: DsarType;
  regulation: string;
  subjectId: string;
  subjectType: string;
  subjectEmail: string | null;
  status: DsarStatus;
  identityVerified: boolean;
  assigneeId: string | null;
  onBehalfOfMinor: boolean;
  ackDueAt: string | null;
  fulfillmentDueAt: string | null;
  fulfilledAt: string | null;
  createdAt: string;
  updatedAt: string;
  sla: DsarSla;
}

export interface DsarTimelineEvent {
  id: string;
  eventType: string;
  actorId: string | null;
  actorRole: string | null;
  detail: Record<string, unknown>;
  createdAt: string;
}

export interface DsarKpis {
  open: number;
  overdue: number;
  fulfilled: number;
  avgFulfillmentHours: number | null;
}

export interface DsarQueue {
  requests: DsarRequestSummary[];
  kpis: DsarKpis;
}

export interface DsarDetail {
  request: DsarRequestSummary;
  timeline: DsarTimelineEvent[];
}

export const DSAR_STATUSES: DsarStatus[] = [
  "intake",
  "identity_verification",
  "assigned",
  "approved",
  "fulfilling",
  "fulfilled",
  "rejected",
];

async function governanceRequest<T>(
  session: Pick<SessionProfile, "role">,
  method: GovMethod,
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
): Promise<T> {
  const token = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new AdminApiError("Missing admin access token", 401);

  const url = new URL(path, dataGovernanceSvcUrl());
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === "") continue;
    url.searchParams.set(key, value);
  }

  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "x-aivo-active-role": String(securityRoleForWebRole(session.role)),
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  const serviceToken = internalServiceToken();
  if (serviceToken) headers.set("x-service-token", serviceToken);

  const response = await fetch(url, {
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
        : `data-governance-svc request failed (${response.status})`;
    throw new AdminApiError(message, response.status, payload);
  }
  return payload as T;
}

function str(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function nullableStr(value: unknown): string | null {
  return value === null || value === undefined ? null : String(value);
}

function mapSla(value: unknown): DsarSla {
  const row = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const state = str(row.state);
  return {
    state: (["on_track", "due_soon", "overdue", "met"].includes(state)
      ? state
      : "on_track") as SlaState,
    fulfillmentRemainingMs:
      row.fulfillmentRemainingMs === null || row.fulfillmentRemainingMs === undefined
        ? null
        : Number(row.fulfillmentRemainingMs),
  };
}

function mapRequest(row: Record<string, unknown>): DsarRequestSummary {
  return {
    id: str(row.id),
    tenantId: nullableStr(row.tenantId),
    type: str(row.type) as DsarType,
    regulation: str(row.regulation || "gdpr"),
    subjectId: str(row.subjectId),
    subjectType: str(row.subjectType || "learner"),
    subjectEmail: nullableStr(row.subjectEmail),
    status: str(row.status || "intake") as DsarStatus,
    identityVerified: Boolean(row.identityVerified),
    assigneeId: nullableStr(row.assigneeId),
    onBehalfOfMinor: Boolean(row.onBehalfOfMinor),
    ackDueAt: nullableStr(row.ackDueAt),
    fulfillmentDueAt: nullableStr(row.fulfillmentDueAt),
    fulfilledAt: nullableStr(row.fulfilledAt),
    createdAt: str(row.createdAt) || new Date(0).toISOString(),
    updatedAt: str(row.updatedAt) || new Date(0).toISOString(),
    sla: mapSla(row.sla),
  };
}

export async function listDsarRequests(
  session: Pick<SessionProfile, "role">,
  status?: DsarStatus,
): Promise<DsarQueue> {
  const payload = await governanceRequest<Record<string, unknown>>(
    session,
    "GET",
    "/dsar",
    undefined,
    { status },
  );
  const rows = Array.isArray(payload.requests) ? payload.requests : [];
  const kpis = payload.kpis && typeof payload.kpis === "object" ? (payload.kpis as Record<string, unknown>) : {};
  return {
    requests: rows.map((row) => mapRequest(row as Record<string, unknown>)),
    kpis: {
      open: Number(kpis.open ?? 0),
      overdue: Number(kpis.overdue ?? 0),
      fulfilled: Number(kpis.fulfilled ?? 0),
      avgFulfillmentHours:
        kpis.avgFulfillmentHours === null || kpis.avgFulfillmentHours === undefined
          ? null
          : Number(kpis.avgFulfillmentHours),
    },
  };
}

export async function getDsarRequest(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<DsarDetail> {
  const payload = await governanceRequest<Record<string, unknown>>(
    session,
    "GET",
    `/dsar/${encodeURIComponent(id)}`,
  );
  const request = mapRequest({
    ...((payload.request as Record<string, unknown>) ?? {}),
    sla: payload.sla,
  });
  const timeline = Array.isArray(payload.timeline) ? payload.timeline : [];
  return {
    request,
    timeline: timeline.map((event) => {
      const row = event as Record<string, unknown>;
      return {
        id: str(row.id),
        eventType: str(row.eventType),
        actorId: nullableStr(row.actorId),
        actorRole: nullableStr(row.actorRole),
        detail:
          row.detail && typeof row.detail === "object"
            ? (row.detail as Record<string, unknown>)
            : {},
        createdAt: str(row.createdAt) || new Date(0).toISOString(),
      };
    }),
  };
}

export async function verifyDsarIdentity(
  session: Pick<SessionProfile, "role">,
  id: string,
  method = "manual",
): Promise<void> {
  await governanceRequest(session, "POST", `/dsar/${encodeURIComponent(id)}/verify-identity`, {
    method,
  });
}

export async function assignDsar(
  session: Pick<SessionProfile, "role">,
  id: string,
  assigneeId: string,
): Promise<void> {
  await governanceRequest(session, "POST", `/dsar/${encodeURIComponent(id)}/assign`, { assigneeId });
}

export async function approveDsar(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<void> {
  await governanceRequest(session, "POST", `/dsar/${encodeURIComponent(id)}/approve`);
}

export async function rejectDsar(
  session: Pick<SessionProfile, "role">,
  id: string,
  reason: string,
): Promise<void> {
  await governanceRequest(session, "POST", `/dsar/${encodeURIComponent(id)}/reject`, { reason });
}

export async function fulfillDsar(
  session: Pick<SessionProfile, "role">,
  id: string,
  evidence: Record<string, unknown> = {},
): Promise<void> {
  await governanceRequest(session, "POST", `/dsar/${encodeURIComponent(id)}/fulfill`, evidence);
}
