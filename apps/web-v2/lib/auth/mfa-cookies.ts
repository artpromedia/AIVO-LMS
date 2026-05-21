/**
 * In-flight MFA challenge state stored on the web-v2 domain.
 *
 * After identity-svc responds to /api/auth/login with `mfaPending`, the
 * login server action stashes the signed `mfaToken` (15-min JWT) plus
 * the selected method in a short-lived httpOnly cookie. The
 * /login/mfa page reads it back to render the right input + submit a
 * verify request, and clears it on success or terminal failure.
 *
 * We keep the bearer token in a cookie rather than the URL so it never
 * appears in browser history, the Referer header, or server access
 * logs.
 */
import type { SessionProfile } from "./types";

export const MFA_CHALLENGE_COOKIE = "aivo_mfa_challenge";
export const MFA_CHALLENGE_MAX_AGE_SECONDS = 60 * 15; // matches identity-svc mfaToken TTL

export type MfaMethod = "email" | "totp" | "webauthn" | (string & {});

export type MfaChallengeState = {
  token: string;
  method: MfaMethod;
};

export function parseMfaChallengeCookie(value: string | undefined): MfaChallengeState | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(value)) as Partial<MfaChallengeState>;
    if (!decoded || typeof decoded.token !== "string" || typeof decoded.method !== "string") {
      return null;
    }
    return { token: decoded.token, method: decoded.method as MfaMethod };
  } catch {
    return null;
  }
}

/**
 * Re-export so MFA-related callers don't need to know about the wider
 * SessionProfile shape directly.
 */
export type { SessionProfile };
