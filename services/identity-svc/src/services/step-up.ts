/**
 * Step-up authentication core (Sprint 3).
 *
 * Issues a per-scope challenge bound to the calling user, then exchanges
 * proof-of-factor (passkey assertion / TOTP code / email OTP) for a
 * short-lived `stepUpToken` JWT carrying the matching scope. Routes that
 * need step-up enforce it via the `requireStepUp(scope)` Fastify
 * preHandler factory.
 */
import crypto from "crypto";
import { eq } from "drizzle-orm";
import {
  signJWT,
  verifyJWT,
  decryptSecret,
  hashOtpCode,
  timingSafeEqualHex,
  canonicalizeRecoveryCode,
  looksLikeRecoveryCode,
  type StepUpScope,
  type StepUpChallengeJWT,
  type StepUpJWT,
} from "@aivo/security";
import { users, mfaCodes, mfaRecoveryCodes, webauthnCredentials } from "@aivo/db";
import { verifyTotpCode } from "./mfa-totp.js";
import { isMfaLocked, recordMfaFailure, clearMfaFailures } from "./mfa-lockout.js";

export const STEP_UP_CHALLENGE_TTL = "5m";
export const STEP_UP_TOKEN_TTL = "5m";

export type StepUpFactor = "webauthn" | "totp" | "email";

export interface StepUpUserCtx {
  sub: string;
  tenantId: string;
  role: string;
  email?: string;
}

/**
 * Pick the strongest factor the user has enrolled. Order: WebAuthn > TOTP >
 * email OTP. Returns `null` only if the user has no email on file (which
 * would indicate a misconfigured account).
 */
export async function selectFactor(
  db: any,
  userId: string,
): Promise<StepUpFactor | null> {
  const [u] = await db
    .select({
      mfaMethod: users.mfaMethod,
      totpSecret: users.totpSecretEncrypted,
      email: users.email,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u) return null;

  const [cred] = await db
    .select({ id: webauthnCredentials.id })
    .from(webauthnCredentials)
    .where(eq(webauthnCredentials.userId, userId))
    .limit(1);
  if (cred) return "webauthn";

  if (u.totpSecret) return "totp";
  if (u.email) return "email";
  return null;
}

export async function issueStepUpChallenge(
  user: StepUpUserCtx,
  scope: StepUpScope,
  factor: StepUpFactor,
): Promise<{ challengeToken: string; nonce: string }> {
  const nonce = crypto.randomBytes(32).toString("base64url");
  const claims: StepUpChallengeJWT = {
    sub: user.sub,
    tenantId: user.tenantId,
    role: user.role,
    purpose: "step-up-challenge",
    scope,
    factor,
    nonce,
  };
  const challengeToken = await signJWT<StepUpChallengeJWT>(claims, STEP_UP_CHALLENGE_TTL);
  return { challengeToken, nonce };
}

export async function verifyStepUpChallengeToken(
  token: string,
  expected: { sub: string; scope: StepUpScope },
): Promise<StepUpChallengeJWT> {
  const claims = await verifyJWT<StepUpChallengeJWT>(token);
  if (claims.purpose !== "step-up-challenge") {
    throw new Error("Wrong token purpose");
  }
  if (claims.sub !== expected.sub) {
    throw new Error("Challenge subject mismatch");
  }
  if (claims.scope !== expected.scope) {
    throw new Error("Challenge scope mismatch");
  }
  return claims;
}

export async function issueStepUpToken(
  user: StepUpUserCtx,
  scope: StepUpScope,
  factor: StepUpFactor,
): Promise<string> {
  // jti enables single-use replay protection in `requireStepUp`. The token's
  // 5-minute TTL still bounds the worst case if the cache is wiped (process
  // restart) but in steady state every token is consumed at most once.
  const jti = crypto.randomBytes(16).toString("base64url");
  const claims: StepUpJWT = {
    sub: user.sub,
    tenantId: user.tenantId,
    role: user.role,
    purpose: "step-up",
    scope,
    factor,
    jti,
  };
  return signJWT<StepUpJWT>(claims, STEP_UP_TOKEN_TTL);
}

/**
 * In-memory single-use cache for consumed step-up token jtis. Process-local
 * (sufficient for the single-instance dev/staging deployment); for HA we'd
 * back this with Redis. Entries auto-expire 6 minutes after first sight,
 * which comfortably outlives the 5-minute token TTL.
 */
const consumedJtis = new Map<string, number>();
const JTI_RETENTION_MS = 6 * 60 * 1000;

function pruneJtiCache(now: number) {
  for (const [k, exp] of consumedJtis) {
    if (exp <= now) consumedJtis.delete(k);
  }
}

/** Returns true if the jti was already consumed. */
export function checkAndConsumeJti(jti: string): boolean {
  const now = Date.now();
  pruneJtiCache(now);
  if (consumedJtis.has(jti)) return true;
  consumedJtis.set(jti, now + JTI_RETENTION_MS);
  return false;
}

/**
 * Verify a stored TOTP code against the user's encrypted secret.
 * Returns false if the user has no enrolled secret.
 */
export async function verifyTotpForUser(db: any, userId: string, code: string): Promise<boolean> {
  const [u] = await db
    .select({ totpSecret: users.totpSecretEncrypted })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u?.totpSecret) return false;
  let plain: string;
  try {
    plain = decryptSecret(u.totpSecret);
  } catch {
    return false;
  }
  return verifyTotpCode(plain, String(code).trim());
}

