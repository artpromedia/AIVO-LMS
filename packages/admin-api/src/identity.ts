import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { securityRoleForWebRole } from "@aivo/admin-auth/permissions";
import type { SessionProfile } from "@aivo/admin-auth/types";
import { AdminApiError } from "./client.js";
import { identitySvcUrl, internalServiceToken } from "./env.js";

type QueryValue = string | number | boolean | null | undefined;
type IdentityMethod = "GET" | "POST" | "PATCH" | "PUT";

export type DistrictInviteStatus = "pending" | "accepted" | "expired" | "revoked";

export type PlatformDistrictInvite = {
  id: string;
  tenantId: string;
  districtName: string;
  email: string;
  name: string;
  role: "DISTRICT_ADMIN";
  status: DistrictInviteStatus;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

export type DistrictSetupOverview = {
  district: { id: string; name: string };
  setupComplete: boolean;
  canComplete: boolean;
  counts: { schools: number; staff: number; learners: number; pendingInvites: number };
  checklist: { schools: boolean; staff: boolean; branding: boolean; sso: boolean };
};

function assertPlatformAdmin(session: Pick<SessionProfile, "role">) {
  if (session.role !== "platform_admin") {
    throw new AdminApiError("Platform admin access required", 403);
  }
}

async function identityRequest<T>(
  session: Pick<SessionProfile, "role">,
  method: IdentityMethod,
  path: string,
  body?: unknown,
  query?: Record<string, QueryValue>,
): Promise<T> {
  const token = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) throw new AdminApiError("Missing admin access token", 401);

  const url = new URL(path, identitySvcUrl());
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "x-aivo-active-role": String(securityRoleForWebRole(session.role)),
  });
  if (body !== undefined) headers.set("content-type", "application/json");
  const serviceToken = internalServiceToken();
  if (serviceToken) headers.set("x-service-token", serviceToken);

  const response = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : `identity-svc request failed (${response.status})`;
    throw new AdminApiError(message, response.status, payload);
  }
  return payload as T;
}

export async function createPlatformDistrict(
  session: Pick<SessionProfile, "role">,
  input: { districtName: string; adminName: string; adminEmail: string },
) {
  assertPlatformAdmin(session);
  return identityRequest<{
    district: { id: string; name: string; type: string; createdAt: string };
    invite: { id: string; email: string; expiresAt: string; inviteUrl?: string };
  }>(session, "POST", "/api/admin/create-district", input);
}

export async function listPlatformDistrictInvites(
  session: Pick<SessionProfile, "role">,
  status?: DistrictInviteStatus,
) {
  assertPlatformAdmin(session);
  return identityRequest<{ invites: PlatformDistrictInvite[] }>(
    session,
    "GET",
    "/api/admin/district-invites",
    undefined,
    { status },
  );
}

export async function resendPlatformDistrictInvite(
  session: Pick<SessionProfile, "role">,
  id: string,
) {
  assertPlatformAdmin(session);
  return identityRequest<{ success: true; expiresAt: string; inviteUrl?: string }>(
    session,
    "POST",
    `/api/admin/district-invites/${encodeURIComponent(id)}/resend`,
  );
}

export async function revokePlatformDistrictInvite(
  session: Pick<SessionProfile, "role">,
  id: string,
) {
  assertPlatformAdmin(session);
  return identityRequest<{ success: true }>(
    session,
    "POST",
    `/api/admin/district-invites/${encodeURIComponent(id)}/revoke`,
  );
}

export async function getDistrictSetupOverview(session: Pick<SessionProfile, "role">) {
  return identityRequest<DistrictSetupOverview>(session, "GET", "/api/district/setup");
}

export async function completeDistrictSetup(session: Pick<SessionProfile, "role">) {
  return identityRequest<{ success: true; setupComplete: true }>(
    session,
    "PATCH",
    "/api/district/settings/complete",
  );
}

export async function createDistrictSchool(
  session: Pick<SessionProfile, "role">,
  input: { name: string },
) {
  return identityRequest<{ school: { id: string; name: string } }>(
    session,
    "POST",
    "/api/district/schools",
    input,
  );
}

export async function inviteDistrictAdmin(
  session: Pick<SessionProfile, "role">,
  input: { name: string; email: string },
) {
  return identityRequest<{ invite: { id: string; email: string; expiresAt: string } }>(
    session,
    "POST",
    "/api/district/admins",
    { ...input, role: "DISTRICT_ADMIN" },
  );
}

export async function updateDistrictBranding(
  session: Pick<SessionProfile, "role">,
  branding: { supportEmail: string; displayName?: string },
) {
  return identityRequest<Record<string, unknown>>(session, "PUT", "/api/district/settings", {
    branding,
  });
}

export type DistrictRosteringGrant = { teacherRosteringEnabled: boolean };

/**
 * Whether this district has granted its teachers the right to connect and
 * manage roster sources themselves. Stored on the district settings
 * `featureOverrides`. Teachers are default-deny: the learner app
 * (`/api/bff/teacher/rostering`) refuses connect/sync until this is true.
 */
export async function getDistrictRosteringGrant(
  session: Pick<SessionProfile, "role">,
): Promise<DistrictRosteringGrant> {
  const settings = await identityRequest<{ featureOverrides?: Record<string, unknown> }>(
    session,
    "GET",
    "/api/district/settings",
  );
  return {
    teacherRosteringEnabled: Boolean(settings.featureOverrides?.teacherRosteringEnabled),
  };
}

/** Grant or revoke teacher roster-connect rights for the admin's district. */
export async function setDistrictRosteringGrant(
  session: Pick<SessionProfile, "role">,
  enabled: boolean,
): Promise<DistrictRosteringGrant> {
  // Read-merge so we never clobber sibling feature overrides.
  const current = await identityRequest<{ featureOverrides?: Record<string, unknown> }>(
    session,
    "GET",
    "/api/district/settings",
  );
  const featureOverrides = {
    ...(current.featureOverrides ?? {}),
    teacherRosteringEnabled: enabled,
  };
  await identityRequest(session, "PUT", "/api/district/settings", { featureOverrides });
  return { teacherRosteringEnabled: enabled };
}
