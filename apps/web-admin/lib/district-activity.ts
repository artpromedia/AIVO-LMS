/**
 * District audit-trail client (Sprint B4) — thin server-side wrapper over
 * identity-svc's tenant-scoped activity routes:
 *
 *   GET /api/district/activity          paged list (q/action/date filters)
 *   GET /api/district/activity/export   CSV / NDJSON download (audited)
 *   GET /api/district/activity/verify   hash-chain verification
 *
 * Auth follows the district sso-config page pattern: the caller's
 * identity-svc access token rides as a bearer; identity enforces tenant
 * scope (DISTRICT_ADMIN's own tenant; PLATFORM_ADMIN via ?tenantId=).
 */
import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import type { SessionProfile } from "@aivo/admin-auth/types";

const IDENTITY_URL = process.env.IDENTITY_SVC_URL || "http://localhost:3001";

export interface DistrictActivityRow {
  id: string;
  action: string;
  actorId: string;
  actorName: string | null;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  hash: string | null;
}

export interface DistrictActivityPage {
  rows: DistrictActivityRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DistrictActivityFilters {
  page?: number;
  pageSize?: number;
  q?: string;
  action?: string;
  from?: string;
  to?: string;
}

export interface DistrictChainVerification {
  intact: boolean;
  checkedRows: number;
  skippedLegacyRows: number;
  firstSeq: number | null;
  lastSeq: number | null;
  brokenAtSeq: number | null;
  anchored: boolean;
  from: string | null;
  to: string | null;
}

async function bearer(): Promise<string> {
  const jar = await cookies();
  return jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value ?? "";
}

function withTenantScope(
  params: URLSearchParams,
  session: Pick<SessionProfile, "role" | "tenantId">,
): URLSearchParams {
  // PLATFORM_ADMIN tokens carry tenantId: null; identity-svc accepts an
  // explicit ?tenantId= from them. District admins are scoped by token.
  if (session.role === "platform_admin" && session.tenantId) {
    params.set("tenantId", session.tenantId);
  }
  return params;
}

export function buildActivityQuery(filters: DistrictActivityFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.q) params.set("q", filters.q);
  if (filters.action) params.set("action", filters.action);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return params;
}

export async function listDistrictActivity(
  session: Pick<SessionProfile, "role" | "tenantId">,
  filters: DistrictActivityFilters = {},
): Promise<DistrictActivityPage> {
  const params = withTenantScope(buildActivityQuery(filters), session);
  const res = await fetch(`${IDENTITY_URL}/api/district/activity?${params}`, {
    headers: { authorization: `Bearer ${await bearer()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`district activity read failed (${res.status})`);
  const json = (await res.json()) as {
    activities?: unknown[];
    total?: number;
    page?: number;
    pageSize?: number;
  };
  const rows = (json.activities ?? []).map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      action: String(row.action ?? "unknown"),
      actorId: String(row.actorId ?? ""),
      actorName: row.actorName ? String(row.actorName) : null,
      resourceType: String(row.resourceType ?? "unknown"),
      resourceId: row.resourceId ? String(row.resourceId) : null,
      details: (row.details as Record<string, unknown> | null) ?? null,
      createdAt: String(row.createdAt ?? new Date(0).toISOString()),
      hash: row.hash ? String(row.hash) : null,
    } satisfies DistrictActivityRow;
  });
  return {
    rows,
    total: Number(json.total ?? rows.length),
    page: Number(json.page ?? filters.page ?? 1),
    pageSize: Number(json.pageSize ?? filters.pageSize ?? 30),
  };
}

export async function verifyDistrictActivityChain(
  session: Pick<SessionProfile, "role" | "tenantId">,
  range: { from?: string; to?: string } = {},
): Promise<DistrictChainVerification> {
  const params = withTenantScope(new URLSearchParams(), session);
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  const res = await fetch(`${IDENTITY_URL}/api/district/activity/verify?${params}`, {
    headers: { authorization: `Bearer ${await bearer()}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`district activity verify failed (${res.status})`);
  return (await res.json()) as DistrictChainVerification;
}

/** Proxy an export download from identity-svc (CSV or NDJSON). */
export async function fetchDistrictActivityExport(
  session: Pick<SessionProfile, "role" | "tenantId">,
  opts: { format: "csv" | "json"; action?: string; from?: string; to?: string },
): Promise<Response> {
  const params = withTenantScope(new URLSearchParams(), session);
  params.set("format", opts.format);
  if (opts.action) params.set("action", opts.action);
  if (opts.from) params.set("from", opts.from);
  if (opts.to) params.set("to", opts.to);
  return fetch(`${IDENTITY_URL}/api/district/activity/export?${params}`, {
    headers: { authorization: `Bearer ${await bearer()}` },
    cache: "no-store",
  });
}
