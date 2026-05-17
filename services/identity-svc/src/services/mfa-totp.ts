/**
 * Thin TOTP wrapper. We use the `otpauth` library (RFC 6238) configured for
 * 6-digit codes / 30s period / SHA-1 (the default Google Authenticator profile).
 *
 * Caller is responsible for encrypting the secret at rest via @aivo/security.
 */
import { Secret, TOTP } from "otpauth";

const TOTP_ISSUER = process.env.TOTP_ISSUER || "AIVO Learning";
const TOTP_PERIOD = 30;
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = "SHA1";

export interface TotpEnrollment {
  base32Secret: string;
  otpauthUrl: string;
}

export function generateTotpSecret(accountLabel: string): TotpEnrollment {
  const secret = new Secret({ size: 20 });
  const totp = new TOTP({
    issuer: TOTP_ISSUER,
    label: accountLabel,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret,
  });
  return { base32Secret: secret.base32, otpauthUrl: totp.toString() };
}

/**
 * Validate a 6-digit TOTP code with a ±1-step tolerance window
 * (i.e. accepts codes from the previous, current, and next 30s window),
 * which absorbs ~30s of clock skew across server / phone.
 */
export function verifyTotpCode(base32Secret: string, code: string): boolean {
  if (!base32Secret || !/^\d{6}$/.test(String(code))) return false;
  const totp = new TOTP({
    issuer: TOTP_ISSUER,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(base32Secret),
  });
  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}

export function buildOtpauthUrl(accountLabel: string, base32Secret: string): string {
  const totp = new TOTP({
    issuer: TOTP_ISSUER,
    label: accountLabel,
    algorithm: TOTP_ALGORITHM,
    digits: TOTP_DIGITS,
    period: TOTP_PERIOD,
    secret: Secret.fromBase32(base32Secret),
  });
  return totp.toString();
}
