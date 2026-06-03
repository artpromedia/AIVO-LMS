/**
 * Server-side helper that fronts `services/comms-svc` messaging from the BFF.
 *
 * Browser code MUST NOT import this module. Dual-path (ADR 0009): when
 * comms-svc is enabled (`AIVO_USE_COMMS_SVC`, falling back to
 * `AIVO_USE_SERVICE_STACK`) AND a real access token is present, the inbox
 * talks to comms-svc; otherwise the caller uses the in-memory messages store.
 */
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@/lib/auth/identity-client";

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export function isCommsSvcEnabled(): boolean {
  return serverEnv.AIVO_USE_COMMS_SVC ?? serverEnv.AIVO_USE_SERVICE_STACK;
}

export async function getCommsBearer(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  return token ? `Bearer ${token}` : null;
}

async function commsFetch<T>(
  path: string,
  init: { method?: string; bearer: string; body?: unknown },
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverEnv.AIVO_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${serverEnv.COMMS_SVC_URL}${path}`, {
      method: init.method ?? "GET",
      headers: {
        "content-type": "application/json",
        authorization: init.bearer,
        ...(serverEnv.COMMS_SVC_SERVICE_TOKEN
          ? { "x-service-token": serverEnv.COMMS_SVC_SERVICE_TOKEN }
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
        error: typeof json.error === "string" ? json.error : `comms-svc ${res.status}`,
      };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, status: 502, error: `comms-svc unreachable: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

export function listThreadsSvc(bearer: string): Promise<ServiceResult<{ threads: unknown[] }>> {
  return commsFetch("/api/comms/threads", { bearer });
}

export function getThreadMessagesSvc(
  bearer: string,
  threadId: string,
): Promise<ServiceResult<unknown>> {
  return commsFetch(`/api/comms/threads/${encodeURIComponent(threadId)}/messages`, { bearer });
}

export function sendMessageSvc(
  bearer: string,
  threadId: string,
  body: string,
): Promise<ServiceResult<{ message: unknown }>> {
  return commsFetch(`/api/comms/threads/${encodeURIComponent(threadId)}/messages`, {
    method: "POST",
    bearer,
    body: { body },
  });
}

export function markThreadReadSvc(
  bearer: string,
  threadId: string,
): Promise<ServiceResult<{ ok: boolean }>> {
  return commsFetch(`/api/comms/threads/${encodeURIComponent(threadId)}/read`, {
    method: "POST",
    bearer,
  });
}

/**
 * Deliver a one-time verification code over SMS via comms-svc
 * (`POST /api/comms/send`, channel `sms`, `mfa_code` template). comms-svc only
 * transmits — the code/expiry/verification logic stays in the BFF
 * (`parent-phone-store`). Returns the delivery status; `disabled` means no SMS
 * provider is configured upstream (the BFF then falls back to the dev path).
 */
export function sendSmsCodeSvc(
  bearer: string,
  phone: string,
  code: string,
): Promise<ServiceResult<{ status: string; messageId?: string }>> {
  return commsFetch("/api/comms/send", {
    method: "POST",
    bearer,
    body: { channel: "sms", recipient: phone, template: "mfa_code", data: { code } },
  });
}

/**
 * Email a co-parent / caregiver invitation via comms-svc
 * (`POST /api/comms/send`, channel `email`, `collaboration_invite` template).
 * Used by the onboarding household step; comms-svc owns delivery, the BFF owns
 * the household-invite record.
 */
export function sendCoParentInviteSvc(
  bearer: string,
  email: string,
  data: { inviterName?: string; acceptUrl?: string },
): Promise<ServiceResult<{ status: string; messageId?: string }>> {
  return commsFetch("/api/comms/send", {
    method: "POST",
    bearer,
    body: {
      channel: "email",
      recipient: email,
      template: "collaboration_invite",
      data: { role: "co-parent", inviterName: data.inviterName, acceptUrl: data.acceptUrl },
    },
  });
}
