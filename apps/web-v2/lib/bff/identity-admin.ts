/**
 * Server-side helper fronting identity-svc's admin role-management endpoints
 * (`/api/admin/users/:userId/roles`) from the BFF. Browser code MUST NOT
 * import this. Dual-path: used when identity-svc is enabled
 * (`AIVO_USE_IDENTITY_SVC`, falling back to `AIVO_USE_SERVICE_STACK`) and a
 * real admin token is present; otherwise callers use the in-memory store.
 *
 * Translates the web (lowercase) Role vocabulary to/from identity-svc's
 * uppercase wire roles.
 */
import { cookies } from "next/headers";
import { serverEnv } from "@/lib/env";
import { IDENTITY_ACCESS_TOKEN_COOKIE, mapWireRoleToRole } from "@/lib/auth/identity-client";

const WEB_TO_WIRE: Record<string, string> = {
  parent: "PARENT",
  teacher: "TEACHER",
  caregiver: "CAREGIVER",
  therapist: "THERAPIST",
  learner: "LEARNER",
  support: "SUPPORT",
  marketing: "MARKETING",
  sales: "SALES",
  devops: "DEVOPS",
  engineering: "ENGINEERING",
};

type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export function isIdentitySvcEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return serverEnv.AIVO_USE_IDENTITY_SVC ?? serverEnv.AIVO_USE_SERVICE_STACK;
}

export async function getAdminBearer(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token && process.env.NODE_ENV === "production") {
    throw new Error("identity-svc access token is required in production");
  }
  return token ? `Bearer ${token}` : null;
}

async function adminFetch<T>(
  path: string,
  init: { method?: string; bearer: string; body?: unknown },
): Promise<ServiceResult<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), serverEnv.AIVO_SERVICE_TIMEOUT_MS);
  try {
    const res = await fetch(`${serverEnv.IDENTITY_SVC_URL}${path}`, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", authorization: init.bearer },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
      signal: controller.signal,
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: typeof json.error === "string" ? json.error : `identity-svc ${res.status}`,
      };
    }
    return { ok: true, data: json as T };
  } catch (err) {
    return { ok: false, status: 502, error: `identity-svc unreachable: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}

/** List a user's additional roles, mapped to web (lowercase) roles. */
export async function listUserRolesSvc(
  bearer: string,
  userId: string,
): Promise<ServiceResult<{ additionalRoles: string[] }>> {
  const r = await adminFetch<{ additionalRoles?: string[] }>(
    `/api/admin/users/${encodeURIComponent(userId)}/roles`,
    { bearer },
  );
  if (!r.ok) return r;
  const additionalRoles: string[] = (r.data.additionalRoles ?? [])
    .map((wire) => mapWireRoleToRole(wire))
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return { ok: true, data: { additionalRoles } };
}

export async function grantUserRoleSvc(
  bearer: string,
  userId: string,
  webRole: string,
): Promise<ServiceResult<unknown>> {
  const wire = WEB_TO_WIRE[webRole];
  if (!wire) return { ok: false, status: 400, error: "Unsupported role" };
  return adminFetch(`/api/admin/users/${encodeURIComponent(userId)}/roles`, {
    method: "POST",
    bearer,
    body: { role: wire },
  });
}

export async function revokeUserRoleSvc(
  bearer: string,
  userId: string,
  webRole: string,
): Promise<ServiceResult<unknown>> {
  const wire = WEB_TO_WIRE[webRole];
  if (!wire) return { ok: false, status: 400, error: "Unsupported role" };
  return adminFetch(
    `/api/admin/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(wire)}`,
    { method: "DELETE", bearer },
  );
}
