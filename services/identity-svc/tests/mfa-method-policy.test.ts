import { test } from "node:test";
import assert from "node:assert/strict";
import {
  challengeAllowsEmailOtp,
  challengeAllowsEmailResend,
  userMayUseTotp,
} from "../src/services/mfa-method-policy.ts";

test("email-OTP is rejected when challenge was issued for WebAuthn", () => {
  assert.equal(challengeAllowsEmailOtp({ mfaMethod: "webauthn", purpose: "mfa" }), false);
});

test("email-OTP is rejected when challenge was issued for TOTP", () => {
  assert.equal(challengeAllowsEmailOtp({ mfaMethod: "totp", purpose: "mfa" }), false);
});

test("email-OTP is accepted only when challenge was issued for email", () => {
  assert.equal(challengeAllowsEmailOtp({ mfaMethod: "email", purpose: "mfa" }), true);
});

test("missing mfaMethod is treated as non-email (fail-closed)", () => {
  assert.equal(challengeAllowsEmailOtp({ purpose: "mfa" }), false);
  assert.equal(challengeAllowsEmailOtp({} as any), false);
});

test("resend refuses to fire for WebAuthn / TOTP challenges", () => {
  assert.equal(challengeAllowsEmailResend({ mfaMethod: "webauthn" }), false);
  assert.equal(challengeAllowsEmailResend({ mfaMethod: "totp" }), false);
});

test("resend allowed for explicit email and for legacy tokens without method", () => {
  assert.equal(challengeAllowsEmailResend({ mfaMethod: "email" }), true);
  assert.equal(challengeAllowsEmailResend({}), true);
});

test("TOTP path requires active mfaMethod=totp AND a stored secret", () => {
  assert.equal(userMayUseTotp({ mfaMethod: "totp", totpSecretEncrypted: "blob" }), true);
  assert.equal(userMayUseTotp({ mfaMethod: "totp", totpSecretEncrypted: null }), false);
  assert.equal(userMayUseTotp({ mfaMethod: "email", totpSecretEncrypted: "blob" }), false);
  assert.equal(userMayUseTotp({ mfaMethod: "webauthn", totpSecretEncrypted: "blob" }), false);
  assert.equal(userMayUseTotp({}), false);
});
