/**
 * Per-user MFA enrollment + step-up grant registry.
 *
 * Backs the `(auth)/mfa/*` flow pages. Like the other web-v2 datasets this
 * is an in-memory singleton standing in for the `identity-svc` `mfa_factors`
 * / `mfa_challenges` tables. TOTP secrets are real (RFC 6238, see
 * `lib/auth/totp.ts`) so enrollment + verification actually work end to end
 * in the prototype; only the storage backend is mocked.
 */
import type { ID, ISODate } from "@/lib/db/types";
import { generateTotpSecret } from "@/lib/auth/totp";

export type FactorStatus = "pending" | "active";

export type TotpFactor = {
  userId: ID;
  secret: string;
  status: FactorStatus;
  createdAt: ISODate;
  confirmedAt: ISODate | null;
};

export type StepUpGrant = {
  userId: ID;
  /** Unix ms when the step-up (amr=mfa) was completed. */
  grantedAt: number;
  /** Unix ms when the grant expires. */
  expiresAt: number;
};

type Tables = {
  totp: Map<ID, TotpFactor>;
  stepUp: Map<ID, StepUpGrant>;
};

declare global {
  var __aivoMfaStore: Tables | undefined;
}

function tables(): Tables {
  if (!globalThis.__aivoMfaStore) {
    globalThis.__aivoMfaStore = { totp: new Map(), stepUp: new Map() };
  }
  return globalThis.__aivoMfaStore;
}

function nowIso(): ISODate {
  return new Date().toISOString();
}

/** Step-up window in seconds (default 5 min); aligns with identity-svc. */
export const STEP_UP_TTL_SEC = 300;

export type MfaStatus = {
  totpEnrolled: boolean;
  totpPending: boolean;
};

export function getMfaStatus(userId: ID): MfaStatus {
  const f = tables().totp.get(userId);
  return {
    totpEnrolled: f?.status === "active",
    totpPending: f?.status === "pending",
  };
}

/**
 * Begin (or restart) TOTP enrollment: mints a fresh secret in `pending`
 * state. Returns the secret so the UI can render the otpauth URI / manual
 * key. The factor only becomes `active` once a code is confirmed.
 */
export function startTotpEnrollment(userId: ID): TotpFactor {
  const factor: TotpFactor = {
    userId,
    secret: generateTotpSecret(),
    status: "pending",
    createdAt: nowIso(),
    confirmedAt: null,
  };
  tables().totp.set(userId, factor);
  return factor;
}

export function getTotpFactor(userId: ID): TotpFactor | null {
  return tables().totp.get(userId) ?? null;
}

/** Mark a pending TOTP factor active after a verified code. */
export function activateTotpFactor(userId: ID): boolean {
  const f = tables().totp.get(userId);
  if (!f || f.status === "active") return false;
  f.status = "active";
  f.confirmedAt = nowIso();
  return true;
}

export function removeTotpFactor(userId: ID): boolean {
  return tables().totp.delete(userId);
}

/** Record a completed step-up (amr=mfa) for the user. */
export function grantStepUp(userId: ID, ttlSec = STEP_UP_TTL_SEC, now = Date.now()): StepUpGrant {
  const grant: StepUpGrant = {
    userId,
    grantedAt: now,
    expiresAt: now + ttlSec * 1000,
  };
  tables().stepUp.set(userId, grant);
  return grant;
}

/** Is there an unexpired step-up grant for the user? */
export function hasRecentStepUp(userId: ID, now = Date.now()): boolean {
  const g = tables().stepUp.get(userId);
  return !!g && g.expiresAt > now;
}

export function clearStepUp(userId: ID): void {
  tables().stepUp.delete(userId);
}

/** Test/dev helper — wipes the store. */
export function _resetMfaStore(): void {
  globalThis.__aivoMfaStore = { totp: new Map(), stepUp: new Map() };
}
