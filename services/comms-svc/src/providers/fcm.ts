/**
 * Sprint 12.7 — Firebase Cloud Messaging HTTP v1 adapter.
 *
 * Uses a service-account JSON to mint a short-lived OAuth2 access token
 * (signed with the SA's private key via `jose`) and POSTs the message
 * envelope to `https://fcm.googleapis.com/v1/projects/{pid}/messages:send`.
 *
 * No firebase-admin SDK dependency — keeps the container image small
 * and avoids the SDK's startup cost. The token cache (5 min) is in
 * process memory; refresh is lazy.
 *
 * Required env:
 *   FCM_SERVICE_ACCOUNT_JSON — full SA JSON blob (single line).
 */

import * as jose from "jose";
import type { PushTarget, PushMessage, PushResult } from "./push-router.js";

interface FcmServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

let cachedAccessToken: { token: string; expiresAt: number } | null = null;
let cachedSa: FcmServiceAccount | null = null;

function loadServiceAccount(): FcmServiceAccount | null {
  if (cachedSa) return cachedSa;
  const raw = process.env.FCM_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    cachedSa = JSON.parse(raw) as FcmServiceAccount;
    return cachedSa;
  } catch {
    return null;
  }
}

async function getAccessToken(): Promise<string | null> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.token;
  }
  const sa = loadServiceAccount();
  if (!sa) return null;
  const privateKey = await jose.importPKCS8(sa.private_key, "RS256");
  const iat = Math.floor(Date.now() / 1000);
  const jwt = await new jose.SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(sa.client_email)
    .setSubject(sa.client_email)
    .setAudience(sa.token_uri)
    .setIssuedAt(iat)
    .setExpirationTime(iat + 3600)
    .sign(privateKey);

  const res = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;
  cachedAccessToken = {
    token: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export async function sendFcm(target: PushTarget, message: PushMessage): Promise<PushResult> {
  const sa = loadServiceAccount();
  if (!sa) {
    return {
      token: target.token,
      kind: "fcm",
      ok: false,
      invalidToken: false,
      error: "FCM_SERVICE_ACCOUNT_JSON not configured",
    };
  }
  const accessToken = await getAccessToken();
  if (!accessToken) {
    return {
      token: target.token,
      kind: "fcm",
      ok: false,
      invalidToken: false,
      error: "FCM access token mint failed",
    };
  }

  const payload: any = {
    message: {
      token: target.token,
      notification:
        message.title || message.body
          ? { title: message.title ?? "", body: message.body ?? "" }
          : undefined,
      data: message.data,
      android: message.collapseId ? { collapse_key: message.collapseId } : undefined,
    },
  };

  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (res.ok) {
    return { token: target.token, kind: "fcm", ok: true, invalidToken: false };
  }

  let errCode = "";
  try {
    const body: any = await res.json();
    errCode = body?.error?.details?.[0]?.errorCode ?? body?.error?.status ?? "";
  } catch {
    // body wasn't JSON; fall through
  }
  const invalidToken =
    errCode === "UNREGISTERED" ||
    errCode === "INVALID_ARGUMENT" ||
    errCode === "NOT_FOUND" ||
    res.status === 404;
  return {
    token: target.token,
    kind: "fcm",
    ok: false,
    invalidToken,
    error: errCode || `HTTP ${res.status}`,
  };
}

/** Reset module-level state. Tests only. */
export function _resetFcm(): void {
  cachedAccessToken = null;
  cachedSa = null;
}
