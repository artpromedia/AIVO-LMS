/**
 * Parent phone-verification challenge registry — the dev/mock backend for the
 * `/onboarding/parent-verify` step (gap #7, slice 4 + SMS gap #22).
 *
 * The adult on a family account proves possession of a phone number before any
 * child profile leaves its holding state. We mint a 6-digit one-time code, text
 * it through comms-svc (`providers/sms-router` → Twilio when configured), and
 * verify the code the parent types back. The verification *logic* (code,
 * expiry, attempt-limit, hashing) lives here, exactly as the TOTP MFA logic
 * lives in `mfa-store.ts`; comms-svc is only the delivery channel.
 *
 * The code is a credential, so even in this throwaway dev store it is never kept
 * in plaintext: it is salted + scrypt-hashed and the plaintext is only ever
 * returned once, to the BFF, so it can be handed to the SMS sender. Callers can
 * never read it back. Process-local and lost on restart — acceptable for the
 * dev/demo path, which is the only place this store is read.
 */
import { randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { ID, ISODate } from "@/lib/db/types";

/** Minutes a freshly issued code stays valid (mirrors the UI copy). */
export const PHONE_CODE_TTL_MIN = 10;
/** Wrong-code attempts allowed before the challenge is burned. */
export const PHONE_MAX_ATTEMPTS = 5;

type Challenge = {
  /** E.164 phone the code was sent to. */
  phone: string;
  /** scrypt-derived key of the code, hex-encoded. */
  hash: string;
  /** Random per-code salt, hex-encoded. */
  salt: string;
  /** Unix ms when the code expires. */
  expiresAt: number;
  /** Wrong-code attempts so far. */
  attempts: number;
};

type Verified = {
  phone: string;
  verifiedAt: ISODate;
};

type Tables = {
  /** Outstanding challenge per user (only the latest is kept). */
  challenges: Map<ID, Challenge>;
  /** Completed verification per user. */
  verified: Map<ID, Verified>;
};

declare global {
  // Module-scoped singleton, sibling to globalThis.__aivoStore.
  var __aivoParentPhoneStore: Tables | undefined;
}

function tables(): Tables {
  if (!globalThis.__aivoParentPhoneStore) {
    globalThis.__aivoParentPhoneStore = { challenges: new Map(), verified: new Map() };
  }
  return globalThis.__aivoParentPhoneStore;
}

function hashCode(code: string, salt: string): string {
  return scryptSync(code, salt, 32).toString("hex");
}

/**
 * Normalize to E.164-ish: keep a single leading `+` and digits only. Returns
 * null when the result isn't a plausible international number (8–15 digits).
 */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 15) return null;
  return `${hasPlus ? "+" : ""}${digits}`;
}

export type PhoneStatus = {
  phoneVerified: boolean;
  /** Last verified number, masked to its final 4 digits, or null. */
  verifiedPhone: string | null;
  /** Phone a code is currently outstanding for, masked, or null. */
  pendingPhone: string | null;
};

/** Mask all but the last 4 digits so status never echoes the full number. */
function mask(phone: string): string {
  const tail = phone.slice(-4);
  return `••• ${tail}`;
}

export function getPhoneStatus(userId: ID, now = Date.now()): PhoneStatus {
  const t = tables();
  const v = t.verified.get(userId);
  const c = t.challenges.get(userId);
  return {
    phoneVerified: Boolean(v),
    verifiedPhone: v ? mask(v.phone) : null,
    pendingPhone: c && c.expiresAt > now ? mask(c.phone) : null,
  };
}

export type StartChallengeResult = {
  /** Plaintext code — returned ONCE so the BFF can send it; never persisted. */
  code: string;
  phone: string;
  expiresAt: ISODate;
};

/**
 * Mint (or replace) a phone-verification challenge. Returns the plaintext code
 * for the BFF to deliver over SMS — it is hashed at rest and cannot be read
 * back.
 */
export function startPhoneChallenge(
  userId: ID,
  phone: string,
  now = Date.now(),
): StartChallengeResult {
  // 6-digit, zero-padded, cryptographically random.
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const salt = randomBytes(16).toString("hex");
  const expiresAt = now + PHONE_CODE_TTL_MIN * 60 * 1000;
  tables().challenges.set(userId, {
    phone,
    hash: hashCode(code, salt),
    salt,
    expiresAt,
    attempts: 0,
  });
  return { code, phone, expiresAt: new Date(expiresAt).toISOString() };
}

export type VerifyResult =
  | { ok: true; phone: string }
  | { ok: false; reason: "no_challenge" | "expired" | "too_many_attempts" | "mismatch" };

/**
 * Verify a typed code against the outstanding challenge. Constant-time compare,
 * single-use: a success clears the challenge and records the verified number; a
 * mismatch increments the attempt counter and burns the challenge once the
 * limit is hit.
 */
export function verifyPhoneChallenge(userId: ID, code: string, now = Date.now()): VerifyResult {
  const t = tables();
  const c = t.challenges.get(userId);
  if (!c) return { ok: false, reason: "no_challenge" };
  if (c.expiresAt <= now) {
    t.challenges.delete(userId);
    return { ok: false, reason: "expired" };
  }
  if (c.attempts >= PHONE_MAX_ATTEMPTS) {
    t.challenges.delete(userId);
    return { ok: false, reason: "too_many_attempts" };
  }
  const candidate = Buffer.from(hashCode(code, c.salt), "hex");
  const expected = Buffer.from(c.hash, "hex");
  const match = candidate.length === expected.length && timingSafeEqual(candidate, expected);
  if (!match) {
    c.attempts += 1;
    if (c.attempts >= PHONE_MAX_ATTEMPTS) t.challenges.delete(userId);
    return { ok: false, reason: c.attempts >= PHONE_MAX_ATTEMPTS ? "too_many_attempts" : "mismatch" };
  }
  t.challenges.delete(userId);
  t.verified.set(userId, { phone: c.phone, verifiedAt: new Date(now).toISOString() });
  return { ok: true, phone: c.phone };
}

/** Test/dev helper — wipes the store. */
export function _resetParentPhoneStore(): void {
  globalThis.__aivoParentPhoneStore = { challenges: new Map(), verified: new Map() };
}
