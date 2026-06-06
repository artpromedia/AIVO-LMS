import "server-only";

import { cookies } from "next/headers";
import { IDENTITY_ACCESS_TOKEN_COOKIE } from "@aivo/admin-auth/identity-client";
import { securityRoleForWebRole } from "@aivo/admin-auth/permissions";
import type { SessionProfile } from "@aivo/admin-auth/types";
import { adminSvcUrl, internalServiceToken } from "./env.js";

type QueryValue = string | number | boolean | null | undefined;

export class AdminApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly payload?: unknown,
  ) {
    super(message);
    this.name = "AdminApiError";
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(path, adminSvcUrl());
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function parseResponseBody(bodyText: string): unknown {
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

async function readAccessToken(): Promise<string> {
  const token = (await cookies()).get(IDENTITY_ACCESS_TOKEN_COOKIE)?.value;
  if (!token) {
    throw new AdminApiError("Missing admin access token", 401);
  }
  return token;
}

export async function adminGet<T>(
  session: Pick<SessionProfile, "role">,
  path: string,
  query?: Record<string, QueryValue>,
): Promise<T> {
  return adminRequest<T>(session, "GET", path, undefined, query);
}

export async function adminPatch<T>(
  session: Pick<SessionProfile, "role">,
  path: string,
  body?: unknown,
): Promise<T> {
  return adminRequest<T>(session, "PATCH", path, body);
}

export async function adminPost<T>(
  session: Pick<SessionProfile, "role">,
  path: string,
  body?: unknown,
): Promise<T> {
  return adminRequest<T>(session, "POST", path, body);
}

export async function adminDelete<T>(
  session: Pick<SessionProfile, "role">,
  path: string,
): Promise<T> {
  return adminRequest<T>(session, "DELETE", path);
}

async function adminRequest<T>(
  session: Pick<SessionProfile, "role">,
  method: "GET" | "PATCH" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  query?: Record<string, QueryValue>,
): Promise<T> {
  const token = await readAccessToken();
  const headers = new Headers({
    authorization: `Bearer ${token}`,
    "x-aivo-active-role": String(securityRoleForWebRole(session.role)),
  });
  if (body !== undefined) {
    headers.set("content-type", "application/json");
  }
  const serviceToken = internalServiceToken();
  if (serviceToken) {
    headers.set("x-service-token", serviceToken);
  }

  const response = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });

  const bodyText = await response.text();
  const payload = parseResponseBody(bodyText);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : typeof payload === "string" && payload
          ? payload
          : `admin-svc request failed (${response.status})`;
    throw new AdminApiError(message, response.status, payload);
  }

  return payload as T;
}

export async function adminGetAllPages<T>(
  session: Pick<SessionProfile, "role">,
  path: string,
  key: string,
): Promise<T[]> {
  const items: T[] = [];
  let page = 1;
  const pageSize = 200;

  while (true) {
    const payload = await adminGet<Record<string, unknown>>(session, path, { page, pageSize });
    const next = Array.isArray(payload[key]) ? (payload[key] as T[]) : [];
    items.push(...next);
    const total = Number(payload.total ?? items.length);
    if (next.length === 0 || items.length >= total) {
      return items;
    }
    page += 1;
  }
}
