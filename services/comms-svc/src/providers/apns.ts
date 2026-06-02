/**
 * Sprint 12.7 — Apple Push Notification service adapter (token-based auth).
 *
 * Uses the ES256 provider auth-token (RFC 8030 / Apple "p8" key) to push
 * via APNs HTTP/2. We keep the token cached for ~50 minutes and refresh
 * automatically.
 *
 * Required env:
 *   APNS_KEY_ID       — 10-char key identifier from the Apple Developer Portal
 *   APNS_TEAM_ID      — 10-char Apple team id
 *   APNS_PRIVATE_KEY  — ES256 .p8 PEM (single line — replace newlines with `\n`)
 *   APNS_BUNDLE_ID    — default `apns-topic` for outgoing pushes
 *
 * Optional:
 *   APNS_HOST         — defaults to "api.push.apple.com". Switch to
 *                       "api.sandbox.push.apple.com" for development.
 *
 * We use node:http2 directly to avoid pulling in a heavy SDK.
 */

import * as jose from "jose";
import http2 from "node:http2";
import type { PushTarget, PushMessage, PushResult } from "./push-router.js";

let cachedToken: { token: string; mintedAt: number } | null = null;

async function mintProviderToken(): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now - cachedToken.mintedAt < 50 * 60 * 1000) {
    return cachedToken.token;
  }
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const pem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!keyId || !teamId || !pem) return null;
  const key = await jose.importPKCS8(pem, "ES256");
  const token = await new jose.SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId, typ: "JWT" })
    .setIssuer(teamId)
    .setIssuedAt()
    .sign(key);
  cachedToken = { token, mintedAt: now };
  return token;
}

export async function sendApns(target: PushTarget, message: PushMessage): Promise<PushResult> {
  const providerToken = await mintProviderToken();
  const topic = target.topic ?? process.env.APNS_BUNDLE_ID;
  if (!providerToken || !topic) {
    return {
      token: target.token,
      kind: "apns",
      ok: false,
      invalidToken: false,
      error: "APNs not configured",
    };
  }
  const host = process.env.APNS_HOST ?? "api.push.apple.com";
  const payload = JSON.stringify({
    aps: {
      alert: {
        title: message.title,
        body: message.body,
      },
      "thread-id": message.collapseId,
    },
    ...(message.data ?? {}),
  });

  return await new Promise<PushResult>((resolveResult) => {
    const client = http2.connect(`https://${host}`);
    client.on("error", (err) => {
      resolveResult({
        token: target.token,
        kind: "apns",
        ok: false,
        invalidToken: false,
        error: err.message,
      });
    });
    const req = client.request({
      ":method": "POST",
      ":path": `/3/device/${target.token}`,
      authorization: `bearer ${providerToken}`,
      "apns-topic": topic,
      "apns-push-type": "alert",
      "content-type": "application/json",
      "content-length": Buffer.byteLength(payload),
    });
    let status = 0;
    const bodyChunks: Buffer[] = [];
    req.on("response", (headers) => {
      status = Number(headers[":status"] ?? 0);
    });
    req.on("data", (chunk) => bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => {
      client.close();
      if (status === 200) {
        resolveResult({ token: target.token, kind: "apns", ok: true, invalidToken: false });
        return;
      }
      let reason = "";
      try {
        reason = JSON.parse(Buffer.concat(bodyChunks).toString("utf8"))?.reason ?? "";
      } catch {
        // ignore — APNs returned a non-JSON body
      }
      const invalidToken =
        reason === "BadDeviceToken" ||
        reason === "Unregistered" ||
        reason === "DeviceTokenNotForTopic" ||
        status === 410;
      resolveResult({
        token: target.token,
        kind: "apns",
        ok: false,
        invalidToken,
        error: reason || `HTTP ${status}`,
      });
    });
    req.end(payload);
  });
}

/** Reset module-level state. Tests only. */
export function _resetApns(): void {
  cachedToken = null;
}
