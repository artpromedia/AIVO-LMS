/**
 * Thin BFF client for `data-governance-svc` (Sprint G — completion plan).
 *
 * Wraps the parent DSAR endpoints so the BFF can fan out without
 * pulling in the full Fastify service surface. Returns
 * `{ ok: true, data }` on success and `{ ok: false, reason }` on any
 * failure; the BFF routes that consume this never throw — they fall
 * back to the local mock store so the parent-facing UI keeps working
 * during a partial outage.
 */
import { serverEnv } from "@/lib/env";

export interface ParentExportJob {
  id: string;
  status: string;
  formats: string[];
  [k: string]: unknown;
}

export interface DeletionRequest {
  id: string;
  learnerId: string;
  status: string;
  [k: string]: unknown;
}

type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

const TIMEOUT_MS = 3000;

async function callService<T>(
  path: string,
  init: RequestInit & { method: "POST" | "GET" },
): Promise<Result<T>> {
  try {
    const res = await fetch(`${serverEnv.DATA_GOVERNANCE_SVC_URL}${path}`, {
      ...init,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}` };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function requestParentExport(input: {
  learnerId: string;
  formats?: string[];
}): Promise<Result<ParentExportJob>> {
  return callService<ParentExportJob>("/api/exports/parent", {
    method: "POST",
    body: JSON.stringify({
      learnerId: input.learnerId,
      formats: input.formats ?? ["json", "csv"],
    }),
  });
}

export async function requestDeletion(input: {
  learnerId: string;
  requesterId: string;
  requesterRole: "parent" | "platform_admin" | "district_admin";
  exportBeforeDelete?: boolean;
  retentionHolds?: string[];
}): Promise<Result<DeletionRequest>> {
  return callService<DeletionRequest>("/api/deletion-requests", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
