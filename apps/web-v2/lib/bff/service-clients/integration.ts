/**
 * Thin BFF client for `integration-svc` (Sprint H — completion plan).
 *
 * Wraps the SIS import endpoint so the admin rostering BFF can fan a
 * Clever / ClassLink export to the canonical integration-svc when the
 * `sisSync` flag is on. Local CSV imports keep going through the
 * in-app mock store.
 */
import { serverEnv } from "@/lib/env";

export interface SisImportSummary {
  vendor: string;
  tenantId: string;
  summary: {
    schools: number;
    teachers: number;
    students: number;
    classes: number;
    enrollments: number;
  };
}

type Result<T> = { ok: true; data: T } | { ok: false; reason: string };

const TIMEOUT_MS = 5000;

export async function importSisExport(input: {
  vendor: "clever" | "classlink";
  export: unknown;
  tenantId: string;
  authToken?: string;
}): Promise<Result<SisImportSummary>> {
  try {
    const res = await fetch(`${serverEnv.INTEGRATION_SVC_URL}/api/sis/import-export`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        "content-type": "application/json",
        "x-tenant-id": input.tenantId,
        ...(input.authToken ? { authorization: `Bearer ${input.authToken}` } : {}),
      },
      body: JSON.stringify({ vendor: input.vendor, export: input.export }),
    });
    if (!res.ok) {
      return { ok: false, reason: `http_${res.status}` };
    }
    return { ok: true, data: (await res.json()) as SisImportSummary };
  } catch (err) {
    return {
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}
