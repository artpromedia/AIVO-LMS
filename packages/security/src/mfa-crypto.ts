/**
 * MFA crypto primitives:
 *  - Symmetric AES-256-GCM encryption for stored TOTP secrets
 *  - SHA-256 hashing for short-lived email OTP codes (TTL <= 10 min so a
 *    pre-image attack on a 6-digit code is not the threat model — the goal
 *    is "nobody with read access to the DB can use a code")
 *  - Argon2id-hashed single-use recovery codes
 *
 * MFA_ENCRYPTION_KEY must be a 64-char hex string (32 bytes). Outside of
 * production we synthesize a deterministic dev key so smoke tests work, but
 * we throw at module load in production if the env var is missing.
 */

import * as crypto from "node:crypto";

const ENV_KEY = "MFA_ENCRYPTION_KEY";
const DEV_FALLBACK = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env[ENV_KEY];
  if (!raw) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${ENV_KEY} is required in production for MFA secret encryption`);
    }
    cachedKey = Buffer.from(DEV_FALLBACK, "hex");
    return cachedKey;
  }
  const trimmed = raw.trim();
  if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new Error(`${ENV_KEY} must be a 64-character hex string (32 bytes)`);
  }
  cachedKey = Buffer.from(trimmed, "hex");
  return cachedKey;
}

/**
 * Eagerly validate the MFA encryption key. Call this at service boot from
 * each process that touches MFA so misconfiguration fails the process
 * startup, rather than being discovered when a user first attempts to enroll
 * a TOTP secret. Returns the key length (32) on success; throws otherwise.
 */
export function assertMfaKeyConfigured(): number {
  const key = loadKey();
  if (key.length !== 32) {
    throw new Error(`${ENV_KEY} must decode to exactly 32 bytes`);
  }
  return key.length;
}

/** Reset the cached key — for tests only. */
export function _resetMfaKeyCache(): void {
  cachedKey = null;
}

/**
 * Encrypt a UTF-8 plaintext (e.g. a base32 TOTP secret) into a portable
 * envelope `v1:<iv_b64>:<tag_b64>:<ciphertext_b64>`.
 */
export function encryptSecret(plain: string): string {
  if (typeof plain !== "string" || plain.length === 0) {
    throw new Error("encryptSecret: plain must be a non-empty string");
  }
  const key = loadKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ct.toString("base64")}`;
}

export function decryptSecret(envelope: string): string {
  if (typeof envelope !== "string") throw new Error("decryptSecret: envelope must be a string");
  const parts = envelope.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("decryptSecret: unsupported envelope format");
  }
  const key = loadKey();
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const ct = Buffer.from(parts[3], "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString("utf8");
}

/**
 * SHA-256 hex hash of a short-lived OTP code. Constant-time-comparable
 * via `timingSafeEqualHex`. Sufficient for codes that expire in minutes
 * and have ≤5 attempts before lockout.
 */
export function hashOtpCode(code: string): string {
  return crypto.createHash("sha256").update(String(code)).digest("hex");
}

/** Constant-time compare of two equal-length hex strings. */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/**
 * Generate `count` (default 10) human-readable single-use recovery codes
 * formatted as `XXXX-XXXX-XXXX` using a 32-character no-confuse alphabet.
 * Returns the plaintext list (shown to the user once) plus the same
 * codes uppercased & dash-stripped so callers can hand them to
 * `hashRecoveryCode` for storage.
 */
const RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
export function generateRecoveryCodes(count = 10): { plain: string[]; canonical: string[] } {
  const plain: string[] = [];
  const canonical: string[] = [];
  for (let i = 0; i < count; i++) {
    const chars: string[] = [];
    const buf = crypto.randomBytes(12);
    for (let j = 0; j < 12; j++) {
      chars.push(RECOVERY_ALPHABET[buf[j] % RECOVERY_ALPHABET.length]);
    }
    const c = chars.join("");
    plain.push(`${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`);
    canonical.push(c);
  }
  return { plain, canonical };
}

/** Normalize user-entered recovery code to canonical (uppercase, alphanumeric only). */
export function canonicalizeRecoveryCode(input: string): string {
  return String(input || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

/** Detect if a `code` looks like a recovery code (12 alphanum chars after canonicalization). */
export function looksLikeRecoveryCode(input: string): boolean {
  return canonicalizeRecoveryCode(input).length === 12;
}

/**
 * Argon2id-hash a recovery code. Caller passes the *canonical* form. Async
 * to keep argon2 in services-only — packages/security must not depend on
 * argon2 directly, so we accept a verifier function from the caller.
 */
export type RecoveryHasher = (canonical: string) => Promise<string>;
export type RecoveryVerifier = (hash: string, canonical: string) => Promise<boolean>;
