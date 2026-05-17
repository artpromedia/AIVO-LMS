/**
 * Pure policy helpers that decide whether a given MFA challenge token may be
 * satisfied by a particular verification path. Extracted so the binding rules
 * can be unit-tested independently of network / JWT signing infrastructure.
 *
 * The core invariant: a challenge issued for a strong factor (TOTP, WebAuthn)
 * must NOT be satisfiable by an emailed 6-digit OTP. Only recovery codes and
 * the originally-bound factor are accepted. This blocks downgrade attacks
 * where an attacker who can read email could bypass a stronger factor.
 */

export type MfaChallengeMethod = "email" | "totp" | "webauthn";

export interface MfaChallengePayload {
  purpose?: string;
  sub?: string;
  mfaMethod?: MfaChallengeMethod | string;
}

/**
 * Returns true iff this challenge token was issued for the email-OTP factor
 * and may therefore be completed by submitting an emailed 6-digit code.
 */
export function challengeAllowsEmailOtp(payload: MfaChallengePayload): boolean {
  return payload?.mfaMethod === "email";
}

/**
 * Returns true iff a /api/auth/mfa/resend request bound to this token should
 * be honored. We only resend when the original challenge was email-based.
 */
export function challengeAllowsEmailResend(payload: MfaChallengePayload): boolean {
  return !payload?.mfaMethod || payload.mfaMethod === "email";
}

/**
 * Returns true iff the supplied user record may complete the challenge with a
 * TOTP code. Requires both: user has TOTP enrolled AND their active mfaMethod
 * is "totp" (so an old, disabled secret cannot be used to bypass a downgrade).
 */
export function userMayUseTotp(user: { mfaMethod?: string | null; totpSecretEncrypted?: string | null }): boolean {
  return user?.mfaMethod === "totp" && !!user?.totpSecretEncrypted;
}
