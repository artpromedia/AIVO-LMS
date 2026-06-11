import "server-only";

import { adminGet, adminPost } from "./client";
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

// ── Sprint B5 — token issue/revoke + unmapped-group review + activity ──

export interface IssuedScimToken {
  token: AdminScimToken;
  /** Shown exactly once; never persisted in plaintext. */
  plaintext: string;
}

export async function issueScimToken(
  session: Pick<SessionProfile, "role">,
  tenantId: string,
  name: string,
): Promise<IssuedScimToken> {
  const payload = await adminPost<Record<string, unknown>>(session, "/api/admin-svc/scim-tokens", {
    tenantId,
    name,
  });
  return {
    token: mapScimToken((payload.token ?? {}) as Record<string, unknown>),
    plaintext: String(payload.plaintext ?? ""),
  };
}

export async function revokeScimToken(
  session: Pick<SessionProfile, "role">,
  tokenId: string,
): Promise<void> {
  await adminPost(session, `/api/admin-svc/scim-tokens/${encodeURIComponent(tokenId)}/revoke`, {});
}

export interface AdminScimUnmappedGroup {
  id: string;
  displayName: string;
  externalId: string | null;
  reason: string;
  memberCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  seenCount: number;
}

export async function listScimUnmappedGroups(
  session: Pick<SessionProfile, "role">,
  tenantId: string,
): Promise<AdminScimUnmappedGroup[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/scim-unmapped-groups",
    { tenantId },
  );
  const groups = Array.isArray(payload.groups) ? payload.groups : [];
  return groups.map((raw) => {
    const row = raw as Record<string, unknown>;
    return {
      id: String(row.id),
      displayName: String(row.displayName ?? ""),
      externalId: row.externalId ? String(row.externalId) : null,
      reason: String(row.reason ?? ""),
      memberCount: Number(row.memberCount ?? 0),
      firstSeenAt: String(row.firstSeenAt ?? new Date(0).toISOString()),
      lastSeenAt: String(row.lastSeenAt ?? new Date(0).toISOString()),
      seenCount: Number(row.seenCount ?? 1),
    };
  });
}

export async function resolveScimUnmappedGroup(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<void> {
  await adminPost(
    session,
    `/api/admin-svc/scim-unmapped-groups/${encodeURIComponent(id)}/resolve`,
    {},
  );
}

export interface AdminScimActivity {
  counters: Record<string, number>;
  lastSyncAt: string | null;
}

export async function getScimActivity(
  session: Pick<SessionProfile, "role">,
  tenantId: string,
): Promise<AdminScimActivity> {
  const payload = await adminGet<Record<string, unknown>>(session, "/api/admin-svc/scim-activity", {
    tenantId,
  });
  return {
    counters: (payload.counters ?? {}) as Record<string, number>,
    lastSyncAt: payload.lastSyncAt ? String(payload.lastSyncAt) : null,
  };
}
