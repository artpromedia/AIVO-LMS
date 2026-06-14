/**
 * In-memory learner-PIN store — the dev/mock fallback used by the onboarding
 * PIN step when identity-svc is not wired (mirrors the dual-path the Speech
 * Buddy consent + billing surfaces use). In production (`AIVO_USE_IDENTITY_SVC`
 * / `AIVO_USE_SERVICE_STACK` on, real token present) the BFF sets the PIN on
 * identity-svc's learner_pin_credentials table instead — that is the value
 * the mobile learner `pin-login` flow verifies.
 *
 * The PIN is a credential, so even in this throwaway dev store we never keep it
 * in plaintext: it is salted + hashed (scrypt) and only `hasPin` / `pinSetAt`
 * are ever exposed to callers. Process-local and lost on restart — acceptable
 * for the demo/dev path, which is the only place this store is read.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

type StoredPin = {
  /** scrypt-derived key, hex-encoded. */
  hash: string;
  /** Random per-PIN salt, hex-encoded. */
  salt: string;
  setAt: string;
};

export type LearnerPinMeta = {
  hasPin: boolean;
  pinSetAt: string | null;
};

// Keyed by `${tenantId}:${learnerId}` — only the latest PIN is retained.
const store = new Map<string, StoredPin>();

function key(tenantId: string, learnerId: string): string {
  return `${tenantId}:${learnerId}`;
}

function hashPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 32).toString("hex");
}

/** True iff `value` is a 4–6 digit numeric PIN (matches identity-svc bounds). */
export function isValidPin(value: unknown): value is string {
  return typeof value === "string" && /^\d{4,6}$/.test(value);
}

/** Persist (or replace) the learner's PIN. Returns the resulting metadata. */
export function setStoredLearnerPin(
  tenantId: string,
  learnerId: string,
  pin: string,
): LearnerPinMeta {
  const salt = randomBytes(16).toString("hex");
  const record: StoredPin = { hash: hashPin(pin, salt), salt, setAt: new Date().toISOString() };
  store.set(key(tenantId, learnerId), record);
  return { hasPin: true, pinSetAt: record.setAt };
}

/** Read whether a PIN is set (and when) without exposing the secret. */
export function getStoredLearnerPinMeta(tenantId: string, learnerId: string): LearnerPinMeta {
  const record = store.get(key(tenantId, learnerId));
  return { hasPin: Boolean(record), pinSetAt: record?.setAt ?? null };
}

/**
 * Constant-time PIN check. Not used by the onboarding write path, but kept so
 * a future web-v2 learner-unlock surface (and tests) can verify against the
 * same store the parent wrote to.
 */
export function verifyStoredLearnerPin(tenantId: string, learnerId: string, pin: string): boolean {
  const record = store.get(key(tenantId, learnerId));
  if (!record) return false;
  const candidate = Buffer.from(hashPin(pin, record.salt), "hex");
  const expected = Buffer.from(record.hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
