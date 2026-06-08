import "server-only";

import { adminGet, adminPost, adminDelete } from "./client";
import type { SessionProfile } from "@aivo/admin-auth/types";

/**
 * Admin surface for TTS pronunciation overrides.
 *
 * Backed by admin-svc, which persists to the Postgres `pronunciation_overrides`
 * table (@aivo/db). No mock store.
 *
 *   GET    /api/admin-svc/audio/pronunciation
 *   POST   /api/admin-svc/audio/pronunciation
 *   DELETE /api/admin-svc/audio/pronunciation/:id
 */

export type PronunciationEncoding = "ipa" | "x-sampa" | "plain";
export type PronunciationScope = "platform" | "tenant";

export const PRONUNCIATION_ENCODINGS: PronunciationEncoding[] = ["ipa", "x-sampa", "plain"];
export const PRONUNCIATION_SCOPES: PronunciationScope[] = ["platform", "tenant"];

export interface PronunciationOverride {
  id: string;
  tenantId: string | null;
  token: string;
  replacement: string;
  encoding: PronunciationEncoding;
  scope: PronunciationScope;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: string | null;
}

function normalizeEncoding(value: unknown): PronunciationEncoding {
  const v = String(value ?? "plain");
  return (PRONUNCIATION_ENCODINGS as string[]).includes(v) ? (v as PronunciationEncoding) : "plain";
}

function normalizeScope(value: unknown): PronunciationScope {
  return String(value ?? "tenant") === "platform" ? "platform" : "tenant";
}

function mapOverride(row: Record<string, unknown>): PronunciationOverride {
  return {
    id: String(row.id),
    tenantId: row.tenantId ? String(row.tenantId) : null,
    token: String(row.token ?? ""),
    replacement: String(row.replacement ?? ""),
    encoding: normalizeEncoding(row.encoding),
    scope: normalizeScope(row.scope),
    notes: row.notes ? String(row.notes) : null,
    createdByUserId: row.createdByUserId ? String(row.createdByUserId) : null,
    createdAt: row.createdAt ? String(row.createdAt) : null,
  };
}

export async function listPronunciationOverrides(
  session: Pick<SessionProfile, "role">,
): Promise<PronunciationOverride[]> {
  const payload = await adminGet<Record<string, unknown>>(
    session,
    "/api/admin-svc/audio/pronunciation",
  );
  const rows = Array.isArray(payload.overrides) ? payload.overrides : [];
  return rows.map((row) => mapOverride(row as Record<string, unknown>));
}

export async function createPronunciationOverride(
  session: Pick<SessionProfile, "role">,
  input: {
    token: string;
    replacement: string;
    encoding: PronunciationEncoding;
    scope: PronunciationScope;
    tenantId?: string | null;
    notes?: string | null;
  },
): Promise<PronunciationOverride> {
  const payload = await adminPost<Record<string, unknown>>(
    session,
    "/api/admin-svc/audio/pronunciation",
    input,
  );
  return mapOverride((payload.override as Record<string, unknown>) ?? {});
}

export async function deletePronunciationOverride(
  session: Pick<SessionProfile, "role">,
  id: string,
): Promise<void> {
  await adminDelete(session, `/api/admin-svc/audio/pronunciation/${encodeURIComponent(id)}`);
}
