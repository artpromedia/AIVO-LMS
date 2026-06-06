export const MFA_CHALLENGE_COOKIE = "aivo_mfa_challenge";
export const MFA_CHALLENGE_MAX_AGE_SECONDS = 60 * 15;

export type MfaMethod = "email" | "totp" | "webauthn" | (string & {});

export type MfaChallengeState = {
  token: string;
  method: MfaMethod;
  surface?: string;
};

export function parseMfaChallengeCookie(value: string | undefined): MfaChallengeState | null {
  if (!value) return null;
  try {
    const decoded = JSON.parse(decodeURIComponent(value)) as Partial<MfaChallengeState>;
    if (!decoded || typeof decoded.token !== "string" || typeof decoded.method !== "string") {
      return null;
    }
    return {
      token: decoded.token,
      method: decoded.method as MfaMethod,
      surface: typeof decoded.surface === "string" ? decoded.surface : undefined,
    };
  } catch {
    return null;
  }
}
