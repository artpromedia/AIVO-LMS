import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@/lib/auth/types";

export interface AdminApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  tenantId: string | null;
  createdBy: string | null;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  rotatedFromId: string | null;
  gracePeriodEndsAt: string | null;
  createdAt: string;
}

function mapApiKey(row: Record<string, unknown>): AdminApiKey {
  return {
    id: String(row.id),
    name: String(row.name ?? row.id),
    keyPrefix: String(row.keyPrefix ?? ""),
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    tenantId: row.tenantId ? String(row.tenantId) : null,
    createdBy: row.createdBy ? String(row.createdBy) : null,
    expiresAt: row.expiresAt ? String(row.expiresAt) : null,
    lastUsedAt: row.lastUsedAt ? String(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? String(row.revokedAt) : null,
    rotatedFromId: row.rotatedFromId ? String(row.rotatedFromId) : null,
    gracePeriodEndsAt: row.gracePeriodEndsAt ? String(row.gracePeriodEndsAt) : null,
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
  };
}

export async function listAdminApiKeys(
  session: Pick<SessionProfile, "role">,
): Promise<AdminApiKey[]> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/api-keys");
  const keys = Array.isArray(payload.keys) ? payload.keys : [];
  return keys.map((key) => mapApiKey(key as Record<string, unknown>));
}
