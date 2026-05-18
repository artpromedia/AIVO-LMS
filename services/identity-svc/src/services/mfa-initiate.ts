/**
 * Decide and start an MFA challenge for a user during a password login.
 * Picks the strongest enrolled factor:
 *   1. WebAuthn passkey (when ADMIN_ENTERPRISE.STRONG_MFA is on AND a credential exists)
 *   2. TOTP authenticator app (when user.mfaMethod === 'totp')
 *   3. Email OTP (default fallback)
 */
import { eq } from "drizzle-orm";
import { webauthnCredentials } from "@aivo/db";
import { ADMIN_ENTERPRISE, signJWT, type MfaChallengeJWT } from "@aivo/security";

export type MfaMethod = "email" | "totp" | "webauthn";

export interface MfaChallenge {
  mfaToken: string;
  mfaMethod: MfaMethod;
}

async function signMfaToken(userId: string, email: string, method: MfaMethod): Promise<string> {
  const claims: MfaChallengeJWT = {
    sub: userId,
    tenantId: "",
    role: "",
    email,
    purpose: "mfa",
    mfaMethod: method,
  };
  return signJWT<MfaChallengeJWT>(claims, "15m");
}

export async function pickMfaMethod(
  db: any,
  user: { id: string; mfaMethod: string | null },
): Promise<MfaMethod> {
  if (ADMIN_ENTERPRISE.STRONG_MFA) {
    const [cred] = await db
      .select({ id: webauthnCredentials.id })
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, user.id))
      .limit(1);
    if (cred) return "webauthn";
  }
  if (user.mfaMethod === "totp") return "totp";
  return "email";
}

/**
 * Returns a signed mfaToken + the picked method. Caller MUST send an email
 * OTP themselves (via createAndSendMfaCode) only when the returned method
 * is "email" — TOTP / WebAuthn are stateless and don't need a side-effect.
 */
export async function initiateMfa(
  db: any,
  user: { id: string; email: string; mfaMethod: string | null },
): Promise<MfaChallenge> {
  const method = await pickMfaMethod(db, user);
  const mfaToken = await signMfaToken(user.id, user.email, method);
  return { mfaToken, mfaMethod: method };
}
