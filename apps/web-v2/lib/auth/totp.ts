/**
 * RFC 6238 TOTP / RFC 4226 HOTP — minimal, dependency-free implementation
 * for the MFA enrollment + verification flows. Runs in Node route handlers
 * (uses `node:crypto`). The production identity-svc uses `otplib`/`otpauth`;
 * this mirrors the same algorithm so the web-v2 prototype is functional and
 * unit-testable against the published RFC 6238 test vectors.
 */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/** Encode bytes as RFC 4648 base32 (no padding). */
export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** Decode an RFC 4648 base32 string (padding/whitespace tolerated). */
export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error("Invalid base32 character");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Generate a fresh base32 TOTP secret (default 20 bytes / 160 bits). */
export function generateTotpSecret(bytes = 20): string {
  return base32Encode(randomBytes(bytes));
}

export interface TotpOptions {
  /** Time step in seconds. Default 30. */
  step?: number;
  /** Number of digits. Default 6. */
  digits?: number;
  /** Unix time (ms) to evaluate at. Default Date.now(). */
  now?: number;
  /** HMAC algorithm. Default sha1 (RFC 6238 default). */
  algorithm?: "sha1" | "sha256" | "sha512";
}

/** RFC 4226 HOTP for an explicit counter. */
export function hotp(secret: string, counter: number, digits = 6, algorithm: "sha1" | "sha256" | "sha512" = "sha1"): string {
  const key = base32Decode(secret);
  const buf = Buffer.alloc(8);
  // Write the 64-bit counter big-endian (JS bitwise is 32-bit, so split).
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac(algorithm, key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

/** Current TOTP code for a secret. */
export function totp(secret: string, opts: TotpOptions = {}): string {
  const { step = 30, digits = 6, now = Date.now(), algorithm = "sha1" } = opts;
  const counter = Math.floor(now / 1000 / step);
  return hotp(secret, counter, digits, algorithm);
}

/**
 * Verify a submitted code against the secret, allowing `window` steps of
 * clock drift in either direction (default ±1 = ±30 s). Constant-time per
 * candidate comparison.
 */
export function verifyTotp(
  secret: string,
  code: string,
  opts: TotpOptions & { window?: number } = {},
): boolean {
  const { step = 30, digits = 6, now = Date.now(), algorithm = "sha1", window = 1 } = opts;
  const candidate = code.trim();
  if (!/^\d+$/.test(candidate) || candidate.length !== digits) return false;
  const counter = Math.floor(now / 1000 / step);
  for (let w = -window; w <= window; w++) {
    const expected = hotp(secret, counter + w, digits, algorithm);
    const a = Buffer.from(expected);
    const b = Buffer.from(candidate);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

/** Build an otpauth:// URI for QR provisioning. */
export function otpauthUrl(params: {
  secret: string;
  accountName: string;
  issuer?: string;
  digits?: number;
  step?: number;
}): string {
  const issuer = params.issuer ?? "AIVO";
  const label = encodeURIComponent(`${issuer}:${params.accountName}`);
  const q = new URLSearchParams({
    secret: params.secret,
    issuer,
    algorithm: "SHA1",
    digits: String(params.digits ?? 6),
    period: String(params.step ?? 30),
  });
  return `otpauth://totp/${label}?${q.toString()}`;
}
