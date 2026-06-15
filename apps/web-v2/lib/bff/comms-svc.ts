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
  if (process.env.NODE_ENV === "production") return true;
  return serverEnv.AIVO_USE_COMMS_SVC ?? serverEnv.AIVO_USE_SERVICE_STACK;
}

export async function getCommsBearer(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token && process.env.NODE_ENV === "production") {
    throw new Error("comms-svc access token is required in production");
  }
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

/**
 * Start a new thread (parent → care-team member). comms-svc owns the
 * `message_threads` / `message_thread_participants` / `messages` rows and adds
 * the caller as a participant; the BFF owns recipient authorization + rate
 * limiting before calling this.
 */
export function createThreadSvc(
  bearer: string,
  input: { subject: string; participantUserIds: string[]; body?: string; learnerId?: string | null },
): Promise<ServiceResult<{ thread: { id: string }; message?: unknown }>> {
  return commsFetch("/api/comms/threads", { method: "POST", bearer, body: input });
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
 * Best-effort email notice that a human coach/therapist session is upcoming
 * (booking confirmation / reschedule notice). Reuses comms-svc's
 * `session_reminder` template; the caller treats failure as non-fatal.
 */
export function sendSessionNoticeSvc(
  bearer: string,
  email: string,
  data: { learnerName: string; tutorName: string; sessionUrl?: string },
): Promise<ServiceResult<{ status: string; messageId?: string }>> {
  return commsFetch("/api/comms/send", {
    method: "POST",
    bearer,
    body: { channel: "email", recipient: email, template: "session_reminder", data },
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

/**
 * Sprint C-08 — re-send a care-team invite email when the parent taps
 * "Remind" on the team hub. Reuses the `collaboration_invite` template (same
 * one the initial invite used), so the teammate gets a consistent, warm nudge.
 * comms-svc owns delivery; the hub action owns the kind per-member rate limit.
 */
export function remindTeamMemberSvc(
  bearer: string,
  email: string,
  data: { role: string; inviterName?: string; learnerName?: string; acceptUrl?: string },
): Promise<ServiceResult<{ status: string; messageId?: string }>> {
  return commsFetch("/api/comms/send", {
    method: "POST",
    bearer,
    body: {
      channel: "email",
      recipient: email,
      template: "collaboration_invite",
      data: {
        role: data.role,
        inviterName: data.inviterName,
        learnerName: data.learnerName,
        acceptUrl: data.acceptUrl,
      },
    },
  });
}
