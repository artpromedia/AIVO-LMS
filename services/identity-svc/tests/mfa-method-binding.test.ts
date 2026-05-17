import { test } from "node:test";
import assert from "node:assert/strict";

const BASE = process.env.IDENTITY_URL || "http://localhost:3001";

// Skip when no live identity-svc is reachable. These are integration smoke
// tests that require a running server; they are gated on IDENTITY_URL being
// explicitly set so unit-style local runs don't fail with ECONNREFUSED.
const SKIP = !process.env.IDENTITY_URL;

async function call(path: string, body: any, headers: Record<string, string> = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  let json: any = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

test("verify-mfa rejects email OTP when issued mfaToken is bound to webauthn/totp", { skip: SKIP }, async () => {
  // Forge a JWT-shaped token whose payload claims method=webauthn and feed an
  // email-OTP-style 6-digit code: the route must reject it (not silently fall
  // back to the email path) — the router enforces method binding.
  const fakeWebauthnToken = [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(JSON.stringify({ sub: "00000000-0000-0000-0000-000000000000", mfaMethod: "webauthn" })).toString("base64url"),
    "sig",
  ].join(".");

  const { status, json } = await call("/api/auth/verify-mfa", {
    mfaToken: fakeWebauthnToken,
    code: "123456",
  });

  assert.notEqual(status, 200, "must not succeed with mismatched method");
  assert.ok(
    status === 400 || status === 401 || status === 403,
    `expected 4xx for method mismatch, got ${status} ${JSON.stringify(json)}`
  );
});

test("resend-mfa refuses to send email OTP when token is bound to webauthn/totp", { skip: SKIP }, async () => {
  const fakeTotpToken = [
    "eyJhbGciOiJIUzI1NiJ9",
    Buffer.from(JSON.stringify({ sub: "00000000-0000-0000-0000-000000000000", mfaMethod: "totp" })).toString("base64url"),
    "sig",
  ].join(".");

  const { status } = await call("/api/auth/mfa/resend", { mfaToken: fakeTotpToken });
  assert.notEqual(status, 200, "resend must refuse for non-email methods");
  assert.ok(
    status === 400 || status === 401 || status === 403,
    `expected 4xx, got ${status}`
  );
});
