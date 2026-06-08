import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { securityRoleForWebRole } from "@aivo/admin-auth/permissions";
import type { SessionProfile } from "@aivo/admin-auth/types";
import { AdminApiError } from "./client.js";
import { dataGovernanceSvcUrl, internalServiceToken } from "./env.js";

/**
 * Admin surface for data-retention policies.
 *
 * Talks directly to data-governance-svc, which persists overrides to the
 * Postgres `retention_policies` table (@aivo/db) and merges them with the
 * static data-class catalog. No mock store.
 *
 *   GET /retention/policies                 -> { policies }
 *   PUT /retention/policies/:dataClass      -> updated policy
 */

type RetentionMethod = "GET" | "PUT";

export type RetentionDisposition = "purge" | "anonymize";

export interface RetentionPolicy {
  dataClass: string;
  tenantId: string | null;
  retentionDays: number | null;
  disposition: RetentionDisposition;
  legalHold: boolean;
  updatedById: string | null;
  updatedAt: string;
}

async function governanceRequest<T>(
  session: Pick<SessionProfile, "role">,
  method: RetentionMethod,
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

  const response = await fetch(new URL(path, dataGovernanceSvcUrl()), {
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

function mapPolicy(row: Record<string, unknown>): RetentionPolicy {
  const disposition = String(row.disposition ?? "purge");
  return {
    dataClass: String(row.dataClass ?? ""),
    tenantId: row.tenantId === null || row.tenantId === undefined ? null : String(row.tenantId),
    retentionDays:
      row.retentionDays === null || row.retentionDays === undefined
        ? null
        : Number(row.retentionDays),
    disposition: disposition === "anonymize" ? "anonymize" : "purge",
    legalHold: Boolean(row.legalHold),
    updatedById:
      row.updatedById === null || row.updatedById === undefined ? null : String(row.updatedById),
    updatedAt: String(row.updatedAt ?? new Date(0).toISOString()),
  };
}

export async function listRetentionPolicies(
  session: Pick<SessionProfile, "role">,
): Promise<RetentionPolicy[]> {
  const payload = await governanceRequest<Record<string, unknown>>(
    session,
    "GET",
    "/retention/policies",
  );
  const rows = Array.isArray(payload.policies) ? payload.policies : [];
  return rows.map((row) => mapPolicy(row as Record<string, unknown>));
}

export async function setRetentionPolicy(
  session: Pick<SessionProfile, "role">,
  dataClass: string,
  input: {
    retentionDays: number | null;
    disposition: RetentionDisposition;
    legalHold: boolean;
    tenantId?: string | null;
  },
): Promise<RetentionPolicy> {
  const row = await governanceRequest<Record<string, unknown>>(
    session,
    "PUT",
    `/retention/policies/${encodeURIComponent(dataClass)}`,
    {
      retentionDays: input.retentionDays,
      disposition: input.disposition,
      legalHold: input.legalHold,
      tenantId: input.tenantId ?? null,
    },
  );
  return mapPolicy(row);
}
