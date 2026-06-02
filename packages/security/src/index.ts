import * as jose from "jose";
import * as fs from "fs";
import * as path from "path";

export interface JWTPayload {
  sub: string;
  tenantId: string;
  role: string;
  /**
   * Every role the user may act as (ADR 0020 — single shell, multi-role):
   * `role` plus any `user_roles` rows. When present, `checkActiveRole`
   * validates the active-role header against this set; absent ⇒ `[role]`.
   */
  availableRoles?: string[];
  email?: string;
  name?: string;
  impersonatedBy?: string;
}

/** Short-lived MFA challenge token claims. */
export interface MfaChallengeJWT {
  sub: string;
  tenantId: string;
  role: string;
  email?: string;
  purpose: "mfa";
  mfaMethod: "email" | "totp" | "webauthn";
}

/** WebAuthn challenge token claims (registration or assertion). */
export interface WebauthnChallengeJWT {
  sub: string;
  tenantId: string;
  role: string;
  email?: string;
  purpose: `webauthn-${"register" | "login"}`;
  challenge: string;
}

/**
 * Sensitive-operation scopes that require step-up re-authentication
 * before the operation is allowed (Sprint 3).
 */
export type StepUpScope =
  | "tenant:delete"
  | "tenant:suspend"
  | "user:delete"
  | "user:impersonate"
  | "role:change"
  | "brain:reset"
  | "data:export"
  | "config:update"
  | "district:admin-mgmt";

export * from "./audit-chain.js";
export * from "./ip-allowlist.js";
export * from "./password-policy.js";
export * from "./flags.js";

export const STEP_UP_SCOPES: readonly StepUpScope[] = [
  "tenant:delete",
  "tenant:suspend",
  "user:delete",
  "user:impersonate",
  "role:change",
  "brain:reset",
  "data:export",
  "config:update",
  "district:admin-mgmt",
] as const;

/**
 * Short-lived challenge issued by `/api/auth/step-up/initiate`. The client
 * presents proof of the requested factor and exchanges it for a `StepUpJWT`.
 */
export interface StepUpChallengeJWT {
  sub: string;
  tenantId: string;
  role: string;
  purpose: "step-up-challenge";
  scope: StepUpScope;
  factor: "webauthn" | "totp" | "email";
  /** Random nonce; for WebAuthn it is also the assertion challenge. */
  nonce: string;
}

/**
 * Token that proves the caller completed a step-up challenge for a given
 * scope within the last 5 minutes. Presented via `x-step-up-token` header.
 */
export interface StepUpJWT {
  sub: string;
  tenantId: string;
  role: string;
  purpose: "step-up";
  scope: StepUpScope;
  factor: "webauthn" | "totp" | "email";
  /** Unique token id used by `requireStepUp` to enforce single-use replay protection. */
  jti?: string;
}

let privateKey: jose.CryptoKey | Uint8Array;
let publicKey: jose.CryptoKey | Uint8Array;

export async function initKeys() {
  const privPem = process.env.JWT_PRIVATE_KEY;
  const pubPem = process.env.JWT_PUBLIC_KEY;

  if (privPem && pubPem) {
    privateKey = await jose.importPKCS8(privPem, "RS256");
    publicKey = await jose.importSPKI(pubPem, "RS256");
    return;
  }

  const keyDir =
    process.env.JWT_KEY_DIR || path.resolve(process.cwd(), "..", "..", ".local", "jwt-keys");
  const privPath = path.join(keyDir, "private.pem");
  const pubPath = path.join(keyDir, "public.pem");

  try {
    if (fs.existsSync(privPath) && fs.existsSync(pubPath)) {
      const privFile = fs.readFileSync(privPath, "utf8");
      const pubFile = fs.readFileSync(pubPath, "utf8");
      privateKey = await jose.importPKCS8(privFile, "RS256");
      publicKey = await jose.importSPKI(pubFile, "RS256");
      return;
    }
  } catch {
    /* ignore — fall through to regenerate keys */
  }

  const { privateKey: priv, publicKey: pub } = await jose.generateKeyPair("RS256", {
    extractable: true,
  });
  privateKey = priv;
  publicKey = pub;

  try {
    fs.mkdirSync(keyDir, { recursive: true });
    const privPemOut = await jose.exportPKCS8(priv as jose.CryptoKey);
    const pubPemOut = await jose.exportSPKI(pub as jose.CryptoKey);
    fs.writeFileSync(privPath, privPemOut, { mode: 0o600 });
    fs.writeFileSync(pubPath, pubPemOut, { mode: 0o644 });
  } catch {
    /* ignore — best-effort key persistence */
  }
}

export async function signJWT<T extends object = JWTPayload>(
  payload: T,
  expiresIn = "15m",
): Promise<string> {
  if (!privateKey) await initKeys();
  return new jose.SignJWT(payload as unknown as jose.JWTPayload)
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setIssuer("aivo:identity-svc")
    .sign(privateKey);
}

export async function verifyJWT<T = JWTPayload>(token: string): Promise<T> {
  if (!publicKey) await initKeys();
  const { payload } = await jose.jwtVerify(token, publicKey, {
    issuer: "aivo:identity-svc",
  });
  return payload as unknown as T;
}

export function getPublicKey() {
  return publicKey;
}

export async function getPublicKeyPEM(): Promise<string | null> {
  if (!publicKey) await initKeys();
  if (!publicKey) return null;
  const spki = await jose.exportSPKI(publicKey as jose.CryptoKey);
  return spki;
}

export { initKeys as initJWTKeys };

export {
  ADMIN_ENTERPRISE,
  loadAdminEnterpriseFlags,
  logAdminEnterpriseFlags,
  parseBoolFlag,
  parseIntFlag,
  type AdminEnterpriseFlags,
} from "./flags.js";

export {
  encryptSecret,
  decryptSecret,
  hashOtpCode,
  timingSafeEqualHex,
  generateRecoveryCodes,
  canonicalizeRecoveryCode,
  looksLikeRecoveryCode,
  _resetMfaKeyCache,
  assertMfaKeyConfigured,
  type RecoveryHasher,
  type RecoveryVerifier,
} from "./mfa-crypto.js";

export {
  SURFACE_COOKIE_NAME,
  getSurfaceSecret,
  signSurfaceCookieValue,
  verifySurfaceCookieValue,
  b64urlEncode,
  type SurfaceCookieClaims,
} from "./surface-cookie.js";

export { getSecretsClient, _resetSecretsClient, type SecretsClient } from "./secrets-client.js";

export {
  ACTIVE_ROLE_HEADER,
  FORBIDDEN_ROLE_CODE,
  ACTIVE_ROLE_SPOOFING_EVENT,
  checkActiveRole,
  type ActiveRoleResult,
} from "./active-role.js";
