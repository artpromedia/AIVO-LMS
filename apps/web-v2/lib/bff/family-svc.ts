/**
 * Server-side helper that fronts `services/family-svc` from the BFF.
 *
 * Browser code MUST NOT import this module — it reads the user's access
 * token and the service token. Go through a `/api/bff/...` route handler.
 *
 * Dual-path (ADR 0009): when family-svc is enabled (`AIVO_USE_FAMILY_SVC`,
 * falling back to `AIVO_USE_SERVICE_STACK`) AND a real identity-svc access
 * token is present, the parent Speech Buddy consent surface talks to
 * family-svc. Otherwise the caller uses the in-memory consent store so
 * dev/demo and mock auth keep working.
 */
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@/lib/auth/identity-client";

export interface SpeechBuddyConsentView {
  granted: boolean;
  consent: { id: string; ageBand: string; scope: string } | null;
}

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

/** Resolve the family-svc flag: per-service override, else the stack flag. */
export function isFamilySvcEnabled(): boolean {
  return serverEnv.AIVO_USE_FAMILY_SVC ?? serverEnv.AIVO_USE_SERVICE_STACK;
}

/**
 * Read the identity-svc access token from the web-v2 session cookie as a
 * bearer. Returns null in mock mode / logged-out — the signal to use the
 * in-memory store path.
 */
export async function getFamilyBearer(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  return token ? `Bearer ${token}` : null;
}

async function familyFetch<T>(
  path: string,
  init: { method?: string; bearer: string; body?: unknown },
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverEnv.AIVO_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${serverEnv.FAMILY_SVC_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        authorization: init.bearer,
        ...(serverEnv.FAMILY_SVC_SERVICE_TOKEN
          ? { "x-service-token": serverEnv.FAMILY_SVC_SERVICE_TOKEN }
          : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof json.error === "string" ? json.error : `family-svc ${res.status}`,
      };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, status: 502, error: `family-svc unreachable: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

export function getSpeechBuddyConsent(
  bearer: string,
  learnerId: string,
): Promise<ServiceResult<SpeechBuddyConsentView>> {
  return familyFetch<SpeechBuddyConsentView>(
    `/api/family/speech-buddy/consent/${encodeURIComponent(learnerId)}`,
    { bearer },
  );
}

export function grantSpeechBuddyConsent(
  bearer: string,
  learnerId: string,
  ageBand: string,
): Promise<ServiceResult<{ consentRecordId: string; ageBand: string }>> {
  return familyFetch(`/api/family/speech-buddy/consent/${encodeURIComponent(learnerId)}`, {
    method: "POST",
    bearer,
    body: { ageBand },
  });
}

export function revokeSpeechBuddyConsent(
  bearer: string,
  learnerId: string,
): Promise<ServiceResult<{ revoked: boolean }>> {
  return familyFetch(
    `/api/family/speech-buddy/consent/${encodeURIComponent(learnerId)}/revoke`,
    { method: "POST", bearer },
  );
}
