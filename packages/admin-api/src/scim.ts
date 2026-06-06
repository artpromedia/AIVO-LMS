import "server-only";

import { adminGet } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

export interface AdminScimToken {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

function mapScimToken(row: Record<string, unknown>): AdminScimToken {
  return {
    id: String(row.id),
    name: String(row.name ?? row.id),
    prefix: String(row.prefix ?? ""),
    createdAt: String(row.createdAt ?? new Date(0).toISOString()),
    lastUsedAt: row.lastUsedAt ? String(row.lastUsedAt) : null,
    revokedAt: row.revokedAt ? String(row.revokedAt) : null,
  };
}

export async function listScimTokens(
  session: Pick<SessionProfile, "role">,
  tenantId: string,
): Promise<AdminScimToken[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/scim-tokens",
    { tenantId },
  );
  const tokens = Array.isArray(payload.tokens) ? payload.tokens : [];
  return tokens.map((token) => mapScimToken(token as Record<string, unknown>));
}