/**
 * Verify a hashed email OTP that was previously issued via `issueEmailOtp`.
 * Codes live in `mfa_codes` with a `purpose` discriminator so step-up codes
 * cannot be replayed against the regular login flow.
 */
export async function verifyEmailOtpForUser(
  db: any,
  userId: string,
  code: string,
  purpose = "step-up",
): Promise<boolean> {
  const trimmed = String(code).trim();
  if (!/^\d{6}$/.test(trimmed)) return false;
  const inputHash = hashOtpCode(trimmed);
  const rows = await db
    .select({ id: mfaCodes.id, codeHash: mfaCodes.codeHash, expiresAt: mfaCodes.expiresAt, purpose: mfaCodes.purpose })
    .from(mfaCodes)
    .where(eq(mfaCodes.userId, userId));
  const now = Date.now();
  for (const row of rows) {
    if (row.purpose !== purpose) continue;
    if (!row.expiresAt || new Date(row.expiresAt).getTime() < now) continue;
    if (timingSafeEqualHex(row.codeHash, inputHash)) {
      // single-use: consume by deleting
      await db.delete(mfaCodes).where(eq(mfaCodes.id, row.id));
      return true;
    }
  }
  return false;
}

/**
 * Verify a recovery code as a step-up factor (fallback when neither TOTP
 * nor passkey is available). Mirrors the login-time recovery flow: argon2
 * comparison, single-use, and emits caller's responsibility to log the
 * `MFA_RECOVERY_USED` audit event.
 */
export async function verifyRecoveryCodeForUser(
  db: any,
  userId: string,
  code: string,
): Promise<boolean> {
  const canonical = canonicalizeRecoveryCode(code);
  if (!looksLikeRecoveryCode(canonical)) return false;
  const argon2 = await import("argon2");
  const rows = await db
    .select({ id: mfaRecoveryCodes.id, codeHash: mfaRecoveryCodes.codeHash, usedAt: mfaRecoveryCodes.usedAt })
    .from(mfaRecoveryCodes)
    .where(eq(mfaRecoveryCodes.userId, userId));
  for (const row of rows) {
    if (row.usedAt) continue;
    try {
      if (await argon2.verify(row.codeHash, canonical)) {
        await db
          .update(mfaRecoveryCodes)
          .set({ usedAt: new Date() })
          .where(eq(mfaRecoveryCodes.id, row.id));
        return true;
      }
    } catch {}
  }
  return false;
}

export { isMfaLocked, recordMfaFailure, clearMfaFailures };
