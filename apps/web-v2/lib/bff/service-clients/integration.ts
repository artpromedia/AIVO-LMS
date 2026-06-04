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

export interface LtiPlatformView {
  id: string;
  tenantId: string;
  issuer: string;
  clientId: string;
  jwksUrl: string;
  authTokenUrl: string;
  authLoginUrl: string;
  label: string | null;
  createdAt: string;
  deployments: Array<{ id: string; deploymentId: string; label: string | null }>;
}

export interface RegisterLtiPlatformInput {
  issuer: string;
  clientId: string;
  jwksUrl: string;
  authTokenUrl: string;
  authLoginUrl: string;
  label?: string;
  deployments?: Array<{ deploymentId: string; label?: string }>;
}

/** List the caller tenant's registered LTI platforms via integration-svc. */
export async function listLtiPlatforms(
  authToken: string,
): Promise<Result<{ platforms: LtiPlatformView[]; count: number }>> {
  try {
    const res = await fetch(`${serverEnv.INTEGRATION_SVC_URL}/api/lti/platforms`, {
      method: "GET",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { authorization: `Bearer ${authToken}` },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    return {
      ok: true,
      data: (await res.json()) as { platforms: LtiPlatformView[]; count: number },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Register (or update) an LTI platform via integration-svc. */
export async function registerLtiPlatform(
  authToken: string,
  input: RegisterLtiPlatformInput,
): Promise<Result<{ platformId: string; deploymentIds: string[] }>> {
  try {
    const res = await fetch(`${serverEnv.INTEGRATION_SVC_URL}/api/lti/platforms`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error ?? `http_${res.status}` };
    }
    return {
      ok: true,
      data: (await res.json()) as { platformId: string; deploymentIds: string[] },
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

export interface UpdateLtiPlatformInput {
  jwksUrl?: string;
  authTokenUrl?: string;
  authLoginUrl?: string;
  label?: string | null;
  deployments?: Array<{ deploymentId: string; label?: string }>;
}

/** Update a registered LTI platform's mutable fields and (optional) deployments. */
export async function updateLtiPlatform(
  authToken: string,
  platformId: string,
  input: UpdateLtiPlatformInput,
): Promise<Result<LtiPlatformView>> {
  try {
    const res = await fetch(
      `${serverEnv.INTEGRATION_SVC_URL}/api/lti/platforms/${encodeURIComponent(platformId)}`,
      {
        method: "PUT",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "content-type": "application/json", authorization: `Bearer ${authToken}` },
        body: JSON.stringify(input),
      },
    );
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error ?? `http_${res.status}` };
    }
    return { ok: true, data: (await res.json()) as LtiPlatformView };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Delete a registered LTI platform (cascades per migration-0045). */
export async function deleteLtiPlatform(
  authToken: string,
  platformId: string,
): Promise<Result<{ deleted: true }>> {
  try {
    const res = await fetch(
      `${serverEnv.INTEGRATION_SVC_URL}/api/lti/platforms/${encodeURIComponent(platformId)}`,
      {
        method: "DELETE",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { authorization: `Bearer ${authToken}` },
      },
    );
    if (res.status === 204) return { ok: true, data: { deleted: true } };
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, reason: body.error ?? `http_${res.status}` };
    }
    return { ok: true, data: { deleted: true } };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

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
